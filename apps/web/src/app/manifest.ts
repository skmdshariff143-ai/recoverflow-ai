import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RecoverFlow AI — Merchant Recovery Console',
    short_name: 'RecoverFlow AI',
    description: 'Autonomous revenue recovery with deterministic financial control, Thompson Sampling, and cryptographic auditability.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060c16',
    theme_color: '#09090b',
    icons: [
      {
        src: '/favicon.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
