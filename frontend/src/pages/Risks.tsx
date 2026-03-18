import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, X, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import { riskScoreBg, riskLabel, statusColor, formatDate } from '../lib/utils';

interface Risk {
  id: string; title: string; description: string; category: string;
  likelihood: number; impact: number; risk_score: number;
  status: string; owner: string; treatment: string; due_date: string;
  residual_likelihood: number; residual_impact: number;
}

export default function Risks() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'technical', likelihood: 3, impact: 3, owner: '', treatment: 'mitigate', due_date: '' });

  const { data: risks, isLoading } = useQuery<Risk[]>({
    queryKey: ['risks', search, category, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (category) p.append('category', category);
      if (statusFilter) p.append('status', statusFilter);
      return api.get(`/risks?${p}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/risks', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risks'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); setShowModal(false); setForm({ title: '', description: '', category: 'technical', likelihood: 3, impact: 3, owner: '', treatment: 'mitigate', due_date: '' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/risks/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risks'] }); qc.invalidateQueries({ queryKey: ['dashboard-stats'] }); },
  });

  const byCat = (risks || []).reduce<Record<string, number>>((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});
  const sorted = [...(risks || [])].sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Risk Register</h2>
          <p className="section-subtitle">Track, assess, and treat organizational risks</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Add Risk
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', filter: (r: Risk) => r.risk_score >= 20 && r.status !== 'closed', color: 'text-red-400', bg: 'bg-red-900/20 border-red-900/40' },
          { label: 'High', filter: (r: Risk) => r.risk_score >= 15 && r.risk_score < 20 && r.status !== 'closed', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-900/40' },
          { label: 'Medium', filter: (r: Risk) => r.risk_score >= 9 && r.risk_score < 15 && r.status !== 'closed', color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-900/40' },
          { label: 'Low', filter: (r: Risk) => r.risk_score < 9 && r.status !== 'closed', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-900/40' },
        ].map(({ label, filter, color, bg }) => (
          <div key={label} className={`card p-4 border ${bg}`}>
            <div className={`text-2xl font-bold ${color}`}>{sorted.filter(filter).length}</div>
            <div className="text-sm text-slate-400">{label} Risk</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search risks..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="select w-40">
          <option value="">All Categories</option>
          {['technical', 'operational', 'compliance', 'strategic', 'financial'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-36">
          <option value="">All Statuses</option>
          {['open', 'in_progress', 'mitigated', 'accepted', 'transferred', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Risks Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header p-3 text-left">Risk</th>
              <th className="table-header p-3 text-center w-16">L×I</th>
              <th className="table-header p-3 text-center w-24">Score</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-28">Category</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-28">Owner</th>
              <th className="table-header p-3 text-left w-28">Status</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-24">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading...</td></tr>
            ) : sorted.map(risk => (
              <tr key={risk.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
                <td className="p-3">
                  <div className="text-xs font-medium text-slate-200 max-w-xs">{risk.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{risk.description}</div>
                </td>
                <td className="p-3 text-center">
                  <span className="font-mono text-xs text-slate-400">{risk.likelihood}×{risk.impact}</span>
                </td>
                <td className="p-3 text-center">
                  <span className={`badge text-xs font-bold ${riskScoreBg(risk.risk_score)}`}>{risk.risk_score} — {riskLabel(risk.risk_score)}</span>
                </td>
                <td className="p-3 hidden md:table-cell text-xs text-slate-400 capitalize">{risk.category}</td>
                <td className="p-3 hidden lg:table-cell text-xs text-slate-400">{risk.owner || '—'}</td>
                <td className="p-3">
                  <select
                    value={risk.status}
                    onChange={e => updateMutation.mutate({ id: risk.id, body: { status: e.target.value } })}
                    className={`text-xs bg-transparent border-0 outline-none cursor-pointer font-medium ${risk.status === 'open' ? 'text-red-400' : risk.status === 'in_progress' ? 'text-amber-400' : risk.status === 'mitigated' ? 'text-emerald-400' : 'text-slate-400'}`}
                  >
                    {['open', 'in_progress', 'mitigated', 'accepted', 'transferred', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="p-3 hidden lg:table-cell text-xs text-slate-400 capitalize">{risk.treatment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Risk Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">Add Risk</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Risk title..." />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the risk..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {['technical', 'operational', 'compliance', 'strategic', 'financial'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Treatment</label>
                  <select className="select" value={form.treatment} onChange={e => setForm(f => ({ ...f, treatment: e.target.value }))}>
                    {['mitigate', 'accept', 'transfer', 'avoid'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Likelihood (1-5): {form.likelihood}</label>
                  <input type="range" min={1} max={5} value={form.likelihood} onChange={e => setForm(f => ({ ...f, likelihood: parseInt(e.target.value) }))} className="w-full accent-primary-500" />
                </div>
                <div>
                  <label className="label">Impact (1-5): {form.impact}</label>
                  <input type="range" min={1} max={5} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: parseInt(e.target.value) }))} className="w-full accent-primary-500" />
                </div>
              </div>
              <div className="text-center">
                <span className={`badge text-sm font-bold ${riskScoreBg(form.likelihood * form.impact)}`}>Risk Score: {form.likelihood * form.impact} — {riskLabel(form.likelihood * form.impact)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Owner</label>
                  <input type="text" className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} placeholder="Risk owner..." />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Creating...' : 'Create Risk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
