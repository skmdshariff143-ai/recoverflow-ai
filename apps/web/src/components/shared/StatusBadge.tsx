import React from 'react';

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple'
  | 'cyan';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  size = 'md',
  pulse = false,
  className = '',
}) => {
  // Infer variant if not explicitly provided
  let computedVariant: StatusVariant = variant || 'neutral';
  const s = status.toUpperCase();

  if (!variant) {
    if (s.includes('RECOVERED') || s.includes('PAID') || s.includes('CAPTURED') || s.includes('VALID') || s.includes('CONNECTED') || s.includes('ACTIVE')) {
      computedVariant = 'success';
    } else if (s.includes('APPROVAL') || s.includes('PENDING') || s.includes('SANDBOX') || s.includes('WARN')) {
      computedVariant = 'warning';
    } else if (s.includes('FAILED') || s.includes('BLOCKED') || s.includes('STOPPED') || s.includes('BROKEN') || s.includes('DANGER') || s.includes('ERROR')) {
      computedVariant = 'danger';
    } else if (s.includes('EXECUTING') || s.includes('PROCESSING') || s.includes('LIVE')) {
      computedVariant = 'cyan';
    } else if (s.includes('AI') || s.includes('DEMO') || s.includes('MAB')) {
      computedVariant = 'purple';
    }
  }

  const variantStyles: Record<StatusVariant, { badge: string; dot: string }> = {
    success: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
    warning: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
    danger: { badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', dot: 'bg-rose-400' },
    info: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', dot: 'bg-blue-400' },
    neutral: { badge: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' },
    purple: { badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20', dot: 'bg-violet-400' },
    cyan: { badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20', dot: 'bg-cyan-400' },
  };

  const current = variantStyles[computedVariant];
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-md border tracking-wide uppercase ${sizeClasses} ${current.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
};
