import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'RecoverFlow AI — Intelligent Recovery, Human Control';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#060c16',
          color: '#f8fafc',
          padding: '64px 80px',
          fontFamily: 'sans-serif',
          justifyContent: 'space-between',
          border: '1px solid #1e293b',
          backgroundImage: 'radial-gradient(circle at 90% 10%, rgba(16, 185, 129, 0.18) 0%, transparent 60%)',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#020617',
                fontWeight: 900,
                fontSize: '24px',
              }}
            >
              RF
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
              <span>RecoverFlow</span>
              <span style={{ color: '#34d399', marginLeft: '6px' }}>AI</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              color: '#6ee7b7',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.5px',
            }}
          >
            INTELLIGENT RECOVERY · HUMAN CONTROL
          </div>
        </div>

        {/* Center Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: '54px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-1.5px',
              color: '#ffffff',
            }}
          >
            <span>Recover failed checkouts</span>
            <span style={{ color: '#6ee7b7' }}>without sacrificing margin.</span>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: '#94a3b8',
              maxWidth: '820px',
              lineHeight: 1.5,
            }}
          >
            A transparent operations workspace uniting deterministic Thompson Sampling, integer minor-unit financial arithmetic, and cryptographic SHA-256 Merkle audit chains.
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              padding: '14px 20px',
              borderRadius: '12px',
              flex: 1,
            }}
          >
            <span style={{ display: 'flex', fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>FINANCIAL MATH</span>
            <span style={{ display: 'flex', fontSize: '15px', color: '#e2e8f0', fontWeight: 600, marginTop: '4px' }}>
              Zero Float Drift (Paise)
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              padding: '14px 20px',
              borderRadius: '12px',
              flex: 1,
            }}
          >
            <span style={{ display: 'flex', fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>GOVERNANCE</span>
            <span style={{ display: 'flex', fontSize: '15px', color: '#e2e8f0', fontWeight: 600, marginTop: '4px' }}>
              Dual-Custody Approvals
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid #334155',
              padding: '14px 20px',
              borderRadius: '12px',
              flex: 1,
            }}
          >
            <span style={{ display: 'flex', fontSize: '11px', color: '#94a3b8', letterSpacing: '1px' }}>AUDIT TRAIL</span>
            <span style={{ display: 'flex', fontSize: '15px', color: '#e2e8f0', fontWeight: 600, marginTop: '4px' }}>
              SHA-256 Merkle Chain
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
