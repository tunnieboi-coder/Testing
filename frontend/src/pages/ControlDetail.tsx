import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  ChevronLeft, Shield, CheckCircle2, Clock, XCircle, Minus,
  Database, AlertTriangle, Link2, ClipboardList, BookOpen, TestTube2, FileCheck2,
  GitBranch, Plus, Trash2, Save, X, ChevronDown,
} from 'lucide-react';
import api from '../lib/api';
import { statusColor, ciaColor, severityColor, formatDate, truncate } from '../lib/utils';
import { useSystemStore } from '../store/systemStore';

interface ControlDetailData {
  id: string; identifier: string; title: string; description: string; guidance: string;
  status: string; priority: string; responsible_team: string; implementation_notes: string;
  due_date: string; framework_name: string; family_name: string;
  cia_confidentiality: string; cia_integrity: string; cia_availability: string;
  baseline_low: number; baseline_moderate: number; baseline_high: number;
  evidence: Array<{ id: string; title: string; type: string; status: string; collected_at: string; source: string }>;
  risks: Array<{ id: string; title: string; risk_score: number; status: string }>;
  assessmentObjectives: Array<{ id: string; objective_text?: string; objective?: string; objective_id?: string; status: string }>;
  testingProcedures: Array<{ id: string; procedure_type: string; description: string }>;
  mappings: Array<{ id: string; mapped_identifier: string; mapped_title: string; mapped_framework: string }>;
}

interface Inheritance {
  id?: string;
  implementation_type: string;
  provider_name: string | null;
  provider_type: string | null;
  provider_authorization: string | null;
  inherited_description: string | null;
  system_responsibility: string | null;
  authorization_reference: string | null;
  notes: string | null;
}

interface AssessmentStep {
  id: string; system_id: string; control_id: string;
  objective_id: string | null; procedure_id: string | null;
  method: string; object_description: string | null;
  result: string; finding_summary: string | null; recommendation: string | null;
  assessor: string | null; assessed_at: string | null;
  objective_text?: string; objective_code?: string;
  procedure_description?: string;
}

