import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Plus, X, FileSignature, CheckCircle2, Clock,
  XCircle, AlertTriangle, ChevronRight, Settings, Brain,
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface AtoPackage {
  id: string;
  title: string;
  system_name: string | null;
  package_type: string;
  impact_level: string;
  status: string;
  system_owner_name: string | null;
  isso_name: string | null;
  authorizing_official_name: string | null;
  submission_date: string | null;
  decision_date: string | null;
  expiration_date: string | null;
  document_count: number;
  signatures_collected: number;
  signatures_required: number;
  created_at: string;
}

interface LlmSettings { active: string; models: { id: string; label: string }[] }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  in_progress:   { label: 'In Progress',   color: 'text-blue-400 bg-blue-900/30 border-blue-800/50',       icon: <Clock size={11} /> },
  submitted:     { label: 'Submitted',     color: 'text-amber-400 bg-amber-900/30 border-amber-800/50',     icon: <FileSignature size={11} /> },
  under_review:  { label: 'Under Review',  color: 'text-purple-400 bg-purple-900/30 border-purple-800/50',  icon: <Clock size={11} /> },
  approved:      { label: 'Approved',      color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50', icon: <CheckCircle2 size={11} /> },
  denied:        { label: 'Denied',        color: 'text-red-400 bg-red-900/30 border-red-800/50',           icon: <XCircle size={11} /> },
  expired:       { label: 'Expired',       color: 'text-slate-400 bg-slate-800 border-slate-700',           icon: <AlertTriangle size={11} /> },
};

const IMPACT_COLOR: Record<string, string> = {
  low:      'text-emerald-400',
  moderate: 'text-amber-400',
  high:     'text-red-400',
};

const PKG_TYPES = ['full_ato', 'interim_ato', 'ato_renewal', 'continuous_monitoring'];
const IMPACT_LEVELS = ['low', 'moderate', 'high'];

