import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, X, ChevronRight, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { statusColor, severityColor, formatDate } from '../lib/utils';

interface Audit {
  id: string; title: string; description: string; type: string; status: string;
  framework_name: string; auditor: string; auditor_firm: string;
  start_date: string; end_date: string; findings_count: number;
  critical_findings: number; high_findings: number;
}

interface Framework { id: string; name: string }

const typeColors: Record<string, string> = {
  internal: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  external: 'bg-purple-900/40 text-purple-300 border-purple-800/50',
  certification: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
  penetration_test: 'bg-red-900/40 text-red-300 border-red-800/50',
  vulnerability_scan: 'bg-orange-900/40 text-orange-300 border-orange-800/50',
};

export default function Audits() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'internal', framework_id: '', auditor: '', auditor_firm: '', scope: '', start_date: '', end_date: '' });

  const { data: audits = [] } = useQuery<Audit[]>({ queryKey: ['audits'], queryFn: () => api.get('/audits') });
  const { data: frameworks = [] } = useQuery<Framework[]>({ queryKey: ['frameworks'], queryFn: () => api.get('/frameworks') });

  const createMutation = useMutation({
    mutationFn: () => api.post('/audits', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['audits'] }); setShowModal(false); },
  });

  const auditsByStatus = audits.reduce<Record<string, number>>((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Audit Management</h2>
          <p className="section-subtitle">Plan, track, and manage compliance audits and findings</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={15} /> New Audit</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Planned', count: auditsByStatus['planned'] || 0, color: 'text-blue-400' },
          { label: 'In Progress', count: auditsByStatus['in_progress'] || 0, color: 'text-amber-400' },
          { label: 'Completed', count: auditsByStatus['completed'] || 0, color: 'text-emerald-400' },
          { label: 'Total', count: audits.length, color: 'text-slate-300' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {audits.map(audit => (
          <Link key={audit.id} to={`/audits/${audit.id}`} className="card-hover p-5 block space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-100">{audit.title}</div>
                {audit.framework_name && <div className="text-xs text-slate-500 mt-0.5">{audit.framework_name}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge text-xs ${statusColor(audit.status)}`}>{audit.status.replace('_', ' ')}</span>
                <span className={`badge text-xs border ${typeColors[audit.type] || ''}`}>{audit.type.replace('_', ' ')}</span>
              </div>
            </div>

            {audit.description && <p className="text-xs text-slate-500">{audit.description}</p>}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Auditor: </span>
                <span className="text-slate-300">{audit.auditor || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Start: </span>
                <span className="text-slate-300">{formatDate(audit.start_date)}</span>
              </div>
            </div>

            {audit.findings_count > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <AlertCircle size={12} className="text-amber-400" />
                <span className="text-xs text-slate-400">{audit.findings_count} findings</span>
                {audit.critical_findings > 0 && <span className="badge text-xs bg-red-900/40 text-red-300 border-red-800/50">{audit.critical_findings} critical</span>}
                {audit.high_findings > 0 && <span className="badge text-xs bg-orange-900/40 text-orange-300 border-orange-800/50">{audit.high_findings} high</span>}
              </div>
            )}

            <div className="flex items-center justify-end">
              <ChevronRight size={14} className="text-slate-600" />
            </div>
          </Link>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">New Audit</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Title</label><input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea rows={2} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['internal', 'external', 'certification', 'penetration_test', 'vulnerability_scan'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Framework</label>
                  <select className="select" value={form.framework_id} onChange={e => setForm(f => ({ ...f, framework_id: e.target.value }))}>
                    <option value="">None</option>
                    {frameworks.map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Auditor</label><input type="text" className="input" value={form.auditor} onChange={e => setForm(f => ({ ...f, auditor: e.target.value }))} /></div>
                <div><label className="label">Auditor Firm</label><input type="text" className="input" value={form.auditor_firm} onChange={e => setForm(f => ({ ...f, auditor_firm: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">Create Audit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
