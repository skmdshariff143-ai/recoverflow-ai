import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route, requireSession, ApiError } from '@/lib/server/access';
import { consoleSnapshot } from '@/lib/server/console';
import { formatMoney } from '@/lib/console-types';
export const POST = route(async (request) => {
  const session = await requireSession(request, 'financials:view');
  const input = z.object({ question: z.string().trim().min(1).max(1000) }).safeParse(await request.json());
  if (!input.success) throw new ApiError(400, 'Enter a question of up to 1,000 characters.');
  const data = await consoleSnapshot(session);
  const q = input.data.question.toLowerCase();
  let answer: string;
  let links = [{ label: 'Review cases', href: '/recovery/cases' }];
  if (/approv|review|sign/.test(q)) {
    const pending = data.cases.filter((entry) => entry.status === 'APPROVAL_REQUIRED');
    answer = `${pending.length} cases in the loaded records need approval. Each requires two different reviewers. Recording approval does not execute a payment or count it as recovered.`;
    links = [{ label: 'Open approvals', href: '/recovery/approvals' }];
  } else if (/polic|discount|margin|tone/.test(q)) {
    answer = `The configured discount ceiling is ${data.merchant.discountCeiling}%, with a minimum margin of ${data.merchant.minMargin}%. Brand guidance: ${data.merchant.guidelines}`;
    links = [{ label: 'View policy', href: '/policies' }];
  } else if (/recover|revenue|risk|summar|overview/.test(q)) {
    answer = data.currencies.length ? data.currencies.map((entry) => `${entry.currency}: ${formatMoney(entry.recovered, entry.currency)} in ${entry.recoveredCount} cases marked recovered; ${formatMoney(entry.atRisk, entry.currency)} remains in active cases.`).join(' ') : 'There are no recovery cases recorded for this merchant yet.';
  } else if (/audit|ledger|verif/.test(q)) {
    answer = `${data.audit.length} audit events are displayed. Run ledger verification to check the stored hash chain; a populated ledger alone is not evidence of integrity.`;
    links = [{ label: 'Verify audit ledger', href: '/audit' }];
  } else {
    answer = 'I can summarize recorded recovery amounts, pending approvals, merchant policy, or audit events. Ask about one of these topics. Free-form model analysis is available in the separate benchmark lab.';
  }
  return NextResponse.json({ answer, links, source: data.source, engine: 'Deterministic workspace assistant', asOf: data.generatedAt, recordsRead: data.cases.length });
});