export default function ATOPackages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [showLlm, setShowLlm] = useState(false);
  const [form, setForm] = useState({
    title: '', system_id: '', package_type: 'full_ato', impact_level: 'moderate',
    authorization_boundary: '',
    system_owner_name: '', isso_name: '', authorizing_official_name: '',
    notes: '',
  });

  const { data: packages = [] } = useQuery<AtoPackage[]>({
    queryKey: ['ato-packages'],
    queryFn: () => api.get('/ato'),
  });

  const { data: llmSettings } = useQuery<LlmSettings>({
    queryKey: ['llm-settings'],
    queryFn: () => api.get('/ato/llm-settings'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/ato', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ato-packages'] }); setShowNew(false); },
  });

  const llmMutation = useMutation({
    mutationFn: (model: string) => api.patch('/ato/llm-settings', { model }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-settings'] }),
  });

  const canCreate = user?.role === 'isso' || user?.role === 'admin';
  const canChangeLlm = user?.role === 'admin' || user?.role === 'isso';

  const stats = {
    total:       packages.length,
    approved:    packages.filter(p => p.status === 'approved').length,
    inProgress:  packages.filter(p => ['in_progress', 'submitted', 'under_review'].includes(p.status)).length,
    expiringSoon: packages.filter(p => p.expiration_date && new Date(p.expiration_date) < new Date(Date.now() + 90*24*60*60*1000) && p.status === 'approved').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">ATO Packages</h2>
          <p className="section-subtitle">Authority to Operate — manage packages, signature workflows, and document generation</p>
        </div>
        <div className="flex items-center gap-2">
          {canChangeLlm && (
            <button onClick={() => setShowLlm(true)} className="btn-secondary flex items-center gap-1.5">
              <Brain size={14} />
              LLM: {llmSettings?.models.find(m => m.id === llmSettings.active)?.label.split(' (')[0] ?? '…'}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowNew(true)} className="btn-primary">
              <Plus size={15} /> New Package
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Packages',    count: stats.total,        color: 'text-slate-300' },
          { label: 'Approved (Active)', count: stats.approved,     color: 'text-emerald-400' },
          { label: 'In Progress',       count: stats.inProgress,   color: 'text-blue-400' },
          { label: 'Expiring < 90 days',count: stats.expiringSoon, color: 'text-amber-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Packages list */}
      <div className="space-y-3">
        {packages.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">
            No ATO packages yet.{canCreate && ' Create your first package to get started.'}
          </div>
        ) : packages.map(pkg => {
          const statusCfg = STATUS_CONFIG[pkg.status] ?? STATUS_CONFIG.in_progress;
          const sigPct = pkg.signatures_required > 0 ? Math.round((pkg.signatures_collected / pkg.signatures_required) * 100) : 0;
          return (
            <Link key={pkg.id} to={`/ato/${pkg.id}`} className="card p-4 block hover:bg-slate-800/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <ShieldCheck size={18} className="text-primary-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 text-sm">{pkg.title}</div>
                    {pkg.system_name && <div className="text-xs text-slate-500 mt-0.5">System: {pkg.system_name}</div>}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${statusCfg.color}`}>
                        {statusCfg.icon}{statusCfg.label}
                      </span>
                      <span className={`text-xs font-semibold capitalize ${IMPACT_COLOR[pkg.impact_level] ?? 'text-slate-400'}`}>
                        {pkg.impact_level} impact
                      </span>
                      <span className="text-xs text-slate-500 capitalize">{pkg.package_type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  {/* Signature progress */}
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-slate-400 mb-1">Signatures {pkg.signatures_collected}/{pkg.signatures_required}</div>
                    <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sigPct}%` }} />
                    </div>
                  </div>
                  <div className="text-right hidden lg:block">
                    <div className="text-xs text-slate-500">{pkg.document_count} doc{pkg.document_count !== 1 ? 's' : ''}</div>
                    {pkg.expiration_date && <div className="text-xs text-slate-500 mt-0.5">Expires {formatDate(pkg.expiration_date)}</div>}
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </div>
              </div>
              {/* Personnel strip */}
              <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap gap-4 text-xs text-slate-500">
                {pkg.system_owner_name && <span>System Owner: <span className="text-slate-300">{pkg.system_owner_name}</span></span>}
                {pkg.isso_name && <span>ISSO: <span className="text-slate-300">{pkg.isso_name}</span></span>}
                {pkg.authorizing_official_name && <span>AO: <span className="text-slate-300">{pkg.authorizing_official_name}</span></span>}
                <span className="ml-auto">Created {formatDate(pkg.created_at)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* LLM Settings modal */}
      {showLlm && llmSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Brain size={16} className="text-primary-400" /> LLM Selection</h3>
              <button onClick={() => setShowLlm(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-400">Choose the AI model used for document generation. More capable models produce higher-quality output but are slower.</p>
            <div className="space-y-2">
              {llmSettings.models.map(m => (
                <button
                  key={m.id}
                  onClick={() => { llmMutation.mutate(m.id); setShowLlm(false); }}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    llmSettings.active === m.id
                      ? 'border-primary-600 bg-primary-900/30 text-primary-300'
                      : 'border-slate-700 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono">{m.id}</div>
                  {llmSettings.active === m.id && <div className="text-xs text-primary-400 mt-1">Currently active</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Package modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">New ATO Package</h3>
              <button onClick={() => setShowNew(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Package Title *</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Production Platform ATO FY2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Package Type</label>
                  <select className="select" value={form.package_type} onChange={e => setForm(f => ({ ...f, package_type: e.target.value }))}>
                    {PKG_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div><label className="label">Impact Level</label>
                  <select className="select" value={form.impact_level} onChange={e => setForm(f => ({ ...f, impact_level: e.target.value }))}>
                    {IMPACT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Authorization Boundary</label>
                <textarea rows={2} className="input" value={form.authorization_boundary}
                  onChange={e => setForm(f => ({ ...f, authorization_boundary: e.target.value }))}
                  placeholder="Describe the systems, components, and data flows within scope" />
              </div>
              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-400 mb-2">Signing Officials (sets up signature workflow)</p>
                <div className="space-y-2">
                  <div><label className="label">System Owner Name</label>
                    <input className="input" value={form.system_owner_name} onChange={e => setForm(f => ({ ...f, system_owner_name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div><label className="label">ISSO Name</label>
                    <input className="input" value={form.isso_name} onChange={e => setForm(f => ({ ...f, isso_name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div><label className="label">Authorizing Official Name</label>
                    <input className="input" value={form.authorizing_official_name} onChange={e => setForm(f => ({ ...f, authorizing_official_name: e.target.value }))} placeholder="Full name" />
                  </div>
                </div>
              </div>
              <div><label className="label">Notes</label>
                <textarea rows={2} className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.title || createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Creating…' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
