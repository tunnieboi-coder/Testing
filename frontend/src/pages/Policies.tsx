import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, X, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import { statusColor, formatDate } from '../lib/utils';

interface Policy {
  id: string; title: string; description: string; category: string;
  status: string; version: string; owner: string; approver: string;
  review_frequency: string; last_reviewed_at: string; next_review_at: string; published_at: string;
}

const categoryColors: Record<string, string> = {
  security: 'text-primary-400 bg-primary-900/30 border-primary-800/40',
  privacy: 'text-purple-400 bg-purple-900/30 border-purple-800/40',
  hr: 'text-green-400 bg-green-900/30 border-green-800/40',
  it: 'text-blue-400 bg-blue-900/30 border-blue-800/40',
  compliance: 'text-amber-400 bg-amber-900/30 border-amber-800/40',
  operational: 'text-cyan-400 bg-cyan-900/30 border-cyan-800/40',
};

export default function Policies() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'security', status: 'draft', version: '1.0', owner: '', approver: '', review_frequency: 'annual' });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ['policies', search, category, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (category) p.append('category', category);
      if (statusFilter) p.append('status', statusFilter);
      return api.get(`/policies?${p}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/policies', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policies'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/policies/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });

  const overdueCount = policies.filter(p => p.status === 'published' && p.next_review_at && new Date(p.next_review_at) < new Date()).length;
  const dueSOon = policies.filter(p => p.status === 'published' && p.next_review_at && new Date(p.next_review_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && new Date(p.next_review_at) >= new Date()).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Policy Management</h2>
          <p className="section-subtitle">Create, review, and publish organizational policies</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={15} /> New Policy</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Published', count: policies.filter(p => p.status === 'published').length, color: 'text-emerald-400' },
          { label: 'In Review', count: policies.filter(p => p.status === 'review').length, color: 'text-amber-400' },
          { label: 'Overdue Review', count: overdueCount, color: 'text-red-400' },
          { label: 'Due Soon', count: dueSOon, color: 'text-orange-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search policies..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="select w-36">
          <option value="">All Categories</option>
          {['security', 'privacy', 'hr', 'it', 'compliance', 'operational'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-32">
          <option value="">All Statuses</option>
          {['draft', 'review', 'approved', 'published', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header p-3 text-left">Policy</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-28">Category</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-20">Version</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-32">Owner</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-28">Next Review</th>
              <th className="table-header p-3 text-left w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {policies.map(policy => {
              const isOverdue = policy.status === 'published' && policy.next_review_at && new Date(policy.next_review_at) < new Date();
              return (
                <tr key={policy.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {isOverdue && <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />}
                      <div>
                        <div className="text-xs font-medium text-slate-200">{policy.title}</div>
                        {policy.description && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{policy.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className={`badge text-xs border ${categoryColors[policy.category] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>{policy.category}</span>
                  </td>
                  <td className="p-3 hidden md:table-cell font-mono text-xs text-slate-400">{policy.version}</td>
                  <td className="p-3 hidden lg:table-cell text-xs text-slate-400">{policy.owner || '—'}</td>
                  <td className={`p-3 hidden lg:table-cell text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                    {formatDate(policy.next_review_at)}
                  </td>
                  <td className="p-3">
                    <select
                      value={policy.status}
                      onChange={e => updateMutation.mutate({ id: policy.id, body: { status: e.target.value } })}
                      className={`text-xs bg-transparent border-0 outline-none cursor-pointer font-medium ${policy.status === 'published' ? 'text-emerald-400' : policy.status === 'review' ? 'text-amber-400' : policy.status === 'draft' ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      {['draft', 'review', 'approved', 'published', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">New Policy</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Title</label><input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea rows={2} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Category</label>
                  <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {['security', 'privacy', 'hr', 'it', 'compliance', 'operational'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Version</label><input type="text" className="input" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Owner</label><input type="text" className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
                <div><label className="label">Approver</label><input type="text" className="input" value={form.approver} onChange={e => setForm(f => ({ ...f, approver: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Review Frequency</label>
                  <select className="select" value={form.review_frequency} onChange={e => setForm(f => ({ ...f, review_frequency: e.target.value }))}>
                    {['monthly', 'quarterly', 'annual'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div><label className="label">Initial Status</label>
                  <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['draft', 'review', 'approved', 'published'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">Create Policy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
