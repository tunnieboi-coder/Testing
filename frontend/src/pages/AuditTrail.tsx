import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../lib/api';

interface ChangeLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  action: 'create' | 'update' | 'delete';
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_by_name: string;
  changed_at: string;
}

interface ChangeLogResponse {
  rows: ChangeLogRow[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_ICON = {
  create: <Plus size={12} className="text-emerald-400" />,
  update: <Pencil size={12} className="text-blue-400" />,
  delete: <Trash2 size={12} className="text-red-400" />,
};

const ACTION_BADGE: Record<string, string> = {
  create: 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50',
  update: 'bg-blue-900/30 text-blue-400 border-blue-900/50',
  delete: 'bg-red-900/30 text-red-400 border-red-900/50',
};

const ENTITY_LABEL: Record<string, string> = {
  control: 'Control',
  risk: 'Risk',
  vendor: 'Vendor',
  policy: 'Policy',
  asset: 'Asset',
  audit: 'Audit',
  finding: 'Finding',
  evidence: 'Evidence',
  system: 'System',
};

const PAGE_SIZE = 25;

export default function AuditTrail() {
  const [offset, setOffset] = useState(0);
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const params = new URLSearchParams();
  if (entityTypeFilter) params.append('entity_type', entityTypeFilter);
  if (actionFilter) params.append('action', actionFilter);
  params.append('limit', String(PAGE_SIZE));
  params.append('offset', String(offset));

  const { data, isLoading } = useQuery<ChangeLogResponse>({
    queryKey: ['change-log', entityTypeFilter, actionFilter, offset],
    queryFn: () => api.get(`/change-log?${params}`),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function handleFilterChange() {
    setOffset(0);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-header">Audit Trail</h2>
        <p className="section-subtitle">Complete history of all changes made to controls, risks, vendors, and policies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 border border-slate-800">
          <div className="text-2xl font-bold text-slate-200">{total}</div>
          <div className="text-sm text-slate-400">Total changes</div>
        </div>
        <div className="card p-4 border border-emerald-900/40">
          <div className="text-2xl font-bold text-emerald-400">
            {rows.filter(r => r.action === 'create').length}
          </div>
          <div className="text-sm text-slate-400">Creates (this page)</div>
        </div>
        <div className="card p-4 border border-red-900/40">
          <div className="text-2xl font-bold text-red-400">
            {rows.filter(r => r.action === 'delete').length}
          </div>
          <div className="text-sm text-slate-400">Deletes (this page)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select
          value={entityTypeFilter}
          onChange={e => { setEntityTypeFilter(e.target.value); handleFilterChange(); }}
          className="select w-40"
        >
          <option value="">All Types</option>
          {Object.entries(ENTITY_LABEL).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); handleFilterChange(); }}
          className="select w-36"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <div className="ml-auto text-xs text-slate-500 self-center">
          {total} records
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header p-3 text-left w-32">When</th>
              <th className="table-header p-3 text-left w-28">Action</th>
              <th className="table-header p-3 text-left w-24">Type</th>
              <th className="table-header p-3 text-left">Entity</th>
              <th className="table-header p-3 text-left hidden md:table-cell">Change</th>
              <th className="table-header p-3 text-left w-36 hidden lg:table-cell">User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <History size={32} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">No changes recorded yet</p>
                  <p className="text-slate-600 text-xs mt-1">Changes to controls, risks, vendors and policies will appear here</p>
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(row.changed_at), { addSuffix: true })}
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${ACTION_BADGE[row.action]}`}>
                    {ACTION_ICON[row.action]}
                    {row.action}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-400 capitalize">
                  {ENTITY_LABEL[row.entity_type] ?? row.entity_type}
                </td>
                <td className="p-3">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[200px] block">
                    {row.entity_label ?? row.entity_id}
                  </span>
                </td>
                <td className="p-3 hidden md:table-cell">
                  {row.action === 'update' && row.field ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-slate-500">{row.field}</span>
                      <span className="text-slate-600">·</span>
                      {row.old_value && (
                        <span className="line-through text-red-400/70 max-w-[100px] truncate">{row.old_value}</span>
                      )}
                      {row.old_value && row.new_value && <span className="text-slate-600">→</span>}
                      {row.new_value && (
                        <span className="text-emerald-400 max-w-[100px] truncate">{row.new_value}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-600 italic">
                      {row.action === 'create' ? 'Record created' : 'Record deleted'}
                    </span>
                  )}
                </td>
                <td className="p-3 hidden lg:table-cell text-xs text-slate-400">
                  {row.changed_by_name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage} of {totalPages} · {total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="btn-ghost p-1.5 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="btn-ghost p-1.5 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
