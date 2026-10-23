import { NextResponse } from 'next/server';
import { route, requireSession } from '@/lib/server/access';
import { consoleSnapshot } from '@/lib/server/console';
import { csvRows } from '@/lib/csv';
export const GET = route(async (request) => {
  const data = await consoleSnapshot(await requireSession(request, 'audit:export'));
  const csv = csvRows([
    ['case_id', 'payment_id', 'customer_masked', 'status', 'amount_minor', 'currency', 'expected_value_minor', 'probability_bps', 'attempts', 'source', 'created_at'],
    ...data.cases.map((entry) => [entry.id, entry.paymentId, entry.customer, entry.status, entry.amountMinor, entry.currency, entry.expectedValueMinor, String(entry.probabilityBps), String(entry.attempts), data.source, entry.createdAt]),
  ]);
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="recoverflow-${data.source.toLowerCase()}-cases.csv"`, 'X-Export-Limit': '500', 'X-Total-Cases': String(data.totalCases) } });
});
