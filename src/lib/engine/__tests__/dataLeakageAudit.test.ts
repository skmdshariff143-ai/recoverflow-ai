import { describe, it, expect } from 'vitest';
import { extractFeatureVector, splitDatasetByCustomer } from '../trainModel';
import { generateSyntheticPayments } from '../generateData';
import type { FailedPayment } from '@/types';

describe('ML Data Leakage Prevention & Customer-Level Dataset Partitioning', () => {
  it('Requirement: Feature extractor contains strictly prediction-time features and cannot receive outcome fields', () => {
    const payment = generateSyntheticPayments({ seed: 101, totalRecords: 10 })[0];

    // Attempt to inject post-intervention fields
    const contaminatedPayment = {
      ...payment,
      recovered: true,
      settledAmountPaise: 500000,
      postInterventionStatus: 'captured',
      futureOutcome: 1,
    } as unknown as FailedPayment;

    const { features } = extractFeatureVector(contaminatedPayment);

    // Assert strictly pre-intervention feature keys only
    const allowedKeys = [
      'category_base_rate',
      'on_time_payment_rate',
      'broken_promises_penalty',
      'recency_decay',
      'tenure_fraction',
      'attempt_penalty',
      'past_recovery_ratio',
    ];

    expect(Object.keys(features).sort()).toEqual(allowedKeys.sort());

    // Assert all values are within normalized mathematical bounds [ -1.0, 1.0 ]
    for (const val of Object.values(features)) {
      expect(typeof val).toBe('number');
      expect(isNaN(val)).toBe(false);
      expect(val).toBeGreaterThanOrEqual(-1.0);
      expect(val).toBeLessThanOrEqual(1.0);
    }
  });

  it('Requirement: Customer-level splits guarantee zero customer ID overlap between Train, Validation, and Test sets', () => {
    const payments = generateSyntheticPayments({ seed: 202, totalRecords: 200 });
    const { train, val, test } = splitDatasetByCustomer(payments, { train: 0.7, val: 0.15, test: 0.15 });

    expect(train.length + val.length + test.length).toBe(payments.length);
    expect(train.length).toBeGreaterThan(0);
    expect(val.length).toBeGreaterThan(0);
    expect(test.length).toBeGreaterThan(0);

    const trainCustomers = new Set(train.map((p) => p.customer_id));
    const valCustomers = new Set(val.map((p) => p.customer_id));
    const testCustomers = new Set(test.map((p) => p.customer_id));

    // Assert disjoint sets
    for (const cust of trainCustomers) {
      expect(valCustomers.has(cust)).toBe(false);
      expect(testCustomers.has(cust)).toBe(false);
    }
    for (const cust of valCustomers) {
      expect(testCustomers.has(cust)).toBe(false);
    }
  });
});
