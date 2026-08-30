/**
 * PayBack AI — Calibration & Probabilistic Validation Engine.
 *
 * Compares predicted recovery probabilities against empirical outcomes
 * to evaluate whether the scoring model is statistically calibrated or guesswork.
 *
 * Metrics Computed:
 *  - Overall Predicted vs Actual Recovery Rate
 *  - Brier Score (Proper scoring rule for probability calibration, lower is better, 0 = perfect)
 *  - Per-Category Predicted vs Actual Recovery Table
 *  - 5-Bin Reliability Diagram Metrics (binned by predicted probability)
 *  - Mean Absolute Calibration Error (MACE)
 */

import type {
  ExecutedItem,
  CalibrationReport,
  CategoryCalibrationMetric,
  BinnedCalibrationMetric,
  FailureCategory,
} from '@/types';
import { FAILURE_CATEGORIES } from '@/types';

export function computeCalibrationReport(executedItems: ExecutedItem[]): CalibrationReport {
  // Focus calibration strictly on items that were allocated budget and attempted
  const budgeted = executedItems.filter(
    (i) =>
      i.status === 'budgeted' ||
      i.dispute_signaled ||
      (i.rank !== undefined && i.final_attempt_count > i.payment.attempt_count),
  );

  if (budgeted.length === 0) {
    return {
      overall_predicted_rate: 0,
      overall_actual_rate: 0,
      overall_calibration_error: 0,
      brier_score: 0,
      mean_category_calibration_error: 0,
      category_metrics: [],
      binned_metrics: [],
    };
  }

  // 1. Overall Metrics
  const totalPredicted = budgeted.reduce(
    (sum, i) => sum + i.score.recovery_probability,
    0,
  );
  const totalRecovered = budgeted.filter(
    (i) => i.execution_status === 'recovered',
  ).length;

  const overallPredictedRate = round4(totalPredicted / budgeted.length);
  const overallActualRate = round4(totalRecovered / budgeted.length);
  const overallCalibrationError = round4(
    Math.abs(overallPredictedRate - overallActualRate),
  );

  // 2. Brier Score = (1/N) * sum((prob - actual)^2)
  const brierSum = budgeted.reduce((sum, i) => {
    const actual = i.execution_status === 'recovered' ? 1 : 0;
    const diff = i.score.recovery_probability - actual;
    return sum + diff * diff;
  }, 0);
  const brierScore = round4(brierSum / budgeted.length);

  // 3. Per-Category Breakdown
  const categoryMetrics: CategoryCalibrationMetric[] = [];
  let categoryErrorSum = 0;
  let categoryWithSamplesCount = 0;

  for (const cat of FAILURE_CATEGORIES) {
    const catItems = budgeted.filter((i) => i.payment.failure_category === cat);
    if (catItems.length === 0) continue;

    const catPredictedSum = catItems.reduce(
      (sum, i) => sum + i.score.recovery_probability,
      0,
    );
    const catRecoveredCount = catItems.filter(
      (i) => i.execution_status === 'recovered',
    ).length;

    const predRate = round4(catPredictedSum / catItems.length);
    const actRate = round4(catRecoveredCount / catItems.length);
    const error = round4(Math.abs(predRate - actRate));

    const expectedValSum = round2(
      catItems.reduce((sum, i) => sum + i.score.expected_value, 0),
    );
    const recoveredAmtSum = round2(
      catItems.reduce((sum, i) => sum + i.recovered_amount, 0),
    );

    categoryMetrics.push({
      category: cat,
      budgeted_count: catItems.length,
      recovered_count: catRecoveredCount,
      predicted_recovery_rate: predRate,
      actual_recovery_rate: actRate,
      calibration_error: error,
      expected_value: expectedValSum,
      recovered_amount: recoveredAmtSum,
    });

    categoryErrorSum += error;
    categoryWithSamplesCount++;
  }

  // Sort categories by budgeted count descending, then category name
  categoryMetrics.sort((a, b) => b.budgeted_count - a.budgeted_count);

  const meanCategoryError =
    categoryWithSamplesCount > 0
      ? round4(categoryErrorSum / categoryWithSamplesCount)
      : 0;

  // 4. 5-Bin Reliability Diagram Metrics (0.00 to 1.00)
  const binRanges: Array<{ min: number; max: number; label: string }> = [
    { min: 0.0, max: 0.2, label: '0.00 – 0.20' },
    { min: 0.2, max: 0.4, label: '0.20 – 0.40' },
    { min: 0.4, max: 0.6, label: '0.40 – 0.60' },
    { min: 0.6, max: 0.8, label: '0.60 – 0.80' },
    { min: 0.8, max: 1.0, label: '0.80 – 1.00' },
  ];

  const binnedMetrics: BinnedCalibrationMetric[] = binRanges.map((bin, idx) => {
    const inBin = budgeted.filter((i) => {
      const p = i.score.recovery_probability;
      if (idx === binRanges.length - 1) {
        return p >= bin.min && p <= bin.max;
      }
      return p >= bin.min && p < bin.max;
    });

    if (inBin.length === 0) {
      return {
        bin_index: idx + 1,
        bin_label: bin.label,
        min_prob: bin.min,
        max_prob: bin.max,
        sample_count: 0,
        avg_predicted_prob: round4((bin.min + bin.max) / 2),
        actual_recovery_rate: 0,
        calibration_error: 0,
      };
    }

    const avgPred = round4(
      inBin.reduce((s, i) => s + i.score.recovery_probability, 0) / inBin.length,
    );
    const recoveredInBin = inBin.filter(
      (i) => i.execution_status === 'recovered',
    ).length;
    const actRate = round4(recoveredInBin / inBin.length);
    const calibError = round4(Math.abs(avgPred - actRate));

    return {
      bin_index: idx + 1,
      bin_label: bin.label,
      min_prob: bin.min,
      max_prob: bin.max,
      sample_count: inBin.length,
      avg_predicted_prob: avgPred,
      actual_recovery_rate: actRate,
      calibration_error: calibError,
    };
  });

  return {
    overall_predicted_rate: overallPredictedRate,
    overall_actual_rate: overallActualRate,
    overall_calibration_error: overallCalibrationError,
    brier_score: brierScore,
    mean_category_calibration_error: meanCategoryError,
    category_metrics: categoryMetrics,
    binned_metrics: binnedMetrics,
  };
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
