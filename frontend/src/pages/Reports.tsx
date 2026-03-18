import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, Legend,
} from 'recharts';
import { BarChart3, Download, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { severityColor, formatDate } from '../lib/utils';

interface ExecutiveSummary {
  generatedAt: string;
  frameworks: Array<{
    id: string; name: string; version: string; score: number;
    total: number; implemented: number; in_progress: number; not_implemented: number; not_applicable: number;
    byFamily: Array<{ identifier: string; name: string; total: number; implemented: number; in_progress: number; not_implemented: number }>;
  }>;
  riskSummary: { total: number; critical: number; high: number; medium: number; low: number; avg_score: number };
  topRisks: Array<{ id: string; title: string; risk_score: number; category: string; status: string }>;
  vendorStats: Array<{ risk_rating: string; count: number }>;
  policyStats: Array<{ status: string; count: number }>;
  openFindings: Array<{ id: string; title: string; severity: string; status: string; audit_title: string; due_date: string }>;
  complianceTrend: Array<{ snapshot_date: string; compliance_score: number; framework_name: string }>;
}

interface GapControl {
  identifier: string; title: string; status: string; priority: string;
  cia_confidentiality: string; cia_integrity: string; cia_availability: string;
  family_name: string; framework_name: string; evidence_count: number;
}

export default function Reports() {
  const { data: summary, isLoading } = useQuery<ExecutiveSummary>({
    queryKey: ['executive-summary'],
    queryFn: () => api.get('/reporting/executive-summary'),
  });

  const { data: gaps = [] } = useQuery<GapControl[]>({
    queryKey: ['gap-analysis'],
    queryFn: () => api.get('/reporting/control-gap-analysis'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        Generating report...
      </div>
    </div>
  );

  // Family radar chart for first framework
  const nist = summary?.frameworks.find(f => f.name.includes('NIST'));
  const radarData = (nist?.byFamily || []).slice(0, 10).map(f => ({
    subject: f.identifier,
    value: f.total > 0 ? Math.round((f.implemented + f.in_progress * 0.5) / f.total * 100) : 0,
    fullMark: 100,
  }));

  // Compliance trend
  const trendDates = [...new Set((summary?.complianceTrend || []).map(t => t.snapshot_date))].sort();
  const fwNames = [...new Set((summary?.complianceTrend || []).map(t => t.framework_name))];
  const trendData = trendDates.map(date => {
    const entry: Record<string, unknown> = { date: date.slice(0, 7) };
    fwNames.forEach(fw => {
      const p = summary?.complianceTrend.find(t => t.snapshot_date === date && t.framework_name === fw);
      if (p) entry[fw] = p.compliance_score;
    });
    return entry;
  });

  const unimplemented = gaps.filter(g => g.status === 'not_implemented');
  const highCIA = gaps.filter(g => g.cia_confidentiality === 'H' || g.cia_integrity === 'H' || g.cia_availability === 'H').filter(g => g.status !== 'implemented');
  const noEvidence = gaps.filter(g => g.evidence_count === 0 && g.status !== 'not_applicable');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Reports & Analytics</h2>
          <p className="section-subtitle">
            Generated {summary?.generatedAt ? formatDate(summary.generatedAt) : ''}
          </p>
        </div>
        <button className="btn-secondary"><Download size={14} /> Export PDF</button>
      </div>

      {/* Executive Summary */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <BarChart3 size={18} className="text-primary-400" />
          <h3 className="text-base font-semibold text-slate-100">Executive Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(summary?.frameworks || []).map(fw => (
            <div key={fw.id} className="text-center">
              <div className={`text-3xl font-bold ${fw.score >= 80 ? 'text-emerald-400' : fw.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {fw.score.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">{fw.name}</div>
              <div className="text-xs text-slate-500">{fw.implemented}/{fw.total} implemented</div>
            </div>
          ))}
          <div className="text-center">
            <div className={`text-3xl font-bold ${summary?.riskSummary?.critical ? 'text-red-400' : 'text-emerald-400'}`}>
              {summary?.riskSummary?.total || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">Open Risks</div>
            <div className="text-xs text-slate-500">{summary?.riskSummary?.critical || 0} critical</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-400">{summary?.openFindings?.length || 0}</div>
            <div className="text-xs text-slate-400 mt-1">Open Findings</div>
            <div className="text-xs text-slate-500">from audits</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" /> Compliance Trend (12 months)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ left: -20 }}>
              <defs>
                {fwNames.map((name, i) => (
                  <linearGradient key={name} id={`rg${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={['#6467f6', '#34d399'][i]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={['#6467f6', '#34d399'][i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v?.toFixed(1)}%`]} />
              <Legend formatter={v => <span className="text-xs text-slate-400">{v}</span>} />
              {fwNames.map((name, i) => (
                <Area key={name} type="monotone" dataKey={name} stroke={['#6467f6', '#34d399'][i]} fill={`url(#rg${i})`} strokeWidth={2} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Control Family Radar */}
        {radarData.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Shield size={14} className="text-primary-400" /> NIST Family Coverage
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Coverage" dataKey="value" stroke="#6467f6" fill="#6467f6" fillOpacity={0.3} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* NIST Family Breakdown */}
      {nist && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">NIST 800-53 Control Status by Family</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={nist.byFamily} margin={{ left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="identifier" tick={{ fontSize: 10, fill: '#64748b' }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Legend formatter={v => <span className="text-xs text-slate-400">{v}</span>} />
              <Bar dataKey="implemented" name="Implemented" fill="#34d399" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="in_progress" name="In Progress" fill="#fbbf24" stackId="a" />
              <Bar dataKey="not_implemented" name="Not Implemented" fill="#f87171" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gap Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Unimplemented Controls</h3>
          <div className="text-3xl font-bold text-red-400 mb-3">{unimplemented.length}</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {unimplemented.slice(0, 15).map(c => (
              <div key={c.identifier} className="flex items-center justify-between text-xs">
                <span className="font-mono text-primary-400">{c.identifier}</span>
                <span className="text-slate-500 truncate ml-2 max-w-[140px]">{c.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">High CIA Impact Gaps</h3>
          <div className="text-3xl font-bold text-amber-400 mb-3">{highCIA.length}</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {highCIA.slice(0, 15).map(c => (
              <div key={c.identifier} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-primary-400">{c.identifier}</span>
                <div className="flex gap-0.5">
                  {c.cia_confidentiality === 'H' && <span className="badge bg-red-900/40 text-red-300 border-red-800/40">C</span>}
                  {c.cia_integrity === 'H' && <span className="badge bg-red-900/40 text-red-300 border-red-800/40">I</span>}
                  {c.cia_availability === 'H' && <span className="badge bg-red-900/40 text-red-300 border-red-800/40">A</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Controls Without Evidence</h3>
          <div className="text-3xl font-bold text-orange-400 mb-3">{noEvidence.length}</div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {noEvidence.slice(0, 15).map(c => (
              <div key={c.identifier} className="flex items-center justify-between text-xs">
                <span className="font-mono text-primary-400">{c.identifier}</span>
                <span className={`badge text-xs ${c.status === 'implemented' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50' : 'bg-amber-900/40 text-amber-300 border-amber-800/50'}`}>{c.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Risks and Open Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" /> Top Risks</h3>
          <div className="space-y-2">
            {(summary?.topRisks || []).slice(0, 8).map(risk => (
              <div key={risk.id} className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg">
                <span className="text-xs text-slate-300 truncate max-w-[200px]">{risk.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`badge text-xs font-bold border ${risk.risk_score >= 20 ? 'bg-red-900/40 text-red-300 border-red-800/50' : risk.risk_score >= 15 ? 'bg-orange-900/40 text-orange-300 border-orange-800/50' : 'bg-amber-900/40 text-amber-300 border-amber-800/50'}`}>
                    {risk.risk_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Open Audit Findings</h3>
          <div className="space-y-2">
            {(summary?.openFindings || []).slice(0, 8).map(finding => (
              <div key={finding.id} className="flex items-start gap-3 p-2.5 bg-slate-800/40 rounded-lg">
                <span className={`badge text-xs border flex-shrink-0 ${severityColor(finding.severity)}`}>{finding.severity}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{finding.title}</div>
                  <div className="text-xs text-slate-500 truncate">{finding.audit_title}</div>
                </div>
                {finding.due_date && <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(finding.due_date)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
