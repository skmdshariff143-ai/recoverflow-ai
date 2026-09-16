export type BanditPolicyArm = 
  | 'ARM_ZERO_DISCOUNT_URGENCY'
  | 'ARM_FREE_SHIPPING'
  | 'ARM_DYNAMIC_MICRO_DISCOUNT'
  | 'ARM_BUNDLE_GIFT_SWAP';

export type CartValueTier = 'LOW' | 'MID' | 'HIGH';

export interface ArmDistributionState {
  arm: BanditPolicyArm;
  alpha: number; // successes + prior (1.0)
  beta: number;  // failures + prior (1.0)
  pulls: number;
  totalReward: number;
  avgReward: number;
}

export interface BanditContext {
  merchantId: string;
  category: string;
  cartValue: number;
  cartTier: CartValueTier;
}

export interface BanditArmSelection {
  selectedArm: BanditPolicyArm;
  sampledValue: number;
  cartTier: CartValueTier;
  strategyDescription: string;
  appliedDiscountPercentage: number;
}

export interface RewardCalculationParams {
  recoveredGmv: number;
  discountCost: number;
  messagingSlaFee: number; // e.g. $0.05 Meta WhatsApp fee
  convertedStatus: 0 | 1;
}

export interface CompositeRewardInput {
  recoveredGmv: number;
  discountValue: number;
  whatsappWeight?: number; // default 1.0
  emailWeight?: number;    // default 0.8
  convertedStatus?: 0 | 1; // default 1
}

/**
 * Unified RL Reward Function:
 * Reward = (WhatsApp_Weight * Email_Weight) * (Recovered_GMV - Discount_Value)
 */
export function computeCompositeReward(input: CompositeRewardInput): number {
  const {
    recoveredGmv,
    discountValue,
    whatsappWeight = 1.0,
    emailWeight = 0.8,
    convertedStatus = 1,
  } = input;

  if (convertedStatus === 0) return 0;
  const attributionWeight = whatsappWeight * emailWeight;
  const netGmv = Math.max(0, recoveredGmv - discountValue);
  return parseFloat((attributionWeight * netGmv).toFixed(2));
}

export class ThompsonSamplerMarginGuardian {
  // Key: `${merchantId}:${cartTier}` -> Map<BanditPolicyArm, ArmDistributionState>
  private posteriors = new Map<string, Map<BanditPolicyArm, ArmDistributionState>>();

  constructor() {
    this.initDefaultPriors();
  }

  private makeKey(merchantId: string, tier: CartValueTier): string {
    return `${merchantId}:${tier}`;
  }

  public getCartTier(cartValue: number): CartValueTier {
    if (cartValue < 100) return 'LOW';
    if (cartValue <= 300) return 'MID';
    return 'HIGH';
  }

  private initDefaultPriors() {
    const arms: BanditPolicyArm[] = [
      'ARM_ZERO_DISCOUNT_URGENCY',
      'ARM_FREE_SHIPPING',
      'ARM_DYNAMIC_MICRO_DISCOUNT',
      'ARM_BUNDLE_GIFT_SWAP',
    ];

    const tiers: CartValueTier[] = ['LOW', 'MID', 'HIGH'];

    for (const tier of tiers) {
      const armMap = new Map<BanditPolicyArm, ArmDistributionState>();
      for (const arm of arms) {
        armMap.set(arm, {
          arm,
          alpha: 2.0, // Uniform uninformative prior
          beta: 2.0,
          pulls: 0,
          totalReward: 0,
          avgReward: 0,
        });
      }
      this.posteriors.set(`merchant_default_01:${tier}`, armMap);
    }
  }

