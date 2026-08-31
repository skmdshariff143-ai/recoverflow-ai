/**
 * PayBack AI — Blind-Bot vs PayBack AI Replay Dataset & Models.
 *
 * 10 representative failure cases contrasting naive brute-force retry scripts
 * against PayBack AI's bounded, safety-first recovery engine.
 */

export interface ReplayPaymentCase {
  id: string;
  paymentId: string;
  customerId: string;
  amountPaise: number;
  failureCategory: string;
  isOptedOut: boolean;
  attemptsMade: number;
  // Naive Bot simulation
  naiveBot: {
    action: string;
    attemptsUsed: number;
    messagesSent: number;
    recovered: boolean;
    recoveredAmountPaise: number;
    violationType?: 'opt_out_violation' | 'wasted_dead_account' | 'quiet_hours_spam';
    violationDetail?: string;
  };
  // PayBack AI pipeline
  paybackAi: {
    safetyDecision: 'eligible' | 'stopped';
    safetyReason: string;
    probability: number;
    expectedValuePaise: number;
    intervention: 'retry' | 'reminder' | 'both' | 'none';
    attemptsUsed: number;
    messagesSent: number;
    recovered: boolean;
    recoveredAmountPaise: number;
    complianceStatus: '100% Compliant';
  };
}

