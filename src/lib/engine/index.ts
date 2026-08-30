export { generateSyntheticPayments } from './generateData';
export type { GenerateDataOptions } from './generateData';

export {
  scorePayment,
  scorePaymentBatch,
  CATEGORY_BASE_RATES,
  SCORING_WEIGHTS,
} from './scoreRecovery';
export type {
  ScoringConfig,
  ScoreExplanationFactor,
  PaymentScore,
} from './scoreRecovery';