  /**
   * Samples a random float from Beta(alpha, beta) using standard numerical transformation.
   */
  public sampleBeta(alpha: number, beta: number): number {
    // Generate Gamma(alpha, 1) and Gamma(beta, 1) approximations
    const gammaAlpha = this.sampleGamma(alpha);
    const gammaBeta = this.sampleGamma(beta);
    if (gammaAlpha + gammaBeta === 0) return 0.5;
    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  /**
   * Marsaglia and Tsang method for generating Gamma(k, 1) variates.
   */
  private sampleGamma(k: number): number {
    if (k < 1) {
      return this.sampleGamma(k + 1) * Math.pow(Math.random(), 1 / k);
    }
    const d = k - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      const u = Math.random();
      let v = 0;
      let x = 0;
      do {
        x = this.sampleNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  /**
   * Box-Muller transform for standard Normal(0, 1) sampling.
   */
  private sampleNormal(): number {
    let u1 = 0;
    let u2 = 0;
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Selects an optimal recovery arm using Thompson Sampling.
   */
  public selectArm(context: BanditContext, discountCeilingPercentage = 15.0): BanditArmSelection {
    const key = this.makeKey(context.merchantId, context.cartTier);
    let armMap = this.posteriors.get(key);

    if (!armMap) {
      armMap = new Map();
      const defaultArms: BanditPolicyArm[] = [
        'ARM_ZERO_DISCOUNT_URGENCY',
        'ARM_FREE_SHIPPING',
        'ARM_DYNAMIC_MICRO_DISCOUNT',
        'ARM_BUNDLE_GIFT_SWAP',
      ];
      for (const a of defaultArms) {
        armMap.set(a, { arm: a, alpha: 2.0, beta: 2.0, pulls: 0, totalReward: 0, avgReward: 0 });
      }
      this.posteriors.set(key, armMap);
    }

    let bestArm: BanditPolicyArm = 'ARM_ZERO_DISCOUNT_URGENCY';
    let highestSample = -Infinity;

    for (const [arm, state] of armMap.entries()) {
      const sample = this.sampleBeta(state.alpha, state.beta);
      if (sample > highestSample) {
        highestSample = sample;
        bestArm = arm;
      }
    }

    let appliedDiscount = 0;
    let description = '';

    switch (bestArm) {
      case 'ARM_ZERO_DISCOUNT_URGENCY':
        appliedDiscount = 0;
        description = '0% discount with high-urgency stock reservation social proof';
        break;
      case 'ARM_FREE_SHIPPING':
        appliedDiscount = 0; // Free shipping code applied
        description = 'Free expedited shipping waiver courtesy';
        break;
      case 'ARM_DYNAMIC_MICRO_DISCOUNT':
        appliedDiscount = Math.min(discountCeilingPercentage, context.cartTier === 'HIGH' ? 10 : 15);
        description = `Dynamic micro-discount courtesy of ${appliedDiscount}%`;
        break;
      case 'ARM_BUNDLE_GIFT_SWAP':
        appliedDiscount = 0;
        description = 'High-margin complimentary artisan accessory gift appended to cart';
        break;
    }

    return {
      selectedArm: bestArm,
      sampledValue: parseFloat(highestSample.toFixed(4)),
      cartTier: context.cartTier,
      strategyDescription: description,
      appliedDiscountPercentage: appliedDiscount,
    };
  }

  /**
   * Calculates net margin reward:
   * Reward = (Recovered_GMV - Discount_Cost - Messaging_SLA_Fee) * Converted_Status
   */
  public calculateReward(params: RewardCalculationParams): number {
    if (params.convertedStatus === 0) {
      return 0; // Lost opportunity
    }
    const netRevenue = params.recoveredGmv - params.discountCost - params.messagingSlaFee;
    return Math.max(0, netRevenue);
  }

  /**
   * Updates posterior distribution after receiving reward outcome.
   */
  public updateArm(
    merchantId: string,
    tier: CartValueTier,
    arm: BanditPolicyArm,
    reward: number,
    converted: boolean
  ): ArmDistributionState {
    const key = this.makeKey(merchantId, tier);
    let armMap = this.posteriors.get(key);
    if (!armMap) {
      armMap = new Map();
      const defaultArms: BanditPolicyArm[] = [
        'ARM_ZERO_DISCOUNT_URGENCY',
        'ARM_FREE_SHIPPING',
        'ARM_DYNAMIC_MICRO_DISCOUNT',
        'ARM_BUNDLE_GIFT_SWAP',
      ];
      for (const a of defaultArms) {
        armMap.set(a, { arm: a, alpha: 2.0, beta: 2.0, pulls: 0, totalReward: 0, avgReward: 0 });
      }
      this.posteriors.set(key, armMap);
    }

    const state = armMap.get(arm);
    if (!state) throw new Error(`Arm state not found for ${arm}`);

    state.pulls += 1;
    state.totalReward += reward;
    state.avgReward = state.totalReward / state.pulls;

    if (converted) {
      state.alpha += 1.0;
    } else {
      state.beta += 1.0;
    }

    armMap.set(arm, state);
    return state;
  }

  /**
   * Retrieves live convergence telemetry for all arms.
   */
  public getConvergenceTelemetry(merchantId: string): Record<string, ArmDistributionState[]> {
    const tiers: CartValueTier[] = ['LOW', 'MID', 'HIGH'];
    const result: Record<string, ArmDistributionState[]> = {};

    for (const tier of tiers) {
      const key = this.makeKey(merchantId, tier);
      const armMap = this.posteriors.get(key);
      if (armMap) {
        result[tier] = Array.from(armMap.values());
      }
    }

    return result;
  }

  /**
   * Decays losing/suboptimal variations iteratively over 24 hours.
   */
  public decayBanditDistributions(merchantId: string, decayFactor = 0.9): void {
    const tiers: CartValueTier[] = ['LOW', 'MID', 'HIGH'];
    for (const tier of tiers) {
      const key = this.makeKey(merchantId, tier);
      const armMap = this.posteriors.get(key);
      if (armMap) {
        for (const state of armMap.values()) {
          state.alpha = Math.max(1.0, 1.0 + (state.alpha - 1.0) * decayFactor);
          state.beta = Math.max(1.0, 1.0 + (state.beta - 1.0) * decayFactor);
        }
      }
    }
  }
}

export const globalThompsonSampler = new ThompsonSamplerMarginGuardian();
