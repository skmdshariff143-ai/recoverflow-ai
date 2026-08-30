import fs from 'fs';

interface AttemptRecord {
  attemptIndex: number;
  idempotencyKey: string;
  paymentId: string;
  amountPaise: number;
  transactionReference: string;
  executionOutcomeStatus: string;
  executionAmountPaise: number;
  executionEvidenceClass: string;
  executionTimestamp: string;
  immediateQueryStatus: string;
  immediateQueryAmountPaise: number;
  oneSecQueryStatus: string;
  oneSecQueryAmountPaise: number;
  fiveSecQueryStatus: string;
  fiveSecQueryAmountPaise: number;
  fifteenSecQueryStatus: string;
  fifteenSecQueryAmountPaise: number;
  consistent: boolean;
}

const BASE_URL = 'https://recoverflow-ai-kohl.vercel.app';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSingleAttempt(i: number): Promise<AttemptRecord> {
  const paymentId = `pay_repro_test_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const idempotencyKey = `idemp_repro_${i}_${Date.now()}`;
  const amountPaise = (i * 1000 + 500) * 100;

  const execRes = await fetch(`${BASE_URL}/api/recovery/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-recovery-adapter': 'deterministic_simulator',
    },
    body: JSON.stringify({
      paymentId,
      customerId: `cust_repro_${i}`,
      customerName: `Repro Customer ${i}`,
      customerEmail: `customer${i}@example.com`,
      amountPaise,
      currency: 'INR',
      intervention: 'retry',
      attemptCycle: 1,
      idempotencyKey,
    }),
  });

  const execData = await execRes.json();
  const receipt = execData.receipt || {};
  const ref = receipt.transactionReference || `sim_txn_${paymentId}_c1`;

  // 1. Immediate query
  const q0Res = await fetch(`${BASE_URL}/api/recovery/status/${ref}`);
  const q0Data = await q0Res.json();

  // 2. 1s query
  await sleep(1000);
  const q1Res = await fetch(`${BASE_URL}/api/recovery/status/${ref}`);
  const q1Data = await q1Res.json();

  // 3. 5s query
  await sleep(4000);
  const q5Res = await fetch(`${BASE_URL}/api/recovery/status/${ref}`);
  const q5Data = await q5Res.json();

  // 4. 15s query
  await sleep(10000);
  const q15Res = await fetch(`${BASE_URL}/api/recovery/status/${ref}`);
  const q15Data = await q15Res.json();

  const isConsistent =
    q0Data.status === 'captured' &&
    q1Data.status === 'captured' &&
    q5Data.status === 'captured' &&
    q15Data.status === 'captured';

  const record: AttemptRecord = {
    attemptIndex: i,
    idempotencyKey,
    paymentId,
    amountPaise,
    transactionReference: ref,
    executionOutcomeStatus: receipt.outcomeStatus || receipt.status,
    executionAmountPaise: receipt.syntheticOutcomeAmountPaise ?? receipt.settledAmountPaise ?? 0,
    executionEvidenceClass: receipt.evidenceClass || 'SYNTHETIC',
    executionTimestamp: receipt.timestamp || execData.serverTimestamp,
    immediateQueryStatus: q0Data.status,
    immediateQueryAmountPaise: q0Data.syntheticOutcomeAmountPaise ?? q0Data.settledAmountPaise ?? 0,
    oneSecQueryStatus: q1Data.status,
    oneSecQueryAmountPaise: q1Data.syntheticOutcomeAmountPaise ?? q1Data.settledAmountPaise ?? 0,
    fiveSecQueryStatus: q5Data.status,
    fiveSecQueryAmountPaise: q5Data.syntheticOutcomeAmountPaise ?? q5Data.settledAmountPaise ?? 0,
    fifteenSecQueryStatus: q15Data.status,
    fifteenSecQueryAmountPaise: q15Data.syntheticOutcomeAmountPaise ?? q15Data.settledAmountPaise ?? 0,
    consistent: isConsistent,
  };

  console.log(
    `[Attempt ${i}/20] Exec: ${record.executionOutcomeStatus} (${record.executionAmountPaise}p) | Q0: ${record.immediateQueryStatus} | Q1: ${record.oneSecQueryStatus} | Q5: ${record.fiveSecQueryStatus} | Q15: ${record.fifteenSecQueryStatus} | Consistent: ${isConsistent}`
  );

  return record;
}

async function runReproduction() {
  console.log(`Starting Concurrent Forensic Reproduction against ${BASE_URL} (20 attempts)...`);
  const promises: Promise<AttemptRecord>[] = [];
  for (let i = 1; i <= 20; i++) {
    promises.push(runSingleAttempt(i));
    await sleep(200); // slight stagger
  }

  const records = await Promise.all(promises);
  records.sort((a, b) => a.attemptIndex - b.attemptIndex);

  fs.writeFileSync('docs/reproduction_results.json', JSON.stringify(records, null, 2));
  console.log(`Forensic Reproduction Complete. Saved ${records.length} attempts to docs/reproduction_results.json.`);
}

runReproduction().catch(console.error);
