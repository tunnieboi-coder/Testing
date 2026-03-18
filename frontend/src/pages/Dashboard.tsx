import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Shield, AlertTriangle, Users, FileText, ClipboardList,
  Database, Zap, TrendingUp, TrendingDown, CheckCircle2, Clock,
  ChevronRight, Activity,
} from 'lucide-react';
import api from '../lib/api';
import ScoreRing from '../components/ui/ScoreRing';
import RiskHeatmap from '../components/ui/RiskHeatmap';
import { statusColor, severityColor, formatDate, riskScoreBg, riskLabel } from '../lib/utils';

const CHART_COLORS = ['#6467f6', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'];

interface DashboardStats {
  frameworks: Array<{ id: string; name: string; version: string; total: number; implemented: number; in_progress: number; not_applicable: number; not_implemented: number; score: number }>;
  risks: { total: number; critical: number; high: number; medium: number; low: number };
  vendors: { total: number; highRisk: number };
  policies: { published: number; reviewDue: number };
  findings: { open: number; critical: number };
  integrations: { active: number; evidenceCollected: number };
  tasks: { open: number };
  recentAudits: Array<{ id: string; title: string; status: string; type: string; start_date: string }>;
}

interface TrendPoint {
  snapshot_date: string;
  compliance_score: number;
  framework_name: string;
  implemented: number;
  in_progress: number;
  not_implemented: number;
}

interface RiskTrendPoint {
  snapshot_date: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_open: number;
}

interface HeatmapCell { likelihood: number; impact: number; count: number; titles: string }

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats'),
  });

  const { data: trendRaw } = useQuery<TrendPoint[]>({
    queryKey: ['compliance-trend'],
    queryFn: () => api.get('/dashboard/compliance-trend'),
  });

  const { data: riskTrend } = useQuery<RiskTrendPoint[]>({
    queryKey: ['risk-trend'],
    queryFn: () => api.get('/dashboard/risk-trend'),
  });

  const { data: heatmapData } = useQuery<HeatmapCell[]>({
    queryKey: ['risk-heatmap'],
    queryFn: () => api.get('/dashboard/risk-heatmap'),
  });

  const { data: upcomingReviews } = useQuery<{ audits: unknown[]; policies: unknown[]; vendors: unknown[] }>({
    queryKey: ['upcoming-reviews'],
    queryFn: () => api.get('/dashboard/upcoming-reviews'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  // Build trend chart data — pivot by date
  const trendDates = [...new Set((trendRaw || []).map(t => t.snapshot_date))].sort();
  const frameworkNames = [...new Set((trendRaw || []).map(t => t.framework_name))];
  const trendData = trendDates.map(date => {
    const entry: Record<string, unknown> = { date: date.slice(0, 7) };
    for (const fw of frameworkNames) {
      const p = (trendRaw || []).find(t => t.snapshot_date === date && t.framework_name === fw);
      if (p) entry[fw] = p.compliance_score;
    }
    return entry;
  });

  const riskTrendData = (riskTrend || []).map(r => ({
    date: r.snapshot_date.slice(0, 7),
    Critical: r.critical_count,
    High: r.high_count,
    Medium: r.medium_count,
    Low: r.low_count,
    Total: r.total_open,
  }));

  const nist = stats?.frameworks.find(f => f.name.includes('NIST'));
  const iso = stats?.frameworks.find(f => f.name.includes('ISO'));

  const controlStatusData = nist ? [
    { name: 'Implemented', value: nist.implemented, color: '#34d399' },
    { name: 'In Progress', value: nist.in_progress, color: '#fbbf24' },
    { name: 'Not Implemented', value: nist.not_implemented, color: '#f87171' },
    { name: 'N/A', value: nist.not_applicable, color: '#475569' },
  ] : [];

  const riskDonut = [
    { name: 'Critical', value: stats?.risks.critical || 0, color: '#ef4444' },
    { name: 'High', value: stats?.risks.high || 0, color: '#f97316' },
    { name: 'Medium', value: stats?.risks.medium || 0, color: '#f59e0b' },
    { name: 'Low', value: stats?.risks.low || 0, color: '#22c55e' },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">NIST 800-53</span>
            <Shield size={16} className="text-primary-400" />
          </div>
          {nist && <ScoreRing score={Math.round(nist.score)} size={72} label="Compliance" />}
          <div className="mt-2 text-xs text-slate-500">{nist?.implemented}/{nist?.total} controls</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ISO 27001</span>
            <Shield size={16} className="text-emerald-400" />
          </div>
          {iso && <ScoreRing score={Math.round(iso.score)} size={72} label="Compliance" />}
          <div className="mt-2 text-xs text-slate-500">{iso?.implemented}/{iso?.total} controls</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Risks</span>
            <AlertTriangle size={16} className="text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{stats?.risks.total || 0}</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {stats?.risks.critical ? <span className="badge bg-red-900/40 text-red-300 border border-red-800/50">{stats.risks.critical} critical</span> : null}
            {stats?.risks.high ? <span className="badge bg-orange-900/40 text-orange-300 border border-orange-800/50">{stats.risks.high} high</span> : null}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Findings</span>
            <ClipboardList size={16} className="text-red-400" />
          </div>
          <div className="text-3xl font-bold text-slate-100">{stats?.findings.open || 0}</div>
          <div className="mt-2 text-xs text-slate-500">
            {stats?.findings.critical ? <span className="text-red-400">{stats.findings.critical} critical</span> : <span>from audit findings</span>}
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Vendors', value: stats?.vendors.total, sub: `${stats?.vendors.highRisk} high risk`, icon: Users, color: 'text-purple-400', to: '/vendors' },
          { label: 'Published Policies', value: stats?.policies.published, sub: `${stats?.policies.reviewDue} due for review`, icon: FileText, color: 'text-blue-400', to: '/policies' },
          { label: 'Active Integrations', value: stats?.integrations.active, sub: `${stats?.integrations.evidenceCollected} evidence items`, icon: Zap, color: 'text-amber-400', to: '/integrations' },
          { label: 'Open Tasks', value: stats?.tasks.open, sub: 'pending action', icon: Activity, color: 'text-pink-400', to: '/risks' },
        ].map(({ label, value, sub, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="card-hover p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className={color} />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-100">{value ?? '—'}</div>
              <div className="text-xs text-slate-400 mt-0.5">{label}</div>
              <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Compliance Score Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">12-month rolling compliance</p>
            </div>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ left: -20, bottom: 0 }}>
              <defs>
                {frameworkNames.map((name, i) => (
                  <linearGradient key={name} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
              />
              {frameworkNames.map((name, i) => (
                <Area key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i]} fill={`url(#grad${i})`} strokeWidth={2} dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Risk Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Open risks by severity</p>
            </div>
            <TrendingDown size={16} className="text-amber-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskTrendData.slice(-6)} margin={{ left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="High" stackId="a" fill="#f97316" />
              <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Low" stackId="a" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Status Donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">NIST Control Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={controlStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {controlStatusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Legend formatter={(value) => <span className="text-xs text-slate-400">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Heatmap */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Risk Heatmap</h3>
          <p className="text-xs text-slate-500 mb-3">Likelihood × Impact matrix</p>
          <RiskHeatmap data={heatmapData || []} />
        </div>

        {/* Recent Audits */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200">Recent Audits</h3>
            <Link to="/audits" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">View all <ChevronRight size={12} /></Link>
          </div>
          <div className="space-y-3">
            {(stats?.recentAudits || []).map((audit: { id: string; title: string; status: string; type: string; start_date: string }) => (
              <Link key={audit.id} to={`/audits/${audit.id}`} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <ClipboardList size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate group-hover:text-primary-400">{audit.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatDate(audit.start_date)}</div>
                </div>
                <span className={`badge text-xs ${statusColor(audit.status)}`}>{audit.status.replace('_', ' ')}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom - Upcoming Reviews */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">Upcoming Reviews & Deadlines</h3>
          <Clock size={16} className="text-slate-500" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Audits', items: (upcomingReviews?.audits || []) as Array<{ id: string; title: string; start_date: string; status: string }>, to: '/audits', key: 'start_date' },
            { title: 'Policy Reviews', items: (upcomingReviews?.policies || []) as Array<{ id: string; title: string; next_review_at: string; owner: string }>, to: '/policies', key: 'next_review_at' },
            { title: 'Vendor Assessments', items: (upcomingReviews?.vendors || []) as Array<{ id: string; name: string; next_review_date: string; risk_rating: string }>, to: '/vendors', key: 'next_review_date' },
          ].map(({ title, items, to, key }) => (
            <div key={title}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</div>
              {items.length === 0 ? (
                <div className="text-xs text-slate-600 py-2">No upcoming reviews</div>
              ) : (
                <div className="space-y-2">
                  {(items as Record<string, unknown>[]).map((item, i) => (
                    <Link key={i} to={to} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
                      <span className="text-xs text-slate-300 truncate group-hover:text-primary-400 max-w-[160px]">
                        {(item.title as string) || (item.name as string)}
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{formatDate(item[key] as string)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
