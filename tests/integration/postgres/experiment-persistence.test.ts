import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { setupPostgresTestHarness, teardownPostgresTestHarness } from '../../../packages/core/src/data/postgresTestHarness';
import { PrismaDatabase } from '../../../packages/core/src/data/PrismaDatabase';

describe('RecoverFlow AI — Experiment Persistence & Sticky Assignments (PostgreSQL 16)', () => {
  let db: PrismaDatabase;

  beforeAll(async () => {
    const harness = await setupPostgresTestHarness();
    db = harness.db;
  });

  afterAll(async () => {
    await teardownPostgresTestHarness();
  });

  it('enforces sticky assignments across 25 concurrent assignment calls', async () => {
    const merchantId = `merch_exp_${crypto.randomBytes(4).toString('hex')}`;

    await db.createOrUpdateMerchant({
      id: merchantId,
      storeUrl: `https://${merchantId}.myshopify.com`,
      storeName: 'Experiment Store',
      webhookSecret: 'sec_exp',
      brandToneGuidelines: 'Friendly',
      brandVoiceCasualVsFormal: 0.3,
      brandVoiceUrgencyVsGentle: 0.4,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create Experiment and Variants
    const experiment = await db.prisma.experiment.create({
      data: {
        merchantId,
        name: 'Dynamic Discount vs VIP Concierge MAB',
        status: 'ACTIVE',
        variants: {
          create: [
            { key: 'arm_control', name: 'Control Static Reminder', isControl: true, weight: 1.0 },
            { key: 'arm_dynamic_mab', name: 'Thompson Sampling Dynamic', isControl: false, weight: 1.0 },
            { key: 'arm_vip_concierge', name: 'VIP Concierge Assist', isControl: false, weight: 1.0 },
          ],
        },
      },
      include: { variants: true },
    });

    const subjectKey = `customer_phone_+919876543210`;
    const initialVariant = experiment.variants[0].id;
    const alternateVariant = experiment.variants[1].id;

    // Initial assignment
    await db.recordExperimentAssignment({
      experimentId: experiment.id,
      merchantId,
      subjectKey,
      variantId: initialVariant,
    });

    // 25 concurrent assignment attempts trying to re-assign to alternate variant
    const attempts = Array.from({ length: 25 }, () =>
      db.recordExperimentAssignment({
        experimentId: experiment.id,
        merchantId,
        subjectKey,
        variantId: alternateVariant,
      })
    );

    await Promise.all(attempts);

    // Verify assignment remained strictly sticky to initialVariant
    const assignment = await db.prisma.experimentAssignment.findUnique({
      where: {
        experimentId_subjectKey: {
          experimentId: experiment.id,
          subjectKey,
        },
      },
    });

    expect(assignment).not.toBeNull();
    expect(assignment?.variantId).toBe(initialVariant);
  });

  it('computes accurate observed metrics from recorded exposures and outcomes', async () => {
    const merchantId = `merch_metrics_${crypto.randomBytes(4).toString('hex')}`;

    await db.createOrUpdateMerchant({
      id: merchantId,
      storeUrl: `https://${merchantId}.myshopify.com`,
      storeName: 'Metrics Store',
      webhookSecret: 'sec_metrics',
      brandToneGuidelines: 'Direct',
      brandVoiceCasualVsFormal: 0.5,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 15,
      minMarginPercentage: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const experiment = await db.prisma.experiment.create({
      data: {
        merchantId,
        name: 'Conversion Lift Test',
        status: 'ACTIVE',
        variants: {
          create: [
            { key: 'arm_control', name: 'Control', isControl: true },
            { key: 'arm_treatment', name: 'Treatment MAB', isControl: false },
          ],
        },
      },
      include: { variants: true },
    });

    const controlId = experiment.variants.find((v) => v.isControl)!.id;
    const treatmentId = experiment.variants.find((v) => !v.isControl)!.id;

    // Record 10 exposures for control with 2 conversions
    for (let i = 0; i < 10; i++) {
      const subjectKey = `subj_ctrl_${i}`;
      await db.recordExperimentExposure({ experimentId: experiment.id, merchantId, subjectKey, variantId: controlId });
      if (i < 2) {
        await db.recordExperimentOutcome({
          experimentId: experiment.id,
          merchantId,
          subjectKey,
          variantId: controlId,
          isConverted: true,
          grossRecoveredPaise: 100000n,
          netMarginPaise: 80000n,
        });
      }
    }

    // Record 10 exposures for treatment with 5 conversions
    for (let i = 0; i < 10; i++) {
      const subjectKey = `subj_treat_${i}`;
      await db.recordExperimentExposure({ experimentId: experiment.id, merchantId, subjectKey, variantId: treatmentId });
      if (i < 5) {
        await db.recordExperimentOutcome({
          experimentId: experiment.id,
          merchantId,
          subjectKey,
          variantId: treatmentId,
          isConverted: true,
          grossRecoveredPaise: 150000n,
          netMarginPaise: 120000n,
        });
      }
    }

    const metrics = await db.getExperimentMetrics(merchantId, experiment.id);
    expect(metrics).toHaveLength(2);

    const controlMetrics = metrics.find((m) => m.armId === 'arm_control');
    const treatMetrics = metrics.find((m) => m.armId === 'arm_treatment');

    expect(controlMetrics?.impressions).toBe(10);
    expect(controlMetrics?.conversions).toBe(2);
    expect(controlMetrics?.conversionRateBps).toBe(2000); // 20.00%
    expect(controlMetrics?.grossRecoveredPaise).toBe(200000);

    expect(treatMetrics?.impressions).toBe(10);
    expect(treatMetrics?.conversions).toBe(5);
    expect(treatMetrics?.conversionRateBps).toBe(5000); // 50.00%
    expect(treatMetrics?.grossRecoveredPaise).toBe(750000);
    expect(treatMetrics?.liftOverBaselineBps).toBe(3000); // +30.00% lift over control
  });
});
