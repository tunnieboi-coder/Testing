import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Server, ChevronLeft, Shield, CheckCircle2, Clock, AlertTriangle,
  BarChart3, Layers, Edit2, Save, X, ExternalLink,
} from 'lucide-react';
import api from '../lib/api';
import { useSystemStore } from '../store/systemStore';
import { formatDate } from '../lib/utils';

interface GRCSystem {
  id: string; name: string; description: string; system_type: string; status: string;
  system_owner: string; authorizing_official: string; organization: string;
  boundary_description: string; authorization_date: string; reauthorization_date: string;
  security_category_confidentiality: string; security_category_integrity: string;
  security_category_availability: string; impact_level: string; applicable_baseline: string;
  implementationStats: Record<string, number>;
  inheritanceStats: Record<string, number>;
  assessmentStats: Record<string, number>;
}

interface ComplianceSummary {
  id: string; name: string; version: string; score: number;
  total: number; implemented: number; in_progress: number; not_implemented: number; not_applicable: number;
}

const IMPACT_COLOR: Record<string, string> = {
  Low: 'text-emerald-400', Moderate: 'text-amber-400', High: 'text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  assessment_in_progress: 'Assessment In Progress',
  authorized: 'Authorized',
  under_review: 'Under Review',
  decommissioned: 'Decommissioned',
};

const STATUS_COLOR: Record<string, string> = {
  assessment_in_progress: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  authorized: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  under_review: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
  decommissioned: 'bg-slate-800 text-slate-500 border-slate-700',
};

