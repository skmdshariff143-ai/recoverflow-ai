import type { UserSession } from '../../../../packages/core/src/auth';

export interface ConsoleCase {
  id: string; paymentId: string; customer: string; status: string; amountMinor: string; currency: string;
  expectedValueMinor: string; probabilityBps: number; attempts: number; maxAttempts: number; createdAt: string; updatedAt: string;
}
export interface ConsoleSnapshot {
  persistence: 'POSTGRESQL' | 'MEMORY';
  mode: 'DEMO' | 'TEST' | 'SANDBOX' | 'LIVE'; source: 'DEMO' | 'OBSERVED'; session: UserSession;
  merchant: { id: string; name: string; domain: string; guidelines: string; discountCeiling: number; minMargin: number; formality: number; urgency: number };
  cases: ConsoleCase[]; totalCases: number;
  currencies: { currency: string; atRisk: string; recovered: string; expected: string; total: number; recoveredCount: number }[];
  messages: { id: string; channel: string; direction: string; status: string; content: string; createdAt: string }[];
  audit: { id: string; action: string; entityId: string; actor: string; hash: string; createdAt: string; reason: string }[];
  integrations: { name: string; configured: boolean; detail: string }[];
  generatedAt: string;
}

export function formatMoney(amount: string | number | bigint, currency = 'USD') {
  const minor = BigInt(amount);
  const abs = minor < 0n ? -minor : minor;
  let digits = 2;
  try { digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { /* Unknown currency retains the stored two-decimal convention. */ }
  const scale = 10n ** BigInt(digits);
  const symbol = currency === 'USD' ? '$' : currency === 'INR' ? '₹' : `${currency} `;
  return `${minor < 0n ? '-' : ''}${symbol}${(abs / scale).toLocaleString('en-US')}${digits ? '.' + (abs % scale).toString().padStart(digits, '0') : ''}`;
}

export function summarizeCases(cases: ConsoleCase[]): ConsoleSnapshot['currencies'] {
  const sums = new Map<string, { atRisk: bigint; recovered: bigint; expected: bigint; total: number; recoveredCount: number }>();
  for (const entry of cases) {
    const group = sums.get(entry.currency) || { atRisk: 0n, recovered: 0n, expected: 0n, total: 0, recoveredCount: 0 };
    group.total++;
    if (entry.status === 'RECOVERED') { group.recovered += BigInt(entry.amountMinor); group.recoveredCount++; }
    else if (entry.status !== 'STOPPED') { group.atRisk += BigInt(entry.amountMinor); group.expected += BigInt(entry.expectedValueMinor); }
    sums.set(entry.currency, group);
  }
  return Array.from(sums, ([currency, group]) => ({ ...group, currency, atRisk: String(group.atRisk), recovered: String(group.recovered), expected: String(group.expected) }));
}

export function maskIdentifier(value?: string | null) {
  if (!value) return 'Unlinked customer';
  if (value.includes('@')) { const [name, domain] = value.split('@'); return `${name.slice(0, 1)}•••@${domain}`; }
  if (/\+?\d{8,}/.test(value)) return `•••• ${value.slice(-4)}`;
  return value;
}
