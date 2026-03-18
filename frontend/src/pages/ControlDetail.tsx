import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  ChevronLeft, Shield, CheckCircle2, Clock, XCircle, Minus,
  Database, AlertTriangle, Link2, ClipboardList, BookOpen, TestTube2, FileCheck2,
} from 'lucide-react';
import api from '../lib/api';
import { statusColor, ciaColor, severityColor, formatDate, truncate } from '../lib/utils';

interface ControlDetailData {
  id: string; identifier: string; title: string; description: string; guidance: string;
  status: string; priority: string; responsible_team: string; implementation_notes: string;
  due_date: string; framework_name: string; family_name: string;
  cia_confidentiality: string; cia_integrity: string; cia_availability: string;
  baseline_low: number; baseline_moderate: number; baseline_high: number;
  evidence: Array<{ id: string; title: string; type: string; status: string; collected_at: string; source: string }>;
  risks: Array<{ id: string; title: string; risk_score: number; status: string }>;
  assessmentObjectives: Array<{ id: string; objective: string; status: string }>;
  testingProcedures: Array<{ id: string; procedure_type: string; description: string }>;
  mappings: Array<{ id: string; mapped_identifier: string; mapped_title: string; mapped_framework: string }>;
}

const statusOptions = [
  { value: 'not_implemented', label: 'Not Implemented' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

export default function ControlDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'testing' | 'evidence' | 'mappings'>('overview');
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  const { data: ctrl, isLoading } = useQuery<ControlDetailData>({
    queryKey: ['control', id],
    queryFn: () => api.get(`/controls/${id}`),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.patch(`/controls/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control', id] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setEditStatus(false);
    },
  });

  const objMutation = useMutation({
    mutationFn: ({ objId, status }: { objId: string; status: string }) =>
      api.patch(`/controls/assessment-objectives/${objId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['control', id] }),
  });

  if (isLoading || !ctrl) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Loading control...
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'testing', label: `Testing (${ctrl.assessmentObjectives.length})`, icon: TestTube2 },
    { id: 'evidence', label: `Evidence (${ctrl.evidence.length})`, icon: Database },
    { id: 'mappings', label: `Mappings (${ctrl.mappings.length})`, icon: Link2 },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/controls" className="btn-ghost p-2"><ChevronLeft size={16} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-primary-400 text-lg font-bold">{ctrl.identifier}</span>
            <span className={`badge text-xs ${statusColor(ctrl.status)}`}>{ctrl.status.replace(/_/g, ' ')}</span>
            <span className="badge text-xs bg-slate-800 text-slate-400 border border-slate-700">{ctrl.priority}</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mt-1">{ctrl.title}</h2>
          <div className="text-xs text-slate-500 mt-0.5">{ctrl.framework_name} › {ctrl.family_name}</div>
        </div>
      </div>

      {/* CIA Profile + Baselines */}
      <div className="card p-4 flex flex-wrap gap-6">
        <div>
          <div className="label">CIA Impact (800-53A)</div>
          <div className="flex gap-2">
            {[['C', ctrl.cia_confidentiality], ['I', ctrl.cia_integrity], ['A', ctrl.cia_availability]].map(([label, val]) => (
              <span key={label} className={`badge text-xs font-mono ${ciaColor(val)}`}>{label}: {val}</span>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Baselines</div>
          <div className="flex gap-2">
            {[['Low', ctrl.baseline_low], ['Moderate', ctrl.baseline_moderate], ['High', ctrl.baseline_high]].map(([label, val]) => (
              <span key={label} className={`badge text-xs ${val ? 'bg-primary-900/40 text-primary-300 border border-primary-800/40' : 'bg-slate-800 text-slate-600 border-slate-700'}`}>{label}</span>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {editStatus ? (
            <>
              <select value={newStatus || ctrl.status} onChange={e => setNewStatus(e.target.value)} className="select text-xs py-1.5 w-40">
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={() => updateMutation.mutate({ status: newStatus || ctrl.status, implementation_notes: notes || ctrl.implementation_notes })} className="btn-primary text-xs py-1.5">Save</button>
              <button onClick={() => setEditStatus(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
            </>
          ) : (
            <button onClick={() => { setEditStatus(true); setNewStatus(ctrl.status); setNotes(ctrl.implementation_notes || ''); }} className="btn-secondary text-xs">Update Status</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 flex gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Control Description</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{ctrl.description}</p>
          </div>
          {ctrl.guidance && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Discussion & Guidance</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{ctrl.guidance}</p>
            </div>
          )}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Implementation</h3>
            {editStatus ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="input text-sm"
                placeholder="Describe how this control is implemented..."
              />
            ) : (
              <p className="text-sm text-slate-400 leading-relaxed">
                {ctrl.implementation_notes || <span className="text-slate-600 italic">No implementation notes</span>}
              </p>
            )}
          </div>
          {ctrl.risks.length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Associated Risks</h3>
              <div className="space-y-2">
                {ctrl.risks.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2.5 bg-slate-800/50 rounded-lg">
                    <span className="text-xs text-slate-300">{r.title}</span>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${r.risk_score >= 20 ? 'bg-red-900/40 text-red-300 border-red-800/50' : r.risk_score >= 15 ? 'bg-orange-900/40 text-orange-300 border-orange-800/50' : r.risk_score >= 9 ? 'bg-amber-900/40 text-amber-300 border-amber-800/50' : 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50'}`}>Score: {r.risk_score}</span>
                      <span className={`badge text-xs ${statusColor(r.status)}`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'testing' && (
        <div className="space-y-4">
          {/* Assessment Objectives */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assessment Objectives (NIST 800-53A)</h3>
            <div className="space-y-2">
              {ctrl.assessmentObjectives.length === 0 ? (
                <p className="text-xs text-slate-600">No assessment objectives defined</p>
              ) : ctrl.assessmentObjectives.map(obj => (
                <div key={obj.id} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-slate-300 leading-relaxed">{obj.objective}</p>
                  </div>
                  <select
                    value={obj.status}
                    onChange={e => objMutation.mutate({ objId: obj.id, status: e.target.value })}
                    className={`select text-xs py-1 w-36 flex-shrink-0 ${obj.status === 'satisfied' ? 'border-emerald-700 text-emerald-300' : obj.status === 'other_than_satisfied' ? 'border-red-700 text-red-300' : 'border-slate-700 text-slate-400'}`}
                  >
                    <option value="not_assessed">Not Assessed</option>
                    <option value="satisfied">Satisfied</option>
                    <option value="other_than_satisfied">Other Than Satisfied</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Testing Procedures */}
          {['examine', 'interview', 'test'].map(type => {
            const procs = ctrl.testingProcedures.filter(p => p.procedure_type === type);
            if (procs.length === 0) return null;
            const icons = { examine: FileCheck2, interview: BookOpen, test: TestTube2 };
            const Icon = icons[type as keyof typeof icons];
            const colors = { examine: 'text-blue-400', interview: 'text-purple-400', test: 'text-amber-400' };
            return (
              <div key={type} className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} className={colors[type as keyof typeof colors]} />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider capitalize">{type} Procedures</h3>
                </div>
                <ul className="space-y-1.5">
                  {procs.map(p => (
                    <li key={p.id} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span>
                      <span className="leading-relaxed">{p.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Evidence Items</h3>
          {ctrl.evidence.length === 0 ? (
            <p className="text-xs text-slate-600">No evidence attached</p>
          ) : (
            <div className="space-y-2">
              {ctrl.evidence.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-lg">
                  <Database size={14} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">{ev.title}</div>
                    <div className="text-xs text-slate-500">{ev.source} • {formatDate(ev.collected_at)}</div>
                  </div>
                  <span className={`badge text-xs ${statusColor(ev.status)}`}>{ev.status}</span>
                  <span className="badge text-xs bg-slate-800 text-slate-400 border-slate-700">{ev.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mappings' && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cross-Framework Mappings</h3>
          {ctrl.mappings.length === 0 ? (
            <p className="text-xs text-slate-600">No cross-framework mappings</p>
          ) : (
            <div className="space-y-2">
              {ctrl.mappings.map(m => (
                <div key={m.id} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg">
                  <Link2 size={14} className="text-primary-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary-400 font-semibold">{m.mapped_identifier}</span>
                      <span className="badge text-xs bg-slate-800 text-slate-400 border-slate-700">{m.mapped_framework}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{m.mapped_title}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