export default function SystemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentSystemId, setCurrentSystem } = useSystemStore();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<GRCSystem>>({});

  const { data: system, isLoading } = useQuery<GRCSystem>({
    queryKey: ['system', id],
    queryFn: () => api.get(`/systems/${id}`),
    enabled: !!id,
  });

  const { data: compliance = [] } = useQuery<ComplianceSummary[]>({
    queryKey: ['system-compliance', id],
    queryFn: () => api.get(`/systems/${id}/compliance-summary`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<GRCSystem>) => api.patch(`/systems/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system', id] });
      qc.invalidateQueries({ queryKey: ['systems'] });
      setEditing(false);
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!system) return <div className="text-slate-400">System not found</div>;

  const isActive = system.id === currentSystemId;
  const totalControls = (system.implementationStats?.not_implemented || 0) +
    (system.implementationStats?.in_progress || 0) +
    (system.implementationStats?.implemented || 0) +
    (system.implementationStats?.not_applicable || 0);
  const assessedSteps = (system.assessmentStats?.satisfied || 0) +
    (system.assessmentStats?.other_than_satisfied || 0);
  const totalSteps = assessedSteps + (system.assessmentStats?.not_assessed || 0);

  const startEdit = () => {
    setEditForm({
      name: system.name,
      description: system.description,
      system_type: system.system_type,
      status: system.status,
      system_owner: system.system_owner,
      authorizing_official: system.authorizing_official,
      organization: system.organization,
      boundary_description: system.boundary_description,
      authorization_date: system.authorization_date,
      reauthorization_date: system.reauthorization_date,
    });
    setEditing(true);
  };

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div>
        <button onClick={() => navigate('/systems')} className="btn-ghost text-xs mb-3 -ml-1">
          <ChevronLeft size={14} /> All Systems
        </button>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <Server size={18} className="text-primary-400" />
            </div>
            <div>
              {editing ? (
                <input className="input text-base font-semibold py-1 px-2" value={editForm.name || ''}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              ) : (
                <h2 className="section-header">{system.name}</h2>
              )}
              <span className={`badge text-xs border mt-1 ${STATUS_COLOR[system.status] || ''}`}>
                {STATUS_LABELS[system.status] || system.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isActive && (
              <button onClick={() => setCurrentSystem(system.id)} className="btn-primary text-xs">
                <CheckCircle2 size={13} /> Set Active
              </button>
            )}
            {isActive && (
              <span className="badge bg-primary-900/40 text-primary-300 border-primary-800/50 text-xs">Active System</span>
            )}
            {editing ? (
              <>
                <button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending} className="btn-primary text-xs">
                  <Save size={13} /> Save
                </button>
                <button onClick={() => setEditing(false)} className="btn-secondary text-xs"><X size={13} /></button>
              </>
            ) : (
              <button onClick={startEdit} className="btn-secondary text-xs"><Edit2 size={13} /> Edit</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Security Category */}
        <div className="card p-4 col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-primary-400" />
            <span className="text-xs font-semibold text-slate-300">Security Categorization (FIPS 199)</span>
            <Link to={`/categorization?system=${system.id}`} className="ml-auto text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
              Manage <ExternalLink size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Confidentiality', val: system.security_category_confidentiality },
              { label: 'Integrity', val: system.security_category_integrity },
              { label: 'Availability', val: system.security_category_availability },
              { label: 'Overall', val: system.impact_level, bold: true },
            ].map(({ label, val, bold }) => (
              <div key={label} className="text-center">
                <div className={`text-lg font-bold ${IMPACT_COLOR[val] || 'text-slate-400'} ${bold ? 'text-2xl' : ''}`}>
                  {val?.[0] || 'L'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-2">
            <span className="text-xs text-slate-500">Applicable Baseline:</span>
            <span className={`text-xs font-semibold ${IMPACT_COLOR[system.applicable_baseline] || 'text-slate-400'}`}>
              {system.applicable_baseline} Baseline
            </span>
          </div>
        </div>

        {/* Control Implementation */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-slate-300">Controls</span>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Implemented', count: system.implementationStats?.implemented || 0, color: 'text-emerald-400' },
              { label: 'In Progress', count: system.implementationStats?.in_progress || 0, color: 'text-blue-400' },
              { label: 'Not Implemented', count: system.implementationStats?.not_implemented || 0, color: 'text-red-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className={`font-semibold ${color}`}>{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assessment Progress */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">Assessment</span>
          </div>
          <div className="text-2xl font-bold text-slate-200 mb-1">
            {totalSteps > 0 ? `${Math.round((assessedSteps / totalSteps) * 100)}%` : '—'}
          </div>
          <div className="text-xs text-slate-500">{assessedSteps} / {totalSteps || '?'} steps assessed</div>
          {totalSteps > 0 && (
            <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((assessedSteps / totalSteps) * 100)}%` }} />
            </div>
          )}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-emerald-400">Satisfied</span>
              <span>{system.assessmentStats?.satisfied || 0}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-red-400">Other Than Satisfied</span>
              <span>{system.assessmentStats?.other_than_satisfied || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Details + Compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Details */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">System Details</h3>
          <div className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="label">Description</label>
                  <textarea rows={3} className="input" value={editForm.description || ''}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">System Type</label>
                    <select className="select" value={editForm.system_type || ''} onChange={e => setEditForm(f => ({ ...f, system_type: e.target.value }))}>
                      <option value="major_application">Major Application</option>
                      <option value="general_support_system">General Support System</option>
                      <option value="minor_application">Minor Application</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="select" value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                      <option value="assessment_in_progress">Assessment In Progress</option>
                      <option value="authorized">Authorized</option>
                      <option value="under_review">Under Review</option>
                      <option value="decommissioned">Decommissioned</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">System Owner</label><input className="input" value={editForm.system_owner || ''} onChange={e => setEditForm(f => ({ ...f, system_owner: e.target.value }))} /></div>
                  <div><label className="label">Authorizing Official</label><input className="input" value={editForm.authorizing_official || ''} onChange={e => setEditForm(f => ({ ...f, authorizing_official: e.target.value }))} /></div>
                </div>
                <div><label className="label">Organization</label><input className="input" value={editForm.organization || ''} onChange={e => setEditForm(f => ({ ...f, organization: e.target.value }))} /></div>
                <div><label className="label">System Boundary</label><textarea rows={2} className="input" value={editForm.boundary_description || ''} onChange={e => setEditForm(f => ({ ...f, boundary_description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Authorization Date</label><input type="date" className="input" value={editForm.authorization_date || ''} onChange={e => setEditForm(f => ({ ...f, authorization_date: e.target.value }))} /></div>
                  <div><label className="label">Reauth Date</label><input type="date" className="input" value={editForm.reauthorization_date || ''} onChange={e => setEditForm(f => ({ ...f, reauthorization_date: e.target.value }))} /></div>
                </div>
              </>
            ) : (
              <>
                {system.description && <p className="text-sm text-slate-400 leading-relaxed">{system.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Type', val: system.system_type?.replace(/_/g, ' ') },
                    { label: 'Organization', val: system.organization },
                    { label: 'System Owner', val: system.system_owner },
                    { label: 'Auth. Official', val: system.authorizing_official },
                    { label: 'Authorization', val: system.authorization_date ? formatDate(system.authorization_date) : null },
                    { label: 'Reauthorization', val: system.reauthorization_date ? formatDate(system.reauthorization_date) : null },
                  ].filter(i => i.val).map(({ label, val }) => (
                    <div key={label}>
                      <div className="text-xs text-slate-500">{label}</div>
                      <div className="text-slate-300 capitalize">{val}</div>
                    </div>
                  ))}
                </div>
                {system.boundary_description && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">System Boundary</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{system.boundary_description}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Framework Compliance */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-primary-400" /> Framework Compliance
          </h3>
          <div className="space-y-4">
            {compliance.map(fw => (
              <div key={fw.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <div className="text-sm font-medium text-slate-200">{fw.name}</div>
                    <div className="text-xs text-slate-500">{fw.implemented}/{fw.total - fw.not_applicable} controls implemented</div>
                  </div>
                  <div className={`text-xl font-bold ${fw.score >= 80 ? 'text-emerald-400' : fw.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {fw.score.toFixed(0)}%
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500" style={{ width: `${(fw.implemented / fw.total) * 100}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${(fw.in_progress / fw.total) * 100}%` }} />
                  <div className="h-full bg-red-900/60" style={{ width: `${(fw.not_implemented / fw.total) * 100}%` }} />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {[
                    { label: 'Implemented', count: fw.implemented, color: 'text-emerald-400' },
                    { label: 'In Progress', count: fw.in_progress, color: 'text-amber-400' },
                    { label: 'Not Impl.', count: fw.not_implemented, color: 'text-red-400' },
                    { label: 'N/A', count: fw.not_applicable, color: 'text-slate-500' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="text-xs">
                      <span className={color}>{count}</span>
                      <span className="text-slate-600 ml-1">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-2">
            <Link
              to={`/systems/${id}/assessment`}
              className="btn-primary text-xs flex-1 justify-center"
            >
              <BarChart3 size={12} /> View Assessment
            </Link>
            <Link
              to={`/categorization?system=${id}`}
              className="btn-secondary text-xs flex-1 justify-center"
            >
              <Shield size={12} /> Security Category
            </Link>
          </div>
        </div>
      </div>

      {/* Inheritance Summary */}
      {Object.keys(system.inheritanceStats || {}).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" /> Control Inheritance Summary
          </h3>
          <div className="flex items-center gap-6">
            {Object.entries(system.inheritanceStats).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-xl font-bold text-slate-200">{count as number}</div>
                <div className="text-xs text-slate-500 capitalize">{type.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
