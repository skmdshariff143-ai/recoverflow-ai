import React from 'react';

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  provenance?: 'DEMO' | 'OBSERVED' | 'BENCHMARK' | 'SANDBOX' | 'LIVE';
  icon?: React.ReactNode;
  variant?: 'default' | 'emerald' | 'rose' | 'amber' | 'violet' | 'cyan';
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  provenance = 'DEMO',
  icon,
  variant = 'default',
  className = '',
}) => {
  const borderVariants = {
    default: 'border-slate-800 hover:border-slate-700',
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.02]',
    rose: 'border-rose-500/20 bg-rose-500/[0.02]',
    amber: 'border-amber-500/20 bg-amber-500/[0.02]',
    violet: 'border-violet-500/20 bg-violet-500/[0.02]',
    cyan: 'border-cyan-500/20 bg-cyan-500/[0.02]',
  };

  const provenanceColors = {
    DEMO: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    OBSERVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    BENCHMARK: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    SANDBOX: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    LIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-slate-900/60 p-5 shadow-sm transition-all ${borderVariants[variant]} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${provenanceColors[provenance]}`}>
            {provenance}
          </span>
          {icon && <div className="text-slate-400">{icon}</div>}
        </div>
      </div>

      <div className="text-2xl font-bold tracking-tight text-white mb-1">{value}</div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {trend && (
            <span
              className={`font-medium ${
                trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
