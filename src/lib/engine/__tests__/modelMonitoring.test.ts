import { describe, it, expect } from 'vitest';
import { ModelDriftMonitor } from '../modelMonitoring';

describe('Model Drift Monitoring & Automatic Fallback Signaling', () => {
  it('Evaluates normal calibration health when predictions match outcomes', () => {
    const monitor = new ModelDriftMonitor({ baselineRate: 0.5 });
    const preds = [0.48, 0.52, 0.50, 0.49, 0.51, 0.50, 0.48, 0.52, 0.50, 0.50, 0.48, 0.52, 0.50, 0.49, 0.51, 0.50, 0.48, 0.52, 0.50, 0.50];
    const acts = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];

    const report = monitor.evaluateCohort(preds, acts);
    expect(report.status).toBe('NORMAL');
    expect(report.requiresDeterministicFallback).toBe(false);
    expect(report.warnings.length).toBe(0);
  });

  it('Signals FALLBACK_REQUIRED when extreme distribution drift or ECE occurs', () => {
    const monitor = new ModelDriftMonitor({ baselineRate: 0.45, maxEceThreshold: 0.15, minSamplesForAlert: 10 });
    // Model predicts 0.95, but actual outcome is 0.05
    const preds = Array(30).fill(0.95);
    const acts = Array(30).fill(0);

    const report = monitor.evaluateCohort(preds, acts);
    expect(report.status).toBe('FALLBACK_REQUIRED');
    expect(report.requiresDeterministicFallback).toBe(true);
    expect(report.warnings[0]).toContain('Severe model drift detected');
  });
});
