import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { ChevronLeft, AlertCircle, Plus, X } from 'lucide-react';
import api from '../lib/api';
import { statusColor, severityColor, formatDate } from '../lib/utils';

interface Finding {
  id: string; title: string; description: string; severity: string; status: string;
  recommendation: string; management_response: string; due_date: string; remediated_at: string;
  control_identifier: string;
}

interface AuditDetail {
  id: string; title: string; description: string; type: string; status: string;
  framework_name: string; auditor: string; auditor_firm: string; scope: string;
  start_date: string; end_date: string; findings_count: number;
  critical_findings: number; high_findings: number; medium_findings: number; low_findings: number;
  findings: Finding[];
}

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showFindingModal, setShowFindingModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'medium', recommendation: '', due_date: '' });

  const { data: audit, isLoading } = useQuery<AuditDetail>({
    queryKey: ['audit', id],
    queryFn: () => api.get(`/audits/${id}`),
  });

  const addFindingMutation = useMutation({
    mutationFn: () => api.post(`/audits/${id}/findings`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['audit', id] }); setShowFindingModal(false); },
  });

  const updateFindingMutation = useMutation({
    mutationFn: ({ findingId, body }: { findingId: string; body: Record<string, unknown> }) =>
      api.patch(`/audits/findings/${findingId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', id] }),
  });

  if (isLoading || !audit) return (
    <div className="flex items-center justify-center h-64"><div className="text-slate-400">Loading...</div></div>
  );

  const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
  const sortedFindings = [...(audit.findings || [])].sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity));

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/audits" className="btn-ghost p-2"><ChevronLeft size={16} /></Link>
        <div>
          <h2 className="section-header">{audit.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge text-xs ${statusColor(audit.status)}`}>{audit.status.replace('_', ' ')}</span>
            {audit.framework_name && <span className="badge text-xs bg-slate-800 text-slate-400 border-slate-700">{audit.framework_name}</span>}
            {audit.auditor && <span className="text-xs text-slate-500">Auditor: {audit.auditor}{audit.auditor_firm ? ` (${audit.auditor_firm})` : ''}</span>}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical', count: audit.critical_findings, color: 'text-red-400 bg-red-900/20 border-red-900/40' },
          { label: 'High', count: audit.high_findings, color: 'text-orange-400 bg-orange-900/20 border-orange-900/40' },
          { label: 'Medium', count: audit.medium_findings, color: 'text-amber-400 bg-amber-900/20 border-amber-900/40' },
          { label: 'Low', count: audit.low_findings, color: 'text-emerald-400 bg-emerald-900/20 border-emerald-900/40' },
        ].map(({ label, count, color }) => (
          <div key={label} className={`card p-4 border ${color}`}>
            <div className="text-2xl font-bold">{count || 0}</div>
            <div className="text-sm">{label} Findings</div>
          </div>
        ))}
      </div>

      {/* Findings */}
      <div className="card">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Findings</h3>
          <button onClick={() => setShowFindingModal(true)} className="btn-secondary text-xs"><Plus size={13} /> Add Finding</button>
        </div>
        <div className="divide-y divide-slate-800">
          {sortedFindings.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No findings recorded</div>
          ) : sortedFindings.map(finding => (
            <div key={finding.id} className="p-4 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertCircle size={14} className={finding.severity === 'critical' ? 'text-red-400' : finding.severity === 'high' ? 'text-orange-400' : 'text-amber-400'} />
                  <div>
                    <div className="text-sm font-medium text-slate-200">{finding.title}</div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{finding.description}</p>
                    {finding.recommendation && (
                      <div className="mt-2 p-2 bg-slate-800/40 rounded text-xs text-slate-300">
                        <span className="text-slate-500">Recommendation: </span>{finding.recommendation}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`badge text-xs border ${severityColor(finding.severity)}`}>{finding.severity}</span>
                  <select
                    value={finding.status}
                    onChange={e => updateFindingMutation.mutate({ findingId: finding.id, body: { status: e.target.value } })}
                    className={`text-xs bg-transparent border-0 outline-none cursor-pointer ${finding.status === 'open' ? 'text-red-400' : finding.status === 'remediated' ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {['open', 'in_progress', 'remediated', 'accepted', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {finding.due_date && <span className="text-xs text-slate-500">Due: {formatDate(finding.due_date)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showFindingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Finding</h3>
              <button onClick={() => setShowFindingModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Title</label><input type="text" className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea rows={3} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><label className="label">Recommendation</label><textarea rows={2} className="input" value={form.recommendation} onChange={e => setForm(f => ({ ...f, recommendation: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Severity</label>
                  <select className="select" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                    {['critical', 'high', 'medium', 'low', 'informational'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFindingModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => addFindingMutation.mutate()} disabled={!form.title || addFindingMutation.isPending} className="btn-primary">Add Finding</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
