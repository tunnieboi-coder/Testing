import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Server, Plus, X, CheckCircle2, Clock, Shield,
  ChevronRight, Building2, User, Calendar, Layers,
} from 'lucide-react';
import api from '../lib/api';
import { useSystemStore } from '../store/systemStore';
import { formatDate } from '../lib/utils';

interface GRCSystem {
  id: string; name: string; description: string;
  system_type: string; status: string;
  system_owner: string; authorizing_official: string; organization: string;
  boundary_description: string;
  authorization_date: string; reauthorization_date: string;
  security_category_confidentiality: string;
  security_category_integrity: string;
  security_category_availability: string;
  impact_level: string; applicable_baseline: string;
  created_at: string; updated_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  assessment_in_progress: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  authorized: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50',
  under_review: 'bg-amber-900/40 text-amber-300 border-amber-800/50',
  decommissioned: 'bg-slate-800 text-slate-500 border-slate-700',
};

const IMPACT_COLOR: Record<string, string> = {
  Low: 'text-emerald-400',
  Moderate: 'text-amber-400',
  High: 'text-red-400',
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  major_application: 'Major Application',
  general_support_system: 'General Support System',
  minor_application: 'Minor Application',
};

const defaultForm = {
  name: '', description: '', system_type: 'major_application',
  status: 'assessment_in_progress', system_owner: '', authorizing_official: '',
  organization: '', boundary_description: '',
  authorization_date: '', reauthorization_date: '',
};

