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
 *  - Model Comparison (Heuristic v1.0.0 vs Trained Logistic v1.1.0)
 */

import type {
  ExecutedItem,
  CalibrationReport,
  CategoryCalibrationMetric,
  BinnedCalibrationMetric,
  FailedPayment,
  PipelineOptions,
  ModelComparisonReport,
} from '@recoverflow/core';
import { FAILURE_CATEGORIES } from '@recoverflow/core';
import { processRecoveryPipeline } from '@recoverflow/core';
import { executeBatchInterventions } from '@recoverflow/core';

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
      predicted_recovery_rate: 0,
      overall_actual_rate: 0,
      actual_recovery_rate: 0,
      overall_calibration_error: 0,
      brier_score: 0,
      overall_brier_score: 0,
      mean_category_calibration_error: 0,
      category_metrics: [],
      by_category: [],
      binned_metrics: [],
      by_bin: [],
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
  const brierSum = budgeted.reduce((sum, item) => {
    const outcome = item.execution_status === 'recovered' ? 1 : 0;
    return sum + Math.pow(item.score.recovery_probability - outcome, 2);
  }, 0);
  const brierScore = round4(brierSum / budgeted.length);

  // 3. Category Breakdown Metrics
  const categoryMetrics: CategoryCalibrationMetric[] = [];
  let categoryErrorSum = 0;
  let activeCategoryCount = 0;

  for (const cat of FAILURE_CATEGORIES) {
    const catItems = budgeted.filter(
      (item) => item.payment.failure_category === cat,
    );
    if (catItems.length === 0) continue;

    activeCategoryCount++;
    const catPredictedSum = catItems.reduce(
      (sum, item) => sum + item.score.recovery_probability,
      0,
    );
    const catRecoveredCount = catItems.filter(
      (item) => item.execution_status === 'recovered',
    ).length;

    const predRate = round4(catPredictedSum / catItems.length);
    const actRate = round4(catRecoveredCount / catItems.length);
    const calibError = round4(Math.abs(predRate - actRate));
    categoryErrorSum += calibError;

    const catEV = round2(
      catItems.reduce((sum, item) => sum + item.score.expected_value, 0),
    );
    const catRecoveredAmount = round2(
      catItems.reduce((sum, item) => sum + item.recovered_amount, 0),
    );

    categoryMetrics.push({
      category: cat,
      budgeted_count: catItems.length,
      recovered_count: catRecoveredCount,
      predicted_recovery_rate: predRate,
      actual_recovery_rate: actRate,
      calibration_error: calibError,
      expected_value: catEV,
      recovered_amount: catRecoveredAmount,
    });
  }

  const meanCategoryError =
    activeCategoryCount > 0
      ? round4(categoryErrorSum / activeCategoryCount)
      : 0;

  // 4. 5-Bin Reliability Diagram Partitioning
  const bins = [
    { min: 0.0, max: 0.2, label: '0.00 – 0.20' },
    { min: 0.2, max: 0.4, label: '0.20 – 0.40' },
    { min: 0.4, max: 0.6, label: '0.40 – 0.60' },
    { min: 0.6, max: 0.8, label: '0.60 – 0.80' },
    { min: 0.8, max: 1.01, label: '0.80 – 1.00' },
  ];

  const binnedMetrics: BinnedCalibrationMetric[] = bins.map((bin, idx) => {
    const inBin = budgeted.filter((item) => {
      const p = item.score.recovery_probability;
      return p >= bin.min && (idx === 4 ? p <= 1.0 : p < bin.max);
    });

    if (inBin.length === 0) {
      return {
        bin_index: idx + 1,
        bin_label: bin.label,
        min_prob: bin.min,
        max_prob: bin.max,
        sample_count: 0,
        avg_predicted_prob: round4((bin.min + Math.min(1.0, bin.max)) / 2),
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
    predicted_recovery_rate: overallPredictedRate,
    overall_actual_rate: overallActualRate,
    actual_recovery_rate: overallActualRate,
    overall_calibration_error: overallCalibrationError,
    brier_score: brierScore,
    overall_brier_score: brierScore,
    mean_category_calibration_error: meanCategoryError,
    category_metrics: categoryMetrics,
    by_category: categoryMetrics,
    binned_metrics: binnedMetrics,
    by_bin: binnedMetrics,
  };
}

/**
 * Compare calibration and performance between the heuristic baseline and the trained logistic model.
 */
export function compareModelCalibration(
  payments: FailedPayment[],
  options: PipelineOptions = {},
): ModelComparisonReport {
  // 1. Heuristic Model Evaluation
  const heuristicPipeline = processRecoveryPipeline(payments, {
    ...options,
    scoringModel: 'heuristic',
  });
  const heuristicExecuted = executeBatchInterventions(heuristicPipeline.items, options);
  const heuristicCalib = computeCalibrationReport(heuristicExecuted);
  const heuristicRecoveredRev = Number(
    heuristicExecuted.reduce((s, i) => s + i.recovered_amount, 0).toFixed(2),
  );
  const heuristicRecoveredCount = heuristicExecuted.filter(
    (i) => i.execution_status === 'recovered',
  ).length;

  // 2. Trained Logistic Model Evaluation
  const trainedPipeline = processRecoveryPipeline(payments, {
    ...options,
    scoringModel: 'trained_logistic',
  });
  const trainedExecuted = executeBatchInterventions(trainedPipeline.items, options);
  const trainedCalib = computeCalibrationReport(trainedExecuted);
  const trainedRecoveredRev = Number(
    trainedExecuted.reduce((s, i) => s + i.recovered_amount, 0).toFixed(2),
  );
  const trainedRecoveredCount = trainedExecuted.filter(
    (i) => i.execution_status === 'recovered',
  ).length;

  const brierDiff = heuristicCalib.brier_score - trainedCalib.brier_score;
  const brierImprovementPercent =
    heuristicCalib.brier_score > 0
      ? round2((brierDiff / heuristicCalib.brier_score) * 100)
      : 0;

  const calibrationErrorDelta = round4(
    heuristicCalib.overall_calibration_error - trainedCalib.overall_calibration_error,
  );

  return {
    heuristic: {
      modelVersion: 'v1.0.0-heuristic',
      brierScore: heuristicCalib.brier_score,
      calibrationError: heuristicCalib.overall_calibration_error,
      overallCalibrationError: heuristicCalib.overall_calibration_error,
      predictedRecoveryRate: heuristicCalib.overall_predicted_rate,
      actualRecoveryRate: heuristicCalib.overall_actual_rate,
      recoveredRevenue: heuristicRecoveredRev,
      totalRecoveredRevenue: heuristicRecoveredRev,
      recoveredCount: heuristicRecoveredCount,
    },
    trainedLogistic: {
      modelVersion: 'v1.1.0-logistic-calibrated',
      brierScore: trainedCalib.brier_score,
      calibrationError: trainedCalib.overall_calibration_error,
      overallCalibrationError: trainedCalib.overall_calibration_error,
      predictedRecoveryRate: trainedCalib.overall_predicted_rate,
      actualRecoveryRate: trainedCalib.overall_actual_rate,
      recoveredRevenue: trainedRecoveredRev,
      totalRecoveredRevenue: trainedRecoveredRev,
      recoveredCount: trainedRecoveredCount,
    },
    brierImprovementPercent,
    calibrationErrorDelta,
  };
}

/**
 * Expected Calibration Error (ECE) across B equal-width probability bins.
 * ECE = sum_{b=1}^B (|B_b| / N) * |acc(B_b) - conf(B_b)|
 */
export function computeECE(
  predictions: number[],
  outcomes: number[],
  numBins: number = 10,
): { ece: number; mce: number; bins: Array<{ bin: string; count: number; avgPred: number; avgActual: number; gap: number }> } {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return { ece: 0, mce: 0, bins: [] };
  }

  const N = predictions.length;
  const binWidth = 1.0 / numBins;
  const binData: Array<{ count: number; predSum: number; actualSum: number; min: number; max: number; label: string }> = [];

  for (let b = 0; b < numBins; b++) {
    const min = b * binWidth;
    const max = (b + 1) * binWidth;
    binData.push({
      count: 0,
      predSum: 0,
      actualSum: 0,
      min,
      max,
      label: `${min.toFixed(2)}–${max.toFixed(2)}`,
    });
  }

  for (let i = 0; i < N; i++) {
    const p = Math.max(0, Math.min(1, predictions[i]));
    const y = outcomes[i] ? 1 : 0;
    const bIdx = Math.min(numBins - 1, Math.floor(p / binWidth));
    binData[bIdx].count += 1;
    binData[bIdx].predSum += p;
    binData[bIdx].actualSum += y;
  }

  let weightedGapSum = 0;
  let mce = 0;
  const outputBins: Array<{ bin: string; count: number; avgPred: number; avgActual: number; gap: number }> = [];

  for (const b of binData) {
    if (b.count === 0) {
      outputBins.push({
        bin: b.label,
        count: 0,
        avgPred: round4((b.min + b.max) / 2),
        avgActual: 0,
        gap: 0,
      });
      continue;
    }
    const avgPred = b.predSum / b.count;
    const avgActual = b.actualSum / b.count;
    const gap = Math.abs(avgPred - avgActual);
    weightedGapSum += (b.count / N) * gap;
    if (gap > mce) mce = gap;

    outputBins.push({
      bin: b.label,
      count: b.count,
      avgPred: round4(avgPred),
      avgActual: round4(avgActual),
      gap: round4(gap),
    });
  }

  return {
    ece: round4(weightedGapSum),
    mce: round4(mce),
    bins: outputBins,
  };
}

/**
 * Binary Cross-Entropy / Log Loss calculation with numerical stability clamping.
 */
export function computeLogLoss(predictions: number[], outcomes: number[], eps = 1e-15): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) return 0;
  const N = predictions.length;
  let lossSum = 0;

  for (let i = 0; i < N; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]));
    const y = outcomes[i] ? 1 : 0;
    lossSum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }

  return round4(lossSum / N);
}

/**
 * Computes calibration slope and intercept via linear regression over predicted vs observed.
 */
export function computeCalibrationSlopeAndIntercept(
  predictions: number[],
  outcomes: number[],
): { slope: number; intercept: number } {
  if (predictions.length === 0 || predictions.length !== outcomes.length) {
    return { slope: 1, intercept: 0 };
  }

  const N = predictions.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < N; i++) {
    const x = predictions[i];
    const y = outcomes[i] ? 1 : 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const meanX = sumX / N;
  const meanY = sumY / N;
  const denominator = sumXX - N * meanX * meanX;

  if (Math.abs(denominator) < 1e-10) {
    return { slope: 1, intercept: round4(meanY - meanX) };
  }

  const slope = (sumXY - N * meanX * meanY) / denominator;
  const intercept = meanY - slope * meanX;

  return {
    slope: round4(slope),
    intercept: round4(intercept),
  };
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
