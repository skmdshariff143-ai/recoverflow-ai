'use client';

import { useMemo } from 'react';
import { create } from 'qrcode';

interface QRCodeSVGProps {
  url: string;
  size?: number;
  label?: string;
}

/** Generate the QR locally; URLs are never sent to a third-party image service. */
export function QRCodeSVG({ url, size = 100, label }: QRCodeSVGProps) {
  const qr = useMemo(() => {
    const { modules } = create(url, { errorCorrectionLevel: 'M' });
    const path = Array.from(modules.data, (filled, index) => filled
      ? `M${index % modules.size + 4} ${Math.floor(index / modules.size) + 4}h1v1h-1z`
      : '').join('');
    return { dimension: modules.size + 8, path };
  }, [url]);

  return <div className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs print:border-slate-400">
    <svg role="img" aria-label={`QR code for ${label || url}`} width={size} height={size} viewBox={`0 0 ${qr.dimension} ${qr.dimension}`} shapeRendering="crispEdges" data-testid="qr-code-img">
      <rect width={qr.dimension} height={qr.dimension} fill="white"/>
      <path d={qr.path} fill="#000"/>
    </svg>
    {label && <span className="text-center font-mono text-[10px] font-semibold leading-tight text-slate-700">{label}</span>}
  </div>;
}