export default function Systems() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { currentSystemId, setCurrentSystem } = useSystemStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: systems = [] } = useQuery<GRCSystem[]>({
    queryKey: ['systems'],
    queryFn: () => api.get('/systems'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/systems', form),
    onSuccess: (data: GRCSystem) => {
      qc.invalidateQueries({ queryKey: ['systems'] });
      setShowModal(false);
      setForm(defaultForm);
      // Auto-select the newly created system
      setCurrentSystem(data.id);
    },
  });

  const handleSelectSystem = (id: string) => {
    setCurrentSystem(id);
  };

  const statusCounts = systems.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Information Systems</h2>
          <p className="section-subtitle">Manage systems under assessment — each with its own scoped 800-53A results</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={15} /> Add System
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Systems', count: systems.length, color: 'text-slate-300' },
          { label: 'In Assessment', count: statusCounts['assessment_in_progress'] || 0, color: 'text-blue-400' },
          { label: 'Authorized', count: statusCounts['authorized'] || 0, color: 'text-emerald-400' },
          { label: 'Under Review', count: statusCounts['under_review'] || 0, color: 'text-amber-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Systems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {systems.map(system => {
          const isActive = system.id === currentSystemId;
          return (
            <div
              key={system.id}
              className={`card p-5 cursor-pointer transition-all hover:border-primary-700/50 ${isActive ? 'border-primary-600/60 ring-1 ring-primary-600/30' : 'border-slate-800'}`}
              onClick={() => handleSelectSystem(system.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-primary-900/50' : 'bg-slate-800'}`}>
                    <Server size={16} className={isActive ? 'text-primary-400' : 'text-slate-400'} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100 leading-tight">{system.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{SYSTEM_TYPE_LABELS[system.system_type] || system.system_type}</div>
                  </div>
                </div>
                {isActive && (
                  <span className="badge bg-primary-900/40 text-primary-300 border-primary-800/50 text-xs flex-shrink-0">Active</span>
                )}
              </div>

              {/* Description */}
              {system.description && (
                <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">{system.description}</p>
              )}

              {/* Status + Impact */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`badge text-xs border ${STATUS_COLOR[system.status] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {system.status.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs font-semibold ${IMPACT_COLOR[system.impact_level] || 'text-slate-400'}`}>
                  {system.impact_level} Impact
                </span>
              </div>

              {/* CIA Category */}
              <div className="flex items-center gap-3 p-2.5 bg-slate-900/50 rounded-lg mb-3">
                <div className="text-center flex-1">
                  <div className={`text-sm font-bold ${IMPACT_COLOR[system.security_category_confidentiality] || 'text-slate-400'}`}>
                    {system.security_category_confidentiality?.[0] || 'L'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Conf</div>
                </div>
                <div className="text-center flex-1">
                  <div className={`text-sm font-bold ${IMPACT_COLOR[system.security_category_integrity] || 'text-slate-400'}`}>
                    {system.security_category_integrity?.[0] || 'L'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Integ</div>
                </div>
                <div className="text-center flex-1">
                  <div className={`text-sm font-bold ${IMPACT_COLOR[system.security_category_availability] || 'text-slate-400'}`}>
                    {system.security_category_availability?.[0] || 'L'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Avail</div>
                </div>
                <div className="text-center flex-1 border-l border-slate-800">
                  <div className={`text-sm font-bold ${IMPACT_COLOR[system.applicable_baseline] || 'text-slate-400'}`}>
                    {system.applicable_baseline?.[0] || 'L'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Baseline</div>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-1.5">
                {system.system_owner && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <User size={10} /> <span className="truncate">{system.system_owner}</span>
                  </div>
                )}
                {system.organization && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Building2 size={10} /> <span className="truncate">{system.organization}</span>
                  </div>
                )}
                {system.authorization_date && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={10} /> ATO: {formatDate(system.authorization_date)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/systems/${system.id}`); }}
                  className="btn-secondary text-xs py-1.5 flex-1"
                >
                  View Details <ChevronRight size={12} />
                </button>
                {!isActive && (
                  <button
                    onClick={e => { e.stopPropagation(); handleSelectSystem(system.id); }}
                    className="btn-primary text-xs py-1.5 flex-1"
                  >
                    <CheckCircle2 size={12} /> Select
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add new system card */}
        <div
          onClick={() => setShowModal(true)}
          className="card p-5 border-dashed border-slate-700 cursor-pointer hover:border-primary-700/50 hover:bg-slate-800/20 transition-all flex flex-col items-center justify-center gap-3 min-h-[200px]"
        >
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <Plus size={18} className="text-slate-400" />
          </div>
          <div className="text-sm text-slate-500 text-center">Add Information System</div>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Add Information System</h3>
                <p className="text-xs text-slate-500 mt-0.5">Each system has independent assessment results and security categorization</p>
              </div>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">System Name *</label>
                <input type="text" className="input" placeholder="e.g. Financial Management System"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={2} className="input" placeholder="Brief description of the system's purpose and scope"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">System Type</label>
                  <select className="select" value={form.system_type} onChange={e => setForm(f => ({ ...f, system_type: e.target.value }))}>
                    <option value="major_application">Major Application</option>
                    <option value="general_support_system">General Support System</option>
                    <option value="minor_application">Minor Application</option>
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="assessment_in_progress">Assessment In Progress</option>
                    <option value="authorized">Authorized</option>
                    <option value="under_review">Under Review</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">System Owner</label>
                  <input type="text" className="input" placeholder="Name or role"
                    value={form.system_owner} onChange={e => setForm(f => ({ ...f, system_owner: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Authorizing Official</label>
                  <input type="text" className="input" placeholder="Name or role"
                    value={form.authorizing_official} onChange={e => setForm(f => ({ ...f, authorizing_official: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Organization</label>
                <input type="text" className="input" placeholder="Department or agency name"
                  value={form.organization} onChange={e => setForm(f => ({ ...f, organization: e.target.value }))} />
              </div>

              <div>
                <label className="label">System Boundary Description</label>
                <textarea rows={2} className="input" placeholder="Describe the system boundary and components in scope"
                  value={form.boundary_description} onChange={e => setForm(f => ({ ...f, boundary_description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Authorization Date</label>
                  <input type="date" className="input"
                    value={form.authorization_date} onChange={e => setForm(f => ({ ...f, authorization_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Reauthorization Date</label>
                  <input type="date" className="input"
                    value={form.reauthorization_date} onChange={e => setForm(f => ({ ...f, reauthorization_date: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.name || createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? <Clock size={14} className="animate-spin" /> : <Layers size={14} />}
                Create System
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