export const REPLAY_SAMPLE_CASES: ReplayPaymentCase[] = [
  {
    id: 'rep_1',
    paymentId: 'pay_00101',
    customerId: 'cust_optout_99',
    amountPaise: 450000,
    failureCategory: 'insufficient_funds',
    isOptedOut: true,
    attemptsMade: 1,
    naiveBot: {
      action: 'Sent 3 SMS + WhatsApp reminders to opted-out customer',
      attemptsUsed: 3,
      messagesSent: 3,
      recovered: false,
      recoveredAmountPaise: 0,
      violationType: 'opt_out_violation',
      violationDetail: 'CRITICAL: Contacted opted-out customer (DPDP Act Violation)',
    },
    paybackAi: {
      safetyDecision: 'stopped',
      safetyReason: 'Safety Filter: Customer active opt-out flag detected',
      probability: 0.0,
      expectedValuePaise: 0,
      intervention: 'none',
      attemptsUsed: 0,
      messagesSent: 0,
      recovered: false,
      recoveredAmountPaise: 0,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_2',
    paymentId: 'pay_00102',
    customerId: 'cust_dead_01',
    amountPaise: 1200000,
    failureCategory: 'permanent_account_closure',
    isOptedOut: false,
    attemptsMade: 0,
    naiveBot: {
      action: 'Retried closed account 3 times at gateway',
      attemptsUsed: 3,
      messagesSent: 1,
      recovered: false,
      recoveredAmountPaise: 0,
      violationType: 'wasted_dead_account',
      violationDetail: 'WASTED RETRY: Bank confirmed account closed permanently',
    },
    paybackAi: {
      safetyDecision: 'stopped',
      safetyReason: 'Safety Filter: Non-recoverable failure category (Permanent Closure)',
      probability: 0.0,
      expectedValuePaise: 0,
      intervention: 'none',
      attemptsUsed: 0,
      messagesSent: 0,
      recovered: false,
      recoveredAmountPaise: 0,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_3',
    paymentId: 'pay_00103',
    customerId: 'cust_enterprise_05',
    amountPaise: 2500000,
    failureCategory: 'bank_downtime',
    isOptedOut: false,
    attemptsMade: 1,
    naiveBot: {
      action: 'Immediate blind retry during active HDFC outage (Failed)',
      attemptsUsed: 3,
      messagesSent: 2,
      recovered: false,
      recoveredAmountPaise: 0,
      violationType: 'quiet_hours_spam',
      violationDetail: 'FAILED RETRY: Hammered gateway during bank downtime window',
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'High EV Bank Downtime; scheduled after gateway recovery',
      probability: 0.88,
      expectedValuePaise: 2200000,
      intervention: 'retry',
      attemptsUsed: 1,
      messagesSent: 0,
      recovered: true,
      recoveredAmountPaise: 2500000,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_4',
    paymentId: 'pay_00104',
    customerId: 'cust_vip_42',
    amountPaise: 890000,
    failureCategory: 'gateway_degradation',
    isOptedOut: false,
    attemptsMade: 0,
    naiveBot: {
      action: 'Retried instantly without latency backoff',
      attemptsUsed: 3,
      messagesSent: 1,
      recovered: true,
      recoveredAmountPaise: 890000,
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'Gateway transient latency; executed optimal backoff retry',
      probability: 0.92,
      expectedValuePaise: 818800,
      intervention: 'retry',
      attemptsUsed: 1,
      messagesSent: 0,
      recovered: true,
      recoveredAmountPaise: 890000,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_5',
    paymentId: 'pay_00105',
    customerId: 'cust_optout_77',
    amountPaise: 150000,
    failureCategory: 'expired_card',
    isOptedOut: true,
    attemptsMade: 2,
    naiveBot: {
      action: 'Dispatched automated WhatsApp update link to opted-out user',
      attemptsUsed: 3,
      messagesSent: 2,
      recovered: false,
      recoveredAmountPaise: 0,
      violationType: 'opt_out_violation',
      violationDetail: 'CRITICAL: Contacted opted-out user across SMS & WhatsApp',
    },
    paybackAi: {
      safetyDecision: 'stopped',
      safetyReason: 'Safety Filter: Opt-out preference honored',
      probability: 0.0,
      expectedValuePaise: 0,
      intervention: 'none',
      attemptsUsed: 0,
      messagesSent: 0,
      recovered: false,
      recoveredAmountPaise: 0,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_6',
    paymentId: 'pay_00106',
    customerId: 'cust_saas_18',
    amountPaise: 350000,
    failureCategory: 'insufficient_funds',
    isOptedOut: false,
    attemptsMade: 1,
    naiveBot: {
      action: 'Retried on same day without notification',
      attemptsUsed: 3,
      messagesSent: 0,
      recovered: false,
      recoveredAmountPaise: 0,
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'Salary-cycle alignment + gentle masked email notice',
      probability: 0.65,
      expectedValuePaise: 227500,
      intervention: 'both',
      attemptsUsed: 1,
      messagesSent: 1,
      recovered: true,
      recoveredAmountPaise: 350000,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_7',
    paymentId: 'pay_00107',
    customerId: 'cust_sub_88',
    amountPaise: 99000,
    failureCategory: 'customer_cancellation',
    isOptedOut: false,
    attemptsMade: 1,
    naiveBot: {
      action: 'Attempted forced gateway retry on cancelled mandate',
      attemptsUsed: 3,
      messagesSent: 1,
      recovered: false,
      recoveredAmountPaise: 0,
      violationType: 'wasted_dead_account',
      violationDetail: 'WASTED RETRY: Merchant customer explicitly cancelled subscription',
    },
    paybackAi: {
      safetyDecision: 'stopped',
      safetyReason: 'Safety Filter: Non-recoverable (Customer Cancellation)',
      probability: 0.0,
      expectedValuePaise: 0,
      intervention: 'none',
      attemptsUsed: 0,
      messagesSent: 0,
      recovered: false,
      recoveredAmountPaise: 0,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_8',
    paymentId: 'pay_00108',
    customerId: 'cust_highval_33',
    amountPaise: 1800000,
    failureCategory: 'duplicate_attempt',
    isOptedOut: false,
    attemptsMade: 0,
    naiveBot: {
      action: 'Triggered immediate retry causing double charge risk',
      attemptsUsed: 3,
      messagesSent: 1,
      recovered: false,
      recoveredAmountPaise: 0,
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'Idempotency key checked; deferred for settlement verification',
      probability: 0.82,
      expectedValuePaise: 1476000,
      intervention: 'retry',
      attemptsUsed: 1,
      messagesSent: 0,
      recovered: true,
      recoveredAmountPaise: 1800000,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_9',
    paymentId: 'pay_00109',
    customerId: 'cust_fin_12',
    amountPaise: 640000,
    failureCategory: 'auth_failure',
    isOptedOut: false,
    attemptsMade: 1,
    naiveBot: {
      action: '3 blind retries with invalid 2FA token',
      attemptsUsed: 3,
      messagesSent: 1,
      recovered: false,
      recoveredAmountPaise: 0,
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'Sent authenticated 1-click update link to customer',
      probability: 0.70,
      expectedValuePaise: 448000,
      intervention: 'reminder',
      attemptsUsed: 0,
      messagesSent: 1,
      recovered: true,
      recoveredAmountPaise: 640000,
      complianceStatus: '100% Compliant',
    },
  },
  {
    id: 'rep_10',
    paymentId: 'pay_00110',
    customerId: 'cust_retail_55',
    amountPaise: 220000,
    failureCategory: 'invalid_mandate',
    isOptedOut: false,
    attemptsMade: 2,
    naiveBot: {
      action: 'Retried invalid mandate 3x ignoring failure code',
      attemptsUsed: 3,
      messagesSent: 2,
      recovered: false,
      recoveredAmountPaise: 0,
    },
    paybackAi: {
      safetyDecision: 'eligible',
      safetyReason: 'Sent mandate re-authorization notification',
      probability: 0.58,
      expectedValuePaise: 127600,
      intervention: 'reminder',
      attemptsUsed: 0,
      messagesSent: 1,
      recovered: true,
      recoveredAmountPaise: 220000,
      complianceStatus: '100% Compliant',
    },
  },
];

export interface ReplayScorecard {
  totalAttempts: number;
  totalMessages: number;
  safetyViolations: number;
  revenueRecoveredPaise: number;
  totalAtRiskPaise: number;
  recoveryRate: number;
}

export function computeReplayScorecards(cases: ReplayPaymentCase[]) {
  const totalAtRiskPaise = cases.reduce((acc, c) => acc + c.amountPaise, 0);

  const naiveScorecard: ReplayScorecard = {
    totalAttempts: cases.reduce((acc, c) => acc + c.naiveBot.attemptsUsed, 0),
    totalMessages: cases.reduce((acc, c) => acc + c.naiveBot.messagesSent, 0),
    safetyViolations: cases.filter((c) => !!c.naiveBot.violationType).length,
    revenueRecoveredPaise: cases.reduce((acc, c) => acc + c.naiveBot.recoveredAmountPaise, 0),
    totalAtRiskPaise,
    recoveryRate: Math.round(
      (cases.reduce((acc, c) => acc + c.naiveBot.recoveredAmountPaise, 0) / totalAtRiskPaise) * 100,
    ),
  };

  const paybackScorecard: ReplayScorecard = {
    totalAttempts: cases.reduce((acc, c) => acc + c.paybackAi.attemptsUsed, 0),
    totalMessages: cases.reduce((acc, c) => acc + c.paybackAi.messagesSent, 0),
    safetyViolations: 0,
    revenueRecoveredPaise: cases.reduce((acc, c) => acc + c.paybackAi.recoveredAmountPaise, 0),
    totalAtRiskPaise,
    recoveryRate: Math.round(
      (cases.reduce((acc, c) => acc + c.paybackAi.recoveredAmountPaise, 0) / totalAtRiskPaise) * 100,
    ),
  };

  return { naiveScorecard, paybackScorecard };
}
