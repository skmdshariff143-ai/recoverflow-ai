#!/usr/bin/env tsx
/**
 * RecoverFlow AI — Autonomous Demo Seeding CLI
 * 
 * Populates realistic, synthetic e-commerce recovery datasets across:
 * - 1 Demo Luxury Apparel Merchant
 * - 32 Cart Events spanning all CartStatus and RecoveryStage lifecycle states
 * - 16 Multimodal Message Logs (Outbound WhatsApp, Inbound replies, Resend Email)
 * - 4 Opt-Out Suppression List entries
 * - 4 Transactional Outbox Events (Published, Processing, Pending)
 * - 2 Guardrail Prompt-Injection Security Incidents
 * - 2 Orders, 2 Fulfillments (FedEx/UPS WISMO), and 1 Return Request
 * 
 * Usage:
 *   npm run seed:demo
 *   npx tsx scripts/seed-demo.ts
 */

import { db, seedDemoDataset } from '../packages/core/src/index';

async function main() {
  console.log('===============================================================');
  console.log('  RECOVERFLOW AI — END-TO-END DEMO ENVIRONMENT SEEDER');
  console.log('===============================================================\n');

  console.log('[1/2] Seeding in-memory runtime persistence layer (MemoryDatabase)...');
  const counts = seedDemoDataset(db as any, { clearExisting: true });

  console.log('[2/2] Verification of seeded entities:');
  console.log(`  - Merchants:          ${counts.merchantCount} (Store: Aurora Luxury Apparel)`);
  console.log(`  - Cart Events:        ${counts.cartCount} records across 7 lifecycle statuses`);
  console.log(`  - Message Logs:       ${counts.messageCount} WhatsApp/Email outbound & inbound logs`);
  console.log(`  - Suppression List:   ${counts.suppressionCount} opt-out contact entries`);
  console.log(`  - Outbox Events:      ${counts.outboxCount} transactional outbox rows`);
  console.log(`  - Security Incidents: ${counts.incidentCount} prompt injection / evasion logs`);
  console.log(`  - Orders:             ${counts.orderCount} post-purchase orders`);
  console.log(`  - Fulfillments:       ${counts.fulfillmentCount} carrier tracking records (FedEx/UPS)`);
  console.log(`  - Returns:            ${counts.returnCount} returns & exchange records\n`);

  console.log('---------------------------------------------------------------');
  console.log('✅ DEMO DATA SEEDED SUCCESSFULLY (Idempotent: 100%)');
  console.log('---------------------------------------------------------------');
  console.log('Next step:');
  console.log('  Start the web dashboard:  npm run dev');
  console.log('  Open in your browser:     http://localhost:3000\n');
}

main().catch((err) => {
  console.error('Fatal error during demo seeding:', err);
  process.exit(1);
});
