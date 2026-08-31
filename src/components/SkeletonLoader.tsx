/**
 * PayBack AI — Skeleton Loaders.
 *
 * Provides smooth, accessible shimmer skeleton states during batch re-simulation
 * and asynchronous calculations.
 */

'use client';

import React from 'react';

export function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-3 w-24 bg-slate-200 rounded"></div>
        <div className="h-4 w-4 bg-slate-200 rounded-full"></div>
      </div>
      <div className="h-7 w-32 bg-slate-300 rounded"></div>
      <div className="h-2 w-full bg-slate-100 rounded"></div>
    </div>
  );
}

export function TableRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <tr key={idx} className="animate-pulse border-b border-slate-100">
          <td className="py-3 px-4"><div className="h-4 w-6 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-14 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
          <td className="py-3 px-4"><div className="h-4 w-12 bg-slate-200 rounded"></div></td>
        </tr>
      ))}
    </>
  );
}
