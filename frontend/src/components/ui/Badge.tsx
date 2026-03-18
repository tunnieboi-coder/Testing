import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

const variants = {
  default: 'bg-slate-800 text-slate-300 border border-slate-700',
  success: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
  warning: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
  danger: 'bg-red-900/40 text-red-300 border border-red-800/50',
  info: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
  muted: 'bg-slate-900 text-slate-500 border border-slate-800',
};

export default function Badge({ children, className, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  );
}
