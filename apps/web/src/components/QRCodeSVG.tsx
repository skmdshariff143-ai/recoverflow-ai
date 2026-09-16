/**
 * PayBack AI — Lightweight SVG QR Code Generator for Live Production & GitHub URLs.
 */

'use client';

import React from 'react';

interface QRCodeSVGProps {
  url: string;
  size?: number;
  label?: string;
}

export function QRCodeSVG({ url, size = 100, label }: QRCodeSVGProps) {
  // Use a reliable, fast dynamic QR code SVG API service for crisp vector rendering
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=svg`;

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs print:border-slate-400">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt={`QR Code for ${url}`}
        width={size}
        height={size}
        className="rounded object-contain"
        data-testid="qr-code-img"
      />
      {label && (
        <span className="text-[10px] font-mono font-semibold text-slate-700 text-center leading-tight">
          {label}
        </span>
      )}
    </div>
  );
}
