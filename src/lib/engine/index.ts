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

export {
  checkSafetyRules,
  MAX_RECOVERY_ATTEMPTS,
  NON_RECOVERABLE_CATEGORIES,
} from './safetyFilter';
export type { SafetyCheckResult } from './safetyFilter';

export {
  isInsideQuietHours,
  calculateNextContactTime,
  getLocalTimeParts,
} from './quietHours';

export {
  evaluateApprovalStatus,
  HIGH_VALUE_AUTO_APPROVE_EV_THRESHOLD_PAISE,
} from './approvalGate';
export type { ApprovalEvaluation, ApprovalOptions } from './approvalGate';

export { selectIntervention } from './interventions';

export {
  processRecoveryPipeline,
  DEFAULT_RECOVERY_BUDGET,
} from './rankAndAllocate';

export {
  executeBatchInterventions,
  DEFAULT_SIMULATION_SEED,
  DEFAULT_DISPUTE_RATE,
} from './executeIntervention';

export { computeCalibrationReport } from './calibration';

export { runRecoveryBatch } from './runBatch';

export {
  generateAuditTrail,
  exportAuditTrailToCSV,
} from './auditTrail';
export type { AuditRecord } from './auditTrail';
