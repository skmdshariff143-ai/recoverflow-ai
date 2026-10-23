import React from 'react';

export interface ModeBadgeProps {
  mode?: 'DEMO' | 'SANDBOX' | 'LIVE';
  className?: string;
}

export const ModeBadge: React.FC<ModeBadgeProps> = ({ mode = 'DEMO', className = '' }) => {
  if (mode === 'LIVE') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        LIVE PROD
      </span>
    );
  }

  if (mode === 'SANDBOX') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        SANDBOX
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 text-violet-300 ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-violet-400" />
      DEMO MODE
    </span>
  );
};
