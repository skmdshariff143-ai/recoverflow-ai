/**
 * PayBack AI — Cross-Request Outcome Consistency Verification Script.
 *
 * Verifies that execution and status polling endpoints return 100% consistent
 * normalized synthetic outcomes across sequential and concurrent requests.
 *
 * Usage:
 *   npx tsx scripts/verify-outcome-consistency.ts --base-url http://localhost:3000
 *   npx tsx scripts/verify-outcome-consistency.ts --base-url https://recoverflow-ai-kohl.vercel.app
 */

import fs from 'fs';
import path from 'path';

interface ConsistencyTestResult {
  attemptIndex: number;
  paymentId: string;
  amountPaise: number;
  transactionReference: string;
  executionStatus: string;
  outcomeStatus: string;
  evidenceClass: string;
  syntheticOutcomeAmountPaise: number;
  liveSettledAmountPaise: number;
  immediateQuery: {
    status: string;
    outcomeStatus: string;
    evidenceClass: string;
    syntheticOutcomeAmountPaise: number;
    liveSettledAmountPaise: number;
  };
  delayedQuery: {
    status: string;
    outcomeStatus: string;
    evidenceClass: string;
    syntheticOutcomeAmountPaise: number;
    liveSettledAmountPaise: number;
  };
  concurrentQueriesPassed: boolean;
  tamperTestPassed: boolean;
  consistent: boolean;
}

