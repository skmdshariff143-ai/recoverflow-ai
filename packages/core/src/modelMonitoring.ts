/**
 * PayBack AI — Model Governance & Drift Monitoring Engine.
 *
 * Tracks live distribution statistics, prediction drift, and calibration health.
 * Automatically signals alert levels (NORMAL, WARNING, INVESTIGATE, FALLBACK_TRIGGERED)
 * when statistical divergence exceeds tolerance bounds.
 */

import { computeECE, computeLogLoss } from './calibration';

export type DriftStatus = 'NORMAL' | 'WARNING' | 'INVESTIGATE' | 'FALLBACK_REQUIRED';

export interface ModelDriftReport {
  status: DriftStatus;
  sampleCount: number;
  baselineRecoveryRate: number;
  currentPredictedRate: number;
  currentObservedRate: number;
  predictionShiftDelta: number;
  calibrationError: number;
  ece: number;
  logLoss: number;
  requiresDeterministicFallback: boolean;
  warnings: string[];
}

export interface DriftMonitorOptions {
  baselineRate?: number;
  maxPredictionShift?: number;
  maxEceThreshold?: number;
  minSamplesForAlert?: number;
}

export class ModelDriftMonitor {
  private baselineRate: number;
  private maxPredictionShift: number;
  private maxEceThreshold: number;
  private minSamples: number;

  constructor(options: DriftMonitorOptions = {}) {
    this.baselineRate = options.baselineRate ?? 0.45;
    this.maxPredictionShift = options.maxPredictionShift ?? 0.15; // 15% shift tolerance
    this.maxEceThreshold = options.maxEceThreshold ?? 0.18;
    this.minSamples = options.minSamplesForAlert ?? 20;
  }

  evaluateCohort(predictions: number[], outcomes: number[]): ModelDriftReport {
    const N = predictions.length;
    if (N === 0) {
      return {
        status: 'NORMAL',
        sampleCount: 0,
        baselineRecoveryRate: this.baselineRate,
        currentPredictedRate: 0,
        currentObservedRate: 0,
        predictionShiftDelta: 0,
        calibrationError: 0,
        ece: 0,
        logLoss: 0,
        requiresDeterministicFallback: false,
        warnings: [],
      };
    }

    const avgPred = predictions.reduce((s, p) => s + p, 0) / N;
    const avgObs = outcomes.reduce((s, y) => s + (y ? 1 : 0), 0) / N;
    const predShift = Math.abs(avgPred - this.baselineRate);
    const calibError = Math.abs(avgPred - avgObs);

    const { ece } = computeECE(predictions, outcomes, 10);
    const logLoss = computeLogLoss(predictions, outcomes);

    const warnings: string[] = [];
    let status: DriftStatus = 'NORMAL';
    let requiresFallback = false;

    if (N >= this.minSamples) {
      if (predShift > this.maxPredictionShift * 1.5 || ece > this.maxEceThreshold * 1.5) {
        status = 'FALLBACK_REQUIRED';
        requiresFallback = true;
        warnings.push(`Severe model drift detected: ECE ${(ece * 100).toFixed(1)}% exceeds critical threshold. Reverting to rule-based fallback.`);
      } else if (predShift > this.maxPredictionShift || ece > this.maxEceThreshold) {
        status = 'INVESTIGATE';
        warnings.push(`Moderate prediction distribution shift: delta ${(predShift * 100).toFixed(1)}% vs baseline.`);
      } else if (calibError > 0.10) {
        status = 'WARNING';
        warnings.push(`Mild calibration divergence: ${(calibError * 100).toFixed(1)}% gap.`);
      }
    }

    return {
      status,
      sampleCount: N,
      baselineRecoveryRate: this.baselineRate,
      currentPredictedRate: Number(avgPred.toFixed(4)),
      currentObservedRate: Number(avgObs.toFixed(4)),
      predictionShiftDelta: Number(predShift.toFixed(4)),
      calibrationError: Number(calibError.toFixed(4)),
      ece: Number(ece.toFixed(4)),
      logLoss,
      requiresDeterministicFallback: requiresFallback,
      warnings,
    };
  }
}

export const defaultModelMonitor = new ModelDriftMonitor();
