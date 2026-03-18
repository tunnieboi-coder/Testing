import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, ChevronRight, ChevronLeft, CheckCircle2, Clock, XCircle, Filter } from 'lucide-react';
import { useState } from 'react';
import api from '../lib/api';
import ScoreRing from '../components/ui/ScoreRing';
import { statusColor } from '../lib/utils';

interface ControlFamily {
  id: string;
  identifier: string;
  name: string;
}

interface FrameworkDetail {
  id: string;
  name: string;
  version: string;
  description: string;
  families: ControlFamily[];
  stats: Array<{ status: string; count: number }>;
}

interface Control {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  family_name: string;
  family_identifier: string;
  baseline_low: number;
  baseline_moderate: number;
  baseline_high: number;
}

export default function FrameworkDetail() {
  const { id } = useParams<{ id: string }>();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: fw } = useQuery<FrameworkDetail>({
    queryKey: ['framework', id],
    queryFn: () => api.get(`/frameworks/${id}`),
  });

  const { data: controlsData } = useQuery<{ controls: Control[]; total: number }>({
    queryKey: ['framework-controls', id, selectedFamily, statusFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (selectedFamily) params.append('family', selectedFamily);
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);
      return api.get(`/frameworks/${id}/controls?${params}`);
    },
    enabled: !!id,
  });

  const statsMap = Object.fromEntries((fw?.stats || []).map(s => [s.status, s.count]));
  const total = fw?.stats.reduce((sum, s) => sum + s.count, 0) || 0;
  const implemented = statsMap['implemented'] || 0;
  const in_progress = statsMap['in_progress'] || 0;
  const not_applicable = statsMap['not_applicable'] || 0;
  const applicable = total - not_applicable;
  const score = applicable > 0 ? ((implemented + in_progress * 0.5) / applicable) * 100 : 0;

  // Family chart data
  const familyMap = new Map<string, { total: number; implemented: number }>();
  for (const ctrl of controlsData?.controls || []) {
    if (!ctrl.family_identifier) continue;
    const key = ctrl.family_identifier;
    const cur = familyMap.get(key) || { total: 0, implemented: 0 };
    cur.total++;
    if (ctrl.status === 'implemented') cur.implemented++;
    familyMap.set(key, cur);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/frameworks" className="btn-ghost p-2">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h2 className="section-header">{fw?.name}</h2>
          <p className="section-subtitle">{fw?.version} — {fw?.description}</p>
        </div>
      </div>

      {/* Score + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-5 md:col-span-1">
          <ScoreRing score={Math.round(score)} size={88} label="Overall" />
          <div>
            <div className="text-sm font-medium text-slate-300">{implemented} implemented</div>
            <div className="text-xs text-slate-500">{in_progress} in progress</div>
            <div className="text-xs text-slate-500">{total} total controls</div>
          </div>
        </div>
        {[
          { label: 'Implemented', count: implemented, color: 'text-emerald-400 bg-emerald-900/20 border border-emerald-900/50', pct: applicable > 0 ? Math.round(implemented / applicable * 100) : 0 },
          { label: 'In Progress', count: in_progress, color: 'text-amber-400 bg-amber-900/20 border border-amber-900/50', pct: applicable > 0 ? Math.round(in_progress / applicable * 100) : 0 },
          { label: 'Not Implemented', count: statsMap['not_implemented'] || 0, color: 'text-red-400 bg-red-900/20 border border-red-900/50', pct: applicable > 0 ? Math.round((statsMap['not_implemented'] || 0) / applicable * 100) : 0 },
        ].map(({ label, count, color, pct }) => (
          <div key={label} className={`card p-5 ${color}`}>
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-sm font-medium mt-0.5">{label}</div>
            <div className="text-xs opacity-70">{pct}% of applicable</div>
          </div>
        ))}
      </div>

      {/* Controls Table */}
      <div className="card">
        {/* Filters */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search controls..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input flex-1 min-w-[200px]"
          />
          <select value={selectedFamily} onChange={e => { setSelectedFamily(e.target.value); setPage(1); }} className="select w-44">
            <option value="">All Families</option>
            {(fw?.families || []).map(f => (
              <option key={f.id} value={f.identifier}>{f.identifier} - {f.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="select w-44">
            <option value="">All Statuses</option>
            <option value="implemented">Implemented</option>
            <option value="in_progress">In Progress</option>
            <option value="not_implemented">Not Implemented</option>
            <option value="not_applicable">Not Applicable</option>
          </select>
          <div className="text-xs text-slate-500">{controlsData?.total || 0} controls</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="table-header p-3 text-left w-24">ID</th>
                <th className="table-header p-3 text-left">Title</th>
                <th className="table-header p-3 text-left hidden md:table-cell w-36">Family</th>
                <th className="table-header p-3 text-left hidden lg:table-cell w-16">Priority</th>
                <th className="table-header p-3 text-left w-32">Status</th>
                <th className="table-header p-3 text-left hidden lg:table-cell w-24">Baseline</th>
              </tr>
            </thead>
            <tbody>
              {(controlsData?.controls || []).map(ctrl => (
                <tr key={ctrl.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <Link to={`/controls/${ctrl.id}`} className="text-primary-400 hover:text-primary-300 font-mono text-xs font-semibold">
                      {ctrl.identifier}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link to={`/controls/${ctrl.id}`} className="text-slate-200 hover:text-primary-400 text-xs">{ctrl.title}</Link>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-slate-500">{ctrl.family_name}</td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="font-mono text-xs text-slate-400">{ctrl.priority}</span>
                  </td>
                  <td className="p-3">
                    <span className={`badge text-xs ${statusColor(ctrl.status)}`}>
                      {ctrl.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <div className="flex gap-0.5">
                      {[['L', ctrl.baseline_low], ['M', ctrl.baseline_moderate], ['H', ctrl.baseline_high]].map(([label, val]) => (
                        <span key={label as string} className={`badge text-xs ${val ? 'bg-primary-900/40 text-primary-300 border-primary-800/40' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(controlsData?.total || 0) > 50 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, controlsData?.total || 0)} of {controlsData?.total}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
              <button disabled={page * 50 >= (controlsData?.total || 0)} onClick={() => setPage(p => p + 1)} className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
