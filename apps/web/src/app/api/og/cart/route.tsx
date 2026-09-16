import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get('title') || 'Your Reserved Cart';
    const customer = searchParams.get('customer') || 'there';
    const store = searchParams.get('store') || 'RecoverFlow Store';
    const total = searchParams.get('total') || '$149.00';
    const discount = searchParams.get('discount');

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
              <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>{store}</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #10b981',
                padding: '8px 20px',
                borderRadius: '9999px',
                color: '#10b981',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              ● CART RESERVED FOR 2 HOURS
            </div>
          </div>

          {/* Main Card Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '40px 0' }}>
            <div style={{ fontSize: '24px', color: '#a1a1aa', fontWeight: 500 }}>
              Special hold for <span style={{ color: '#ffffff', fontWeight: 700 }}>{customer}</span>
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 900,
                letterSpacing: '-1.5px',
                lineHeight: 1.15,
                color: '#ffffff',
                maxWidth: '900px',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>

            {discount && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px' }}>
                <div
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '1px dashed #3b82f6',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    color: '#60a5fa',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  Exclusive Courtesy Code: {discount}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar / Pricing & CTA */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderTop: '1px solid #27272a',
              paddingTop: '28px',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '18px', color: '#71717a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Cart Value
              </div>
              <div style={{ fontSize: '42px', fontWeight: 900, color: '#10b981' }}>{total}</div>
            </div>

            <div
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '16px 36px',
                borderRadius: '12px',
                fontSize: '22px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
              }}
            >
              Complete Checkout &rarr;
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to generate OG image';
    return new Response(`Failed to generate the image: ${message}`, {
      status: 500,
    });
  }
}