const args = process.argv.slice(2);
let baseUrl = 'http://localhost:3000';
const baseUrlIndex = args.indexOf('--base-url');
if (baseUrlIndex !== -1 && args[baseUrlIndex + 1]) {
  baseUrl = args[baseUrlIndex + 1].replace(/\/+$/, '');
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runConsistencyVerification() {
  console.log(`\n════════════════════════════════════════════════════════════════════`);
  console.log(` PayBack AI — Execution & Observation Consistency Audit`);
  console.log(` Target Host: ${baseUrl}`);
  console.log(`════════════════════════════════════════════════════════════════════\n`);

  const results: ConsistencyTestResult[] = [];
  let contradictionCount = 0;

  for (let i = 1; i <= 5; i++) {
    const paymentId = `pay_verify_consist_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const idempotencyKey = `idemp_consist_${i}_${Date.now()}`;
    const amountPaise = (i * 2500 + 1000) * 100; // ₹3500, ₹6000, etc.

    console.log(`[Test ${i}/5] Executing simulator recovery for ${paymentId} (₹${(amountPaise / 100).toLocaleString('en-IN')})...`);

    // 1. Execute recovery
    const execRes = await fetch(`${baseUrl}/api/recovery/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-recovery-adapter': 'deterministic_simulator',
      },
      body: JSON.stringify({
        paymentId,
        customerId: `cust_${i}`,
        customerName: `Customer ${i}`,
        customerEmail: `customer${i}@merchant.in`,
        amountPaise,
        currency: 'INR',
        intervention: 'retry',
        attemptCycle: 1,
        idempotencyKey,
      }),
    });

    if (!execRes.ok) {
      console.error(`  ❌ Execution HTTP ${execRes.status}`);
      contradictionCount++;
      continue;
    }

    const execData = await execRes.json();
    const receipt = execData.receipt || {};
    const ref = receipt.transactionReference;

    if (!ref) {
      console.error(`  ❌ Missing transactionReference in receipt`);
      contradictionCount++;
      continue;
    }

    // 2. Immediate status query
    const q0Res = await fetch(`${baseUrl}/api/recovery/status/${ref}`);
    const q0Data = await q0Res.json();

    // 3. Delayed status query (1s later)
    await sleep(1000);
    const q1Res = await fetch(`${baseUrl}/api/recovery/status/${ref}`);
    const q1Data = await q1Res.json();

    // 4. Concurrency Test: 10 parallel requests
    const concurrentQueries = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${baseUrl}/api/recovery/status/${ref}`).then((r) => r.json())),
    );

    const concurrentPassed = concurrentQueries.every(
      (q) =>
        q.status === 'captured' &&
        q.outcomeStatus === 'synthetic_captured' &&
        q.syntheticOutcomeAmountPaise === amountPaise &&
        q.liveSettledAmountPaise === 0 &&
        q.evidenceClass === 'SYNTHETIC',
    );

    // 5. Tamper Test: Forged reference with altered amount must return HTTP 422 (technical error, not business outcome)
    const tamperedRef = ref.replace(`_${amountPaise}_`, '_99999999_');
    const tamperRes = await fetch(`${baseUrl}/api/recovery/status/${tamperedRef}`);
    const tamperData = await tamperRes.json();
    const tamperPassed =
      tamperRes.status === 422 &&
      tamperData.errorCode === 'INVALID_SIMULATOR_REFERENCE' &&
      tamperData.evidenceClass === 'UNVERIFIED' &&
      tamperData.syntheticOutcomeAmountPaise === 0 &&
      tamperData.liveSettledAmountPaise === 0;

    const isConsistent =
      q0Data.status === 'captured' &&
      q0Data.outcomeStatus === 'synthetic_captured' &&
      q0Data.syntheticOutcomeAmountPaise === amountPaise &&
      q0Data.liveSettledAmountPaise === 0 &&
      q0Data.evidenceClass === 'SYNTHETIC' &&
      q1Data.status === 'captured' &&
      q1Data.outcomeStatus === 'synthetic_captured' &&
      q1Data.syntheticOutcomeAmountPaise === amountPaise &&
      q1Data.liveSettledAmountPaise === 0 &&
      q1Data.evidenceClass === 'SYNTHETIC' &&
      concurrentPassed &&
      tamperPassed;

    if (!isConsistent) {
      contradictionCount++;
      console.error(`  ❌ Contradiction detected in test ${i}!`);
      console.error(`     Exec: ${receipt.outcomeStatus} (${receipt.syntheticOutcomeAmountPaise}p)`);
      console.error(`     Q0: ${q0Data.outcomeStatus} (${q0Data.syntheticOutcomeAmountPaise}p)`);
      console.error(`     Q1: ${q1Data.outcomeStatus} (${q1Data.syntheticOutcomeAmountPaise}p)`);
      console.error(`     Concurrent Passed: ${concurrentPassed}, Tamper Passed: ${tamperPassed}`);
    } else {
      console.log(
        `  ✅ 100% Consistent: ${receipt.outcomeStatus} | Amount: ₹${(amountPaise / 100).toLocaleString('en-IN')} | LiveSettled: ₹0 | Concurrent: 10/10 | Tamper Blocked`,
      );
    }

    results.push({
      attemptIndex: i,
      paymentId,
      amountPaise,
      transactionReference: ref,
      executionStatus: receipt.executionStatus || 'executed',
      outcomeStatus: receipt.outcomeStatus || 'synthetic_captured',
      evidenceClass: receipt.evidenceClass || 'SYNTHETIC',
      syntheticOutcomeAmountPaise: receipt.syntheticOutcomeAmountPaise || amountPaise,
      liveSettledAmountPaise: receipt.liveSettledAmountPaise || 0,
      immediateQuery: {
        status: q0Data.status,
        outcomeStatus: q0Data.outcomeStatus,
        evidenceClass: q0Data.evidenceClass,
        syntheticOutcomeAmountPaise: q0Data.syntheticOutcomeAmountPaise,
        liveSettledAmountPaise: q0Data.liveSettledAmountPaise,
      },
      delayedQuery: {
        status: q1Data.status,
        outcomeStatus: q1Data.outcomeStatus,
        evidenceClass: q1Data.evidenceClass,
        syntheticOutcomeAmountPaise: q1Data.syntheticOutcomeAmountPaise,
        liveSettledAmountPaise: q1Data.liveSettledAmountPaise,
      },
      concurrentQueriesPassed: concurrentPassed,
      tamperTestPassed: tamperPassed,
      consistent: isConsistent,
    });
  }

  // Summary
  console.log(`\n════════════════════════════════════════════════════════════════════`);
  console.log(` Consistency Audit Summary:`);
  console.log(` Total Scenarios Tested: ${results.length}`);
  console.log(` Passed Consistently:    ${results.length - contradictionCount}`);
  console.log(` Contradictions / Errs:  ${contradictionCount}`);
  console.log(`════════════════════════════════════════════════════════════════════\n`);

  if (contradictionCount > 0) {
    console.error(`❌ Audit Failed with ${contradictionCount} contradiction(s).`);
    process.exit(1);
  }

  console.log(`✅ All cross-request outcome observation consistency tests passed successfully.`);
}

runConsistencyVerification().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
