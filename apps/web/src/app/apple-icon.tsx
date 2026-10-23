import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#060c16',
          borderRadius: 36,
          border: '4px solid #34d399',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 900,
            color: '#34d399',
            letterSpacing: '-2px',
          }}
        >
          RF
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 16,
            fontWeight: 700,
            color: '#94a3b8',
            letterSpacing: '2px',
            marginTop: 4,
          }}
        >
          RECOVERFLOW
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
