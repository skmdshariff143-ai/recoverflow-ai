import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/apiGuards';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rateLimitRes = await enforceRateLimit(req, 60, 60000);
  if (rateLimitRes) return rateLimitRes;

  const { searchParams } = new URL(req.url);

  const title = (searchParams.get('title') || 'Your Reserved Cart').slice(0, 100);
  const customer = (searchParams.get('customer') || 'there').slice(0, 50);
  const store = (searchParams.get('store') || 'RecoverFlow Store').slice(0, 50);
  const total = (searchParams.get('total') || '$149.00').slice(0, 30);
  const discount = searchParams.get('discount')?.slice(0, 20);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
          border: '2px solid #27272a',
          backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)',
        }}
      >
        {/* Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontWeight: 900,
                fontSize: '22px',
              }}
            >
              R
            </div>
            <span style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>{store}</span>
          </div>
          {discount && (
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '8px 18px',
                borderRadius: '9999px',
                fontSize: '18px',
                fontWeight: 600,
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              {discount} Applied
            </div>
          )}
        </div>

        {/* Center Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ color: '#a1a1aa', fontSize: '22px', fontWeight: 500 }}>
            Hi {customer}, your order is waiting.
          </div>
          <div
            style={{
              fontSize: '54px',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              color: '#ffffff',
            }}
          >
            {title}
          </div>
        </div>

        {/* Footer Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderTop: '1px solid #27272a',
            paddingTop: '32px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#71717a', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Cart Value
            </span>
            <span style={{ fontSize: '38px', fontWeight: 700, color: '#10b981' }}>{total}</span>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              padding: '16px 36px',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: 700,
            }}
          >
            Complete Checkout →
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
