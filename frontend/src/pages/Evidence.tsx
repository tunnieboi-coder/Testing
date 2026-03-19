import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Plus, X, ExternalLink, Sparkles, CheckCircle2, AlertTriangle, HelpCircle, MinusCircle } from 'lucide-react';
import api from '../lib/api';
import { statusColor, formatDate } from '../lib/utils';

interface Evidence {
  id: string; title: string; description: string; type: string; source: string;
  url: string; status: string; collected_at: string; expires_at: string;
  collected_by: string; mapped_controls: string;
  ai_confidence: number | null;
  ai_verdict: 'satisfies' | 'partial' | 'insufficient' | 'unclear' | null;
  ai_summary: string | null;
  ai_gaps: string | null;
  ai_reviewed_at: string | null;
  review_notes: string | null;
}

interface AIReviewResult {
  confidence: number;
  verdict: 'satisfies' | 'partial' | 'insufficient' | 'unclear';
  summary: string;
  gaps: string[];
  reviewed_at: string;
}

const VERDICT_CONFIG = {
  satisfies:    { icon: <CheckCircle2 size={12} />, color: 'text-emerald-400', bg: 'bg-emerald-900/30 border-emerald-800/50', label: 'Satisfies' },
  partial:      { icon: <MinusCircle size={12} />,  color: 'text-amber-400',   bg: 'bg-amber-900/30 border-amber-800/50',   label: 'Partial' },
  insufficient: { icon: <AlertTriangle size={12} />,color: 'text-red-400',     bg: 'bg-red-900/30 border-red-800/50',       label: 'Insufficient' },
  unclear:      { icon: <HelpCircle size={12} />,   color: 'text-slate-400',   bg: 'bg-slate-800 border-slate-700',         label: 'Unclear' },
};

const typeColors: Record<string, string> = {
  document: 'text-blue-400', screenshot: 'text-purple-400', config: 'text-emerald-400',
  log: 'text-amber-400', attestation: 'text-pink-400',
};

export default function Evidence() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: 'document', source: 'manual', url: '', expires_at: '', collected_by: '' });
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, AIReviewResult>>({});

  const aiReviewMutation = useMutation({
    mutationFn: (id: string) => {
      setReviewingId(id);
      return api.post(`/evidence/${id}/ai-review`, {}) as Promise<AIReviewResult>;
    },
    onSuccess: (data, id) => {
      setAiResult(r => ({ ...r, [id]: data }));
      setReviewingId(null);
      qc.invalidateQueries({ queryKey: ['evidence'] });
    },
    onError: () => setReviewingId(null),
  });

  const { data: evidence = [] } = useQuery<Evidence[]>({
    queryKey: ['evidence', search, typeFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (typeFilter) p.append('type', typeFilter);
      return api.get(`/evidence?${p}`);
    },
  });

  const { data: stats } = useQuery<{ total: number; valid: number; expired: number; byType: Array<{ type: string; count: number }>; bySource: Array<{ source: string; count: number }> }>({
    queryKey: ['evidence-stats'],
    queryFn: () => api.get('/evidence/stats'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/evidence', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evidence'] }); qc.invalidateQueries({ queryKey: ['evidence-stats'] }); setShowModal(false); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Evidence Management</h2>
          <p className="section-subtitle">Collect and manage compliance evidence</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={15} /> Add Evidence</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Items', count: stats?.total || 0, color: 'text-slate-300' },
          { label: 'Valid', count: stats?.valid || 0, color: 'text-emerald-400' },
          { label: 'Expired', count: stats?.expired || 0, color: 'text-red-400' },
          { label: 'By Integration', count: evidence.filter(e => e.source === 'automated' || e.source === 'integration').length, color: 'text-primary-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search evidence..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select w-36">
          <option value="">All Types</option>
          {['document', 'screenshot', 'config', 'log', 'attestation'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header p-3 text-left">Evidence</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-24">Type</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-24">Source</th>
              <th className="table-header p-3 text-left hidden lg:table-cell">Controls</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-28">Collected</th>
              <th className="table-header p-3 text-left w-28">Status</th>
              <th className="table-header p-3 text-left w-44 hidden xl:table-cell">AI Review</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map(ev => (
              <tr key={ev.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-slate-200">{ev.title}</div>
                    {ev.url && <a href={ev.url} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary-400"><ExternalLink size={11} /></a>}
                  </div>
                  {ev.description && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{ev.description}</div>}
                </td>
                <td className="p-3 hidden md:table-cell">
                  <span className={`text-xs font-medium capitalize ${typeColors[ev.type] || 'text-slate-400'}`}>{ev.type}</span>
                </td>
                <td className="p-3 hidden md:table-cell text-xs text-slate-500 capitalize">{ev.source}</td>
                <td className="p-3 hidden lg:table-cell text-xs text-slate-500 font-mono">{ev.mapped_controls || '—'}</td>
                <td className="p-3 hidden lg:table-cell text-xs text-slate-500">{formatDate(ev.collected_at)}</td>
                <td className="p-3">
                  <span className={`badge text-xs ${statusColor(ev.status)}`}>{ev.status.replace('_', ' ')}</span>
                </td>
                <td className="p-3 hidden xl:table-cell">
                  {(() => {
                    const cached = aiResult[ev.id];
                    const verdict = cached?.verdict ?? ev.ai_verdict;
                    const confidence = cached?.confidence ?? ev.ai_confidence;
                    const summary = cached?.summary ?? ev.ai_summary;
                    const gaps: string[] = cached?.gaps ?? (ev.ai_gaps ? JSON.parse(ev.ai_gaps) : []);
                    const cfg = verdict ? VERDICT_CONFIG[verdict] : null;
                    const isLoading = reviewingId === ev.id;

                    if (isLoading) {
                      return (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Sparkles size={12} className="text-primary-400 animate-pulse" />
                          Reviewing…
                        </div>
                      );
                    }

                    if (cfg && verdict) {
                      return (
                        <div className="space-y-1">
                          <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}
                            {cfg.label}
                            <span className="ml-1 opacity-70">{confidence}%</span>
                          </div>
                          {summary && <div className="text-xs text-slate-500 leading-relaxed max-w-[180px] line-clamp-2">{summary}</div>}
                          {gaps.length > 0 && (
                            <div className="text-xs text-red-400/70">
                              {gaps.length} gap{gaps.length > 1 ? 's' : ''} identified
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <button
                        onClick={() => aiReviewMutation.mutate(ev.id)}
                        className="btn-ghost text-xs flex items-center gap-1 text-slate-500 hover:text-primary-400"
                      >
                        <Sparkles size={11} />
                        AI Review
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Evidence</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Title</label><input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea rows={2} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['document', 'screenshot', 'config', 'log', 'attestation'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Source</label>
                  <select className="select" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    {['manual', 'automated', 'integration'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">URL (optional)</label><input type="url" className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Collected By</label><input type="text" className="input" value={form.collected_by} onChange={e => setForm(f => ({ ...f, collected_by: e.target.value }))} /></div>
                <div><label className="label">Expires At</label><input type="date" className="input" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">Add Evidence</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