const statusOptions = [
  { value: 'not_implemented', label: 'Not Implemented' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_applicable', label: 'Not Applicable' },
];

const METHOD_COLOR: Record<string, string> = {
  examine: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  interview: 'bg-purple-900/40 text-purple-300 border-purple-800/50',
  test: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
};

const RESULT_COLOR: Record<string, string> = {
  satisfied: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  other_than_satisfied: 'bg-red-900/40 text-red-300 border-red-800/50',
  not_assessed: 'bg-slate-800 text-slate-400 border-slate-700',
};

const defaultStepForm = {
  method: 'examine',
  object_description: '',
  result: 'not_assessed',
  finding_summary: '',
  recommendation: '',
  assessor: '',
  assessed_at: '',
  objective_id: '',
  procedure_id: '',
};

export default function ControlDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { currentSystemId } = useSystemStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'testing' | 'assessment' | 'inheritance' | 'evidence' | 'mappings'>('overview');
  const [editStatus, setEditStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  // Inheritance state
  const [editingInheritance, setEditingInheritance] = useState(false);
  const [inheritForm, setInheritForm] = useState<Inheritance>({
    implementation_type: 'system_specific',
    provider_name: null, provider_type: null, provider_authorization: null,
    inherited_description: null, system_responsibility: null,
    authorization_reference: null, notes: null,
  });

  // Step-level assessment state
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepForm, setStepForm] = useState(defaultStepForm);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const { data: ctrl, isLoading } = useQuery<ControlDetailData>({
    queryKey: ['control', id],
    queryFn: () => api.get(`/controls/${id}`),
  });

  // Inheritance data (requires active system)
  const { data: inheritance } = useQuery<Inheritance>({
    queryKey: ['inheritance', currentSystemId, id],
    queryFn: () => api.get(`/systems/${currentSystemId}/inheritance/${id}`),
    enabled: !!currentSystemId && !!id,
  });

  // Step-level assessment results (requires active system)
  const { data: assessmentSteps = [] } = useQuery<AssessmentStep[]>({
    queryKey: ['assessment-steps', currentSystemId, id],
    queryFn: () => api.get(`/systems/${currentSystemId}/assessment/${id}`),
    enabled: !!currentSystemId && !!id,
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

  const saveInheritanceMutation = useMutation({
    mutationFn: (data: Inheritance) => api.put(`/systems/${currentSystemId}/inheritance/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inheritance', currentSystemId, id] });
      setEditingInheritance(false);
    },
  });

  const addStepMutation = useMutation({
    mutationFn: (data: typeof stepForm) => api.post(`/systems/${currentSystemId}/assessment/${id}`, {
      ...data,
      objective_id: data.objective_id || null,
      procedure_id: data.procedure_id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assessment-steps', currentSystemId, id] });
      setStepForm(defaultStepForm);
      setShowAddStep(false);
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, data }: { stepId: string; data: Partial<AssessmentStep> }) =>
      api.patch(`/systems/${currentSystemId}/assessment/step/${stepId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-steps', currentSystemId, id] }),
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => api.delete(`/systems/${currentSystemId}/assessment/step/${stepId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assessment-steps', currentSystemId, id] }),
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

  const startEditInheritance = () => {
    setInheritForm({
      implementation_type: inheritance?.implementation_type || 'system_specific',
      provider_name: inheritance?.provider_name || null,
      provider_type: inheritance?.provider_type || null,
      provider_authorization: inheritance?.provider_authorization || null,
      inherited_description: inheritance?.inherited_description || null,
      system_responsibility: inheritance?.system_responsibility || null,
      authorization_reference: inheritance?.authorization_reference || null,
      notes: inheritance?.notes || null,
    });
    setEditingInheritance(true);
  };

  const satisfiedCount = assessmentSteps.filter(s => s.result === 'satisfied').length;
  const ots = assessmentSteps.filter(s => s.result === 'other_than_satisfied').length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'testing', label: `Objectives (${ctrl.assessmentObjectives.length})`, icon: TestTube2 },
    { id: 'assessment', label: `Assessment (${assessmentSteps.length})`, icon: ClipboardList },
    { id: 'inheritance', label: 'Inheritance', icon: GitBranch },
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
            {currentSystemId && (
              <span className="badge text-xs bg-primary-900/30 text-primary-300 border-primary-800/40">
                System scoped
              </span>
            )}
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
        {assessmentSteps.length > 0 && (
          <div>
            <div className="label">Step Results</div>
            <div className="flex gap-2">
              <span className="badge text-xs bg-emerald-900/40 text-emerald-300 border-emerald-800/50">{satisfiedCount} Satisfied</span>
              <span className="badge text-xs bg-red-900/40 text-red-300 border-red-800/50">{ots} OTS</span>
            </div>
          </div>
        )}
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
      <div className="border-b border-slate-800 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      {/* ─── Overview ─── */}
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

      {/* ─── Assessment Objectives (legacy) ─── */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assessment Objectives (NIST 800-53A)</h3>
            <div className="space-y-2">
              {ctrl.assessmentObjectives.length === 0 ? (
                <p className="text-xs text-slate-600">No assessment objectives defined</p>
              ) : ctrl.assessmentObjectives.map(obj => (
                <div key={obj.id} className="flex items-start gap-3 p-3 bg-slate-800/40 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-slate-300 leading-relaxed">{obj.objective_text || obj.objective}</p>
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

      {/* ─── Step-Level Assessment Results ─── */}
      {activeTab === 'assessment' && (
        <div className="space-y-4">
          {!currentSystemId ? (
            <div className="card p-6 text-center text-slate-500">
              <ClipboardList size={28} className="mx-auto mb-2 text-slate-700" />
              <p className="text-sm">No active system selected.</p>
              <p className="text-xs mt-1">Select a system from the Systems page to record assessment results.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {assessmentSteps.length > 0 && (
                <div className="card p-4 flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-200">{assessmentSteps.length}</div>
                    <div className="text-xs text-slate-500">Total Steps</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-emerald-400">{satisfiedCount}</div>
                    <div className="text-xs text-slate-500">Satisfied</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-400">{ots}</div>
                    <div className="text-xs text-slate-500">Other Than Satisfied</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-slate-400">{assessmentSteps.filter(s => s.result === 'not_assessed').length}</div>
                    <div className="text-xs text-slate-500">Not Assessed</div>
                  </div>
                </div>
              )}

              {/* Step list */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300">Assessment Step Results</h3>
                  <button onClick={() => setShowAddStep(true)} className="btn-primary text-xs py-1.5">
                    <Plus size={12} /> Add Step
                  </button>
                </div>

                {assessmentSteps.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-xs">
                    No assessment steps recorded yet. Click "Add Step" to record examination, interview, or test results.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {assessmentSteps.map(step => {
                      const isExpanded = expandedStep === step.id;
                      return (
                        <div key={step.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <span className={`badge text-xs border flex-shrink-0 ${METHOD_COLOR[step.method] || ''}`}>
                              {step.method}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  value={step.result}
                                  onChange={e => updateStepMutation.mutate({ stepId: step.id, data: { result: e.target.value } })}
                                  className={`select text-xs py-1 w-44 ${RESULT_COLOR[step.result] ? 'border-current' : ''}`}
                                >
                                  <option value="not_assessed">Not Assessed</option>
                                  <option value="satisfied">Satisfied</option>
                                  <option value="other_than_satisfied">Other Than Satisfied</option>
                                </select>
                                {step.assessor && <span className="text-xs text-slate-500">{step.assessor}</span>}
                                {step.assessed_at && <span className="text-xs text-slate-600">{formatDate(step.assessed_at)}</span>}
                              </div>
                              {step.object_description && (
                                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{step.object_description}</p>
                              )}
                              {step.objective_text && (
                                <p className="text-xs text-slate-500 mt-1 italic">Objective: {step.objective_text}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setExpandedStep(isExpanded ? null : step.id)} className="btn-ghost p-1">
                                <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              <button onClick={() => deleteStepMutation.mutate(step.id)} className="btn-ghost p-1 text-red-400 hover:text-red-300">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 pl-[72px]">
                              {step.finding_summary && (
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Finding</div>
                                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-2.5 rounded">{step.finding_summary}</p>
                                </div>
                              )}
                              {step.recommendation && (
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommendation</div>
                                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/50 p-2.5 rounded">{step.recommendation}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Step Form */}
              {showAddStep && (
                <div className="card p-5 space-y-3 border-primary-800/40">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">Add Assessment Step</h3>
                    <button onClick={() => setShowAddStep(false)} className="btn-ghost p-1"><X size={14} /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Method *</label>
                      <select className="select" value={stepForm.method} onChange={e => setStepForm(f => ({ ...f, method: e.target.value }))}>
                        <option value="examine">Examine</option>
                        <option value="interview">Interview</option>
                        <option value="test">Test</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Result</label>
                      <select className="select" value={stepForm.result} onChange={e => setStepForm(f => ({ ...f, result: e.target.value }))}>
                        <option value="not_assessed">Not Assessed</option>
                        <option value="satisfied">Satisfied</option>
                        <option value="other_than_satisfied">Other Than Satisfied</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Object / Artifact Assessed</label>
                    <input type="text" className="input" placeholder="e.g. Access control policy document, System admin interview, Firewall rule configuration"
                      value={stepForm.object_description} onChange={e => setStepForm(f => ({ ...f, object_description: e.target.value }))} />
                  </div>

                  {ctrl.assessmentObjectives.length > 0 && (
                    <div>
                      <label className="label">Related Objective (optional)</label>
                      <select className="select" value={stepForm.objective_id} onChange={e => setStepForm(f => ({ ...f, objective_id: e.target.value }))}>
                        <option value="">— None —</option>
                        {ctrl.assessmentObjectives.map(obj => (
                          <option key={obj.id} value={obj.id}>
                            {(obj.objective_text || obj.objective || '')?.slice(0, 80)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="label">Finding Summary</label>
                    <textarea rows={2} className="input" placeholder="Describe what was found during the assessment..."
                      value={stepForm.finding_summary} onChange={e => setStepForm(f => ({ ...f, finding_summary: e.target.value }))} />
                  </div>

                  <div>
                    <label className="label">Recommendation</label>
                    <textarea rows={2} className="input" placeholder="Recommended corrective action (if result is Other Than Satisfied)..."
                      value={stepForm.recommendation} onChange={e => setStepForm(f => ({ ...f, recommendation: e.target.value }))} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Assessor</label>
                      <input type="text" className="input" placeholder="Name or role"
                        value={stepForm.assessor} onChange={e => setStepForm(f => ({ ...f, assessor: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Assessed Date</label>
                      <input type="date" className="input"
                        value={stepForm.assessed_at} onChange={e => setStepForm(f => ({ ...f, assessed_at: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setShowAddStep(false)} className="btn-secondary">Cancel</button>
                    <button
                      onClick={() => addStepMutation.mutate(stepForm)}
                      disabled={!stepForm.method || addStepMutation.isPending}
                      className="btn-primary"
                    >
                      <Save size={13} /> Record Step
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Control Inheritance ─── */}
      {activeTab === 'inheritance' && (
        <div className="space-y-4">
          {!currentSystemId ? (
            <div className="card p-6 text-center text-slate-500">
              <GitBranch size={28} className="mx-auto mb-2 text-slate-700" />
              <p className="text-sm">No active system selected.</p>
              <p className="text-xs mt-1">Select a system to configure control inheritance.</p>
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Control Inheritance</h3>
                  <p className="text-xs text-slate-500 mt-0.5">RMF — Define whether this control is system-specific, inherited from a provider, or hybrid</p>
                </div>
                {!editingInheritance && (
                  <button onClick={startEditInheritance} className="btn-secondary text-xs">Edit</button>
                )}
              </div>

              {editingInheritance ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Implementation Type</label>
                    <select className="select" value={inheritForm.implementation_type}
                      onChange={e => setInheritForm(f => ({ ...f, implementation_type: e.target.value }))}>
                      <option value="system_specific">System Specific</option>
                      <option value="inherited">Inherited</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>

                  {inheritForm.implementation_type !== 'system_specific' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Provider Name</label>
                          <input type="text" className="input" placeholder="e.g. AWS GovCloud, DoD PKI"
                            value={inheritForm.provider_name || ''}
                            onChange={e => setInheritForm(f => ({ ...f, provider_name: e.target.value || null }))} />
                        </div>
                        <div>
                          <label className="label">Provider Type</label>
                          <select className="select"
                            value={inheritForm.provider_type || ''}
                            onChange={e => setInheritForm(f => ({ ...f, provider_type: e.target.value || null }))}>
                            <option value="">Select type...</option>
                            <option value="cloud_provider">Cloud Provider</option>
                            <option value="shared_service">Shared Service</option>
                            <option value="organization">Organization</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="label">Provider Authorization (ATO/P-ATO Reference)</label>
                        <input type="text" className="input" placeholder="e.g. FedRAMP ATO, DoD P-ATO"
                          value={inheritForm.provider_authorization || ''}
                          onChange={e => setInheritForm(f => ({ ...f, provider_authorization: e.target.value || null }))} />
                      </div>
                      <div>
                        <label className="label">Inherited Portion Description</label>
                        <textarea rows={2} className="input"
                          placeholder="What portion of this control does the provider implement?"
                          value={inheritForm.inherited_description || ''}
                          onChange={e => setInheritForm(f => ({ ...f, inherited_description: e.target.value || null }))} />
                      </div>
                      <div>
                        <label className="label">MOU/ISA/SLA Reference</label>
                        <input type="text" className="input" placeholder="Reference number for the authorization agreement"
                          value={inheritForm.authorization_reference || ''}
                          onChange={e => setInheritForm(f => ({ ...f, authorization_reference: e.target.value || null }))} />
                      </div>
                    </>
                  )}

                  {(inheritForm.implementation_type === 'system_specific' || inheritForm.implementation_type === 'hybrid') && (
                    <div>
                      <label className="label">System Responsibility</label>
                      <textarea rows={2} className="input"
                        placeholder="What is this system responsible for implementing?"
                        value={inheritForm.system_responsibility || ''}
                        onChange={e => setInheritForm(f => ({ ...f, system_responsibility: e.target.value || null }))} />
                    </div>
                  )}

                  <div>
                    <label className="label">Notes</label>
                    <textarea rows={2} className="input"
                      value={inheritForm.notes || ''}
                      onChange={e => setInheritForm(f => ({ ...f, notes: e.target.value || null }))} />
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setEditingInheritance(false)} className="btn-secondary">Cancel</button>
                    <button
                      onClick={() => saveInheritanceMutation.mutate(inheritForm)}
                      disabled={saveInheritanceMutation.isPending}
                      className="btn-primary"
                    >
                      <Save size={13} /> Save Inheritance
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="label">Implementation Type</div>
                    <span className={`badge text-xs border ${
                      inheritance?.implementation_type === 'inherited' ? 'bg-blue-900/40 text-blue-300 border-blue-800/50' :
                      inheritance?.implementation_type === 'hybrid' ? 'bg-purple-900/40 text-purple-300 border-purple-800/50' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {(inheritance?.implementation_type || 'system_specific').replace(/_/g, ' ')}
                    </span>
                  </div>

                  {inheritance?.provider_name && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="label">Provider</div>
                        <div className="text-sm text-slate-300">{inheritance.provider_name}</div>
                        {inheritance.provider_type && <div className="text-xs text-slate-500 capitalize">{inheritance.provider_type.replace(/_/g, ' ')}</div>}
                      </div>
                      {inheritance.provider_authorization && (
                        <div>
                          <div className="label">Authorization</div>
                          <div className="text-sm text-slate-300">{inheritance.provider_authorization}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {inheritance?.inherited_description && (
                    <div>
                      <div className="label">Inherited Portion</div>
                      <p className="text-sm text-slate-400 leading-relaxed">{inheritance.inherited_description}</p>
                    </div>
                  )}
                  {inheritance?.system_responsibility && (
                    <div>
                      <div className="label">System Responsibility</div>
                      <p className="text-sm text-slate-400 leading-relaxed">{inheritance.system_responsibility}</p>
                    </div>
                  )}
                  {inheritance?.authorization_reference && (
                    <div>
                      <div className="label">MOU/ISA/SLA Reference</div>
                      <div className="text-sm text-slate-300">{inheritance.authorization_reference}</div>
                    </div>
                  )}
                  {inheritance?.notes && (
                    <div>
                      <div className="label">Notes</div>
                      <p className="text-sm text-slate-400 leading-relaxed">{inheritance.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Evidence ─── */}
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

      {/* ─── Mappings ─── */}
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
