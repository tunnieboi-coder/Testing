import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

interface RolesResponse {
  roles: string[];
  matrix: Record<string, Record<string, string[]>>;
  sodConflicts: { role: string; resource: string; forbidden: string; reason: string }[];
}

const ALL_RESOURCES = ['control', 'risk', 'audit', 'finding', 'policy', 'evidence', 'vendor', 'asset', 'user', 'system'];
const ALL_ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'publish', 'assign', 'remediate'];

const ROLE_DESC: Record<string, string> = {
  admin:              'User & system management only',
  compliance_manager: 'GRC operations — controls, policies, vendors',
  risk_owner:         'Creates & manages risks; cannot approve',
  risk_approver:      'Approves risk treatment; cannot create',
  auditor:            'Creates audits & findings; cannot remediate',
  control_owner:      'Implements controls, uploads evidence; cannot approve',
  reviewer:           'Approves evidence, controls, and remediates findings',
  viewer:             'Read-only access across all resources',
};

const ROLE_COLOR: Record<string, string> = {
  admin:              'bg-purple-900/30 text-purple-300 border-purple-800',
  compliance_manager: 'bg-blue-900/30 text-blue-300 border-blue-800',
  risk_owner:         'bg-orange-900/30 text-orange-300 border-orange-800',
  risk_approver:      'bg-yellow-900/30 text-yellow-300 border-yellow-800',
  auditor:            'bg-cyan-900/30 text-cyan-300 border-cyan-800',
  control_owner:      'bg-teal-900/30 text-teal-300 border-teal-800',
  reviewer:           'bg-emerald-900/30 text-emerald-300 border-emerald-800',
  viewer:             'bg-slate-800 text-slate-400 border-slate-700',
};

function ActionDot({ has }: { has: boolean }) {
  return (
    <div className={`w-3.5 h-3.5 rounded-full mx-auto ${has ? 'bg-emerald-500' : 'bg-slate-800'}`} />
  );
}

export default function RolesPermissions() {
  const { data, isLoading } = useQuery<RolesResponse>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles'),
  });

  if (isLoading || !data) {
    return <div className="text-slate-500 text-sm p-6">Loading...</div>;
  }

  const { roles, matrix, sodConflicts } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-header">Roles & Permissions</h2>
        <p className="section-subtitle">
          Segregation of Duties (SoD) is enforced — incompatible actions are split across separate roles
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {roles.map(role => (
          <div key={role} className={`card p-4 border rounded-lg ${ROLE_COLOR[role] ?? 'border-slate-800'}`}>
            <div className="font-semibold text-sm capitalize mb-1">{role.replace(/_/g, ' ')}</div>
            <div className="text-xs opacity-75">{ROLE_DESC[role] ?? ''}</div>
          </div>
        ))}
      </div>

      {/* SoD conflicts panel */}
      <div className="card p-4 border border-amber-900/40 bg-amber-950/10 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-3">
          <AlertTriangle size={15} />
          Segregation of Duties — enforced conflicts
        </div>
        {sodConflicts.map((c, i) => (
          <div key={i} className="flex items-start gap-3 text-xs">
            <span className={`px-2 py-0.5 rounded border text-xs font-mono capitalize shrink-0 ${ROLE_COLOR[c.role] ?? 'border-slate-700 text-slate-400'}`}>
              {c.role.replace(/_/g, ' ')}
            </span>
            <span className="text-slate-400">
              cannot <span className="text-red-400 font-semibold">{c.forbidden}</span> {c.resource}s —{' '}
              <span className="text-slate-500">{c.reason}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Full permission matrix */}
      <div className="card overflow-x-auto">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
          <ShieldCheck size={15} className="text-primary-400" />
          <span className="font-semibold text-sm text-slate-200">Permission Matrix</span>
          <span className="ml-auto text-xs text-slate-500">
            <span className="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1 align-middle" />allowed
            <span className="inline-block w-3 h-3 rounded-full bg-slate-800 ml-3 mr-1 align-middle" />denied
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/40">
              <th className="table-header p-2 text-left w-28">Resource</th>
              <th className="table-header p-2 text-left w-24">Action</th>
              {roles.map(role => (
                <th key={role} className="table-header p-2 text-center min-w-[72px]">
                  <span className="capitalize text-xs">{role.replace(/_/g, '\u00a0')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_RESOURCES.flatMap(resource =>
              ALL_ACTIONS.map((action, ai) => {
                const hasAny = roles.some(r => matrix[r]?.[resource]?.includes(action));
                if (!hasAny) return null;
                return (
                  <tr key={`${resource}-${action}`} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                    <td className="p-2 text-slate-400 capitalize">{ai === 0 ? resource : ''}</td>
                    <td className="p-2 text-slate-500">{action}</td>
                    {roles.map(role => (
                      <td key={role} className="p-2">
                        <ActionDot has={!!matrix[role]?.[resource]?.includes(action)} />
                      </td>
                    ))}
                  </tr>
                );
              }).filter(Boolean)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
