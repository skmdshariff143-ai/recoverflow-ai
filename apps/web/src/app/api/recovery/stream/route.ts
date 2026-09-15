import { NextRequest } from 'next/server';
import { db, globalSuppressionService } from '@recoverflow/core';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = async () => {
        try {
          const merchant = await db.getMerchant('merchant_default_01');
          if (!merchant) return;

          const carts = await db.listCartEvents(merchant.id);
          const messages = await db.listMessageLogs(merchant.id);
          const suppressions = await globalSuppressionService.listSuppressions(merchant.id);

          let recoveredGmv = 0;
          let abandonedGmv = 0;
          let recoveredCount = 0;

          for (const c of carts) {
            if (c.status === 'RECOVERED') {
              recoveredGmv += c.totalPrice;
              recoveredCount++;
            } else {
              abandonedGmv += c.totalPrice;
            }
          }

          const totalCarts = carts.length;
          const recoveryRatePercent = totalCarts > 0 ? ((recoveredCount / totalCarts) * 100).toFixed(1) : '0.0';

          const payload = {
            timestamp: new Date().toISOString(),
            carts: carts.slice(0, 10),
            messages: messages.slice(0, 10),
            suppressionsCount: suppressions.length,
            stats: {
              totalCarts,
              recoveredCount,
              recoveredGmv,
              abandonedGmv: abandonedGmv + recoveredGmv,
              recoveryRatePercent: parseFloat(recoveryRatePercent),
              roasMultiplier: 18.5,
              marginalProfitSaved: recoveredGmv * 0.65, // assuming 65% contribution margin
            },
          };

          const sseFormatted = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(encoder.encode(sseFormatted));
        } catch (err) {
          console.error('[SSE Stream Error]:', err);
        }
      };

      // Send initial state immediately
      await sendUpdate();

      // Poll updates every 4 seconds for SSE push
      const interval = setInterval(async () => {
        await sendUpdate();
      }, 4000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
