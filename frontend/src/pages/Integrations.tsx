import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

interface Integration {
  id: string; name: string; type: string; status: string;
  last_sync: string; sync_frequency: string; controls_mapped: number; evidence_collected: number;
}

const integrationLogos: Record<string, { bg: string; label: string }> = {
  aws: { bg: 'bg-orange-900/40 text-orange-300', label: 'AWS' },
  gcp: { bg: 'bg-blue-900/40 text-blue-300', label: 'GCP' },
  azure: { bg: 'bg-blue-900/40 text-blue-300', label: 'AZ' },
  github: { bg: 'bg-slate-700 text-slate-300', label: 'GH' },
  okta: { bg: 'bg-blue-900/40 text-blue-300', label: 'OK' },
  crowdstrike: { bg: 'bg-red-900/40 text-red-300', label: 'CS' },
  qualys: { bg: 'bg-red-900/40 text-red-300', label: 'QU' },
  jira: { bg: 'bg-blue-900/40 text-blue-300', label: 'JI' },
  slack: { bg: 'bg-purple-900/40 text-purple-300', label: 'SL' },
};

const statusIcon = {
  active: <CheckCircle2 size={13} className="text-emerald-400" />,
  inactive: <XCircle size={13} className="text-slate-500" />,
  error: <AlertCircle size={13} className="text-red-400" />,
  configuring: <Clock size={13} className="text-amber-400" />,
};

const AVAILABLE = [
  { type: 'aws', name: 'AWS Security Hub', desc: 'Collect security findings, config compliance, IAM access reports.' },
  { type: 'gcp', name: 'Google Cloud SCC', desc: 'Security Command Center compliance data.' },
  { type: 'azure', name: 'Microsoft Azure', desc: 'Defender for Cloud, Entra ID, compliance posture.' },
  { type: 'github', name: 'GitHub Advanced Security', desc: 'Code scanning, secret scanning, dependabot alerts.' },
  { type: 'okta', name: 'Okta Identity', desc: 'MFA enforcement, user access, authentication logs.' },
  { type: 'crowdstrike', name: 'CrowdStrike Falcon', desc: 'Endpoint protection, threat detection, vuln data.' },
  { type: 'qualys', name: 'Qualys VMDR', desc: 'Authenticated vulnerability scans, patch compliance.' },
  { type: 'jira', name: 'Jira', desc: 'Sync findings and remediation tasks.' },
  { type: 'slack', name: 'Slack', desc: 'Real-time notifications and alerts.' },
];

export default function Integrations() {
  const qc = useQueryClient();

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations'),
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/sync`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/integrations/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const activeCount = integrations.filter(i => i.status === 'active').length;
  const totalEvidence = integrations.reduce((sum, i) => sum + (i.evidence_collected || 0), 0);
  const totalControls = integrations.reduce((sum, i) => sum + (i.controls_mapped || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-header">Integrations</h2>
        <p className="section-subtitle">Connect security tools for automated evidence collection</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Integrations', count: activeCount, color: 'text-emerald-400' },
          { label: 'Evidence Collected', count: totalEvidence.toLocaleString(), color: 'text-primary-400' },
          { label: 'Controls Mapped', count: totalControls, color: 'text-amber-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Active Integrations */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Connected Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {integrations.map(integ => {
            const logo = integrationLogos[integ.type] || { bg: 'bg-slate-800 text-slate-300', label: integ.type.toUpperCase().slice(0, 2) };
            return (
              <div key={integ.id} className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${logo.bg}`}>
                      {logo.label}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-100">{integ.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {statusIcon[integ.status as keyof typeof statusIcon]}
                        <span className={`text-xs ${integ.status === 'active' ? 'text-emerald-400' : integ.status === 'error' ? 'text-red-400' : integ.status === 'configuring' ? 'text-amber-400' : 'text-slate-500'}`}>
                          {integ.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {integ.status === 'active' && (
                      <button
                        onClick={() => syncMutation.mutate(integ.id)}
                        disabled={syncMutation.isPending}
                        className="btn-ghost p-1.5"
                        title="Sync now"
                      >
                        <RefreshCw size={13} className={syncMutation.isPending ? 'animate-spin' : ''} />
                      </button>
                    )}
                    <button
                      onClick={() => toggleMutation.mutate({ id: integ.id, status: integ.status === 'active' ? 'inactive' : 'active' })}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${integ.status === 'active' ? 'border-red-800 text-red-400 hover:bg-red-900/20' : 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/20'}`}
                    >
                      {integ.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <div className="text-slate-100 font-semibold">{integ.controls_mapped}</div>
                    <div className="text-slate-500">Controls</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                    <div className="text-slate-100 font-semibold">{integ.evidence_collected}</div>
                    <div className="text-slate-500">Evidence</div>
                  </div>
                </div>

                {integ.last_sync && (
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock size={10} />
                    Last sync: {formatDate(integ.last_sync)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Integrations */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Available Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AVAILABLE.filter(a => !integrations.some(i => i.type === a.type)).map(avail => {
            const logo = integrationLogos[avail.type] || { bg: 'bg-slate-800 text-slate-300', label: avail.type.slice(0, 2).toUpperCase() };
            return (
              <div key={avail.type} className="card p-5 opacity-60 hover:opacity-80 transition-opacity space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${logo.bg}`}>
                    {logo.label}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{avail.name}</div>
                    <span className="badge text-xs bg-slate-800 text-slate-500 border-slate-700">Not connected</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{avail.desc}</p>
                <button className="btn-secondary w-full text-xs justify-center">
                  <Zap size={12} /> Connect
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
