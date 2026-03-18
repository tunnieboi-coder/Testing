import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    implemented: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    in_progress: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
    not_implemented: 'bg-red-900/40 text-red-300 border border-red-800/50',
    not_applicable: 'bg-slate-800 text-slate-400 border border-slate-700',
    open: 'bg-red-900/40 text-red-300 border border-red-800/50',
    mitigated: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    accepted: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
    transferred: 'bg-purple-900/40 text-purple-300 border border-purple-800/50',
    closed: 'bg-slate-800 text-slate-400 border border-slate-700',
    active: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    approved: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    under_review: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
    rejected: 'bg-red-900/40 text-red-300 border border-red-800/50',
    inactive: 'bg-slate-800 text-slate-400 border border-slate-700',
    draft: 'bg-slate-800 text-slate-400 border border-slate-700',
    review: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
    published: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    archived: 'bg-slate-800 text-slate-400 border border-slate-700',
    planned: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
    completed: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    cancelled: 'bg-slate-800 text-slate-400 border border-slate-700',
    valid: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
    expired: 'bg-red-900/40 text-red-300 border border-red-800/50',
    review_needed: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
    configuring: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
    error: 'bg-red-900/40 text-red-300 border border-red-800/50',
  };
  return map[status] || 'bg-slate-800 text-slate-400';
}

export function severityColor(severity: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-900/60 text-red-200 border border-red-700',
    high: 'bg-orange-900/60 text-orange-200 border border-orange-700',
    medium: 'bg-amber-900/60 text-amber-200 border border-amber-700',
    low: 'bg-blue-900/60 text-blue-200 border border-blue-700',
    informational: 'bg-slate-800 text-slate-300 border border-slate-700',
  };
  return map[severity] || 'bg-slate-800 text-slate-400';
}

export function riskScoreColor(score: number) {
  if (score >= 20) return 'text-red-400';
  if (score >= 15) return 'text-orange-400';
  if (score >= 9) return 'text-amber-400';
  return 'text-emerald-400';
}

export function riskScoreBg(score: number) {
  if (score >= 20) return 'bg-red-900/40 text-red-300 border border-red-800/50';
  if (score >= 15) return 'bg-orange-900/40 text-orange-300 border border-orange-800/50';
  if (score >= 9) return 'bg-amber-900/40 text-amber-300 border border-amber-800/50';
  return 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50';
}

export function riskLabel(score: number) {
  if (score >= 20) return 'Critical';
  if (score >= 15) return 'High';
  if (score >= 9) return 'Medium';
  return 'Low';
}

export function ciaColor(cia: string) {
  const map: Record<string, string> = {
    H: 'bg-red-900/40 text-red-300 border border-red-800/40',
    M: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
    L: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
    'N/A': 'bg-slate-800 text-slate-500 border border-slate-700',
  };
  return map[cia] || 'bg-slate-800 text-slate-400';
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

export function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function scoreGradient(score: number) {
  if (score >= 80) return 'from-emerald-500 to-emerald-400';
  if (score >= 60) return 'from-amber-500 to-amber-400';
  if (score >= 40) return 'from-orange-500 to-orange-400';
  return 'from-red-500 to-red-400';
}

export function truncate(str: string, len = 80) {
  return str?.length > len ? str.slice(0, len) + '…' : str;
}
