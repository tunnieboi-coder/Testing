import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Filter, ChevronRight } from 'lucide-react';
import api from '../lib/api';
import { statusColor, ciaColor } from '../lib/utils';

interface Framework { id: string; name: string }
interface Control {
  id: string; identifier: string; title: string; status: string; priority: string;
  family_name: string; cia_confidentiality: string; cia_integrity: string; cia_availability: string;
}

export default function Controls() {
  const [search, setSearch] = useState('');
  const [frameworkId, setFrameworkId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: frameworks } = useQuery<Framework[]>({ queryKey: ['frameworks'], queryFn: () => api.get('/frameworks') });

  const { data, isLoading } = useQuery<{ controls: Control[]; total: number }>({
    queryKey: ['controls', frameworkId, status, search, page],
    queryFn: () => {
      const selectedFw = frameworkId || frameworks?.[0]?.id || '';
      if (!selectedFw) return Promise.resolve({ controls: [], total: 0 });
      const params = new URLSearchParams({ page: String(page), limit: '60' });
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      return api.get(`/frameworks/${selectedFw}/controls?${params}`);
    },
    enabled: !!frameworks?.length,
  });

  const effectiveFwId = frameworkId || frameworks?.[0]?.id || '';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-header">Control Library</h2>
        <p className="section-subtitle">Browse and manage all compliance controls</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search controls..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input pl-8"
          />
        </div>
        <select value={effectiveFwId} onChange={e => { setFrameworkId(e.target.value); setPage(1); }} className="select w-48">
          {(frameworks || []).map(fw => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="select w-44">
          <option value="">All Statuses</option>
          <option value="implemented">Implemented</option>
          <option value="in_progress">In Progress</option>
          <option value="not_implemented">Not Implemented</option>
          <option value="not_applicable">Not Applicable</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{data?.total || 0} controls</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="table-header p-3 text-left w-24">Control ID</th>
                <th className="table-header p-3 text-left">Title</th>
                <th className="table-header p-3 text-left hidden md:table-cell w-32">Family</th>
                <th className="table-header p-3 text-center hidden lg:table-cell w-20">Priority</th>
                <th className="table-header p-3 text-center hidden lg:table-cell w-28">CIA</th>
                <th className="table-header p-3 text-left w-32">Status</th>
                <th className="w-8 p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-500">Loading...</td></tr>
              ) : (data?.controls || []).map(ctrl => (
                <tr key={ctrl.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
                  <td className="p-3">
                    <Link to={`/controls/${ctrl.id}`} className="font-mono text-xs text-primary-400 hover:text-primary-300 font-semibold">
                      {ctrl.identifier}
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link to={`/controls/${ctrl.id}`} className="text-xs text-slate-200 hover:text-primary-400 group-hover:text-primary-400 transition-colors">
                      {ctrl.title}
                    </Link>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-slate-500">{ctrl.family_name}</td>
                  <td className="p-3 hidden lg:table-cell text-center">
                    <span className="font-mono text-xs text-slate-400">{ctrl.priority}</span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <div className="flex gap-1 justify-center">
                      {ctrl.cia_confidentiality && <span className={`badge text-xs ${ciaColor(ctrl.cia_confidentiality)}`}>C:{ctrl.cia_confidentiality}</span>}
                      {ctrl.cia_integrity && <span className={`badge text-xs ${ciaColor(ctrl.cia_integrity)}`}>I:{ctrl.cia_integrity}</span>}
                      {ctrl.cia_availability && <span className={`badge text-xs ${ciaColor(ctrl.cia_availability)}`}>A:{ctrl.cia_availability}</span>}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`badge text-xs ${statusColor(ctrl.status)}`}>{ctrl.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Link to={`/controls/${ctrl.id}`}><ChevronRight size={14} className="text-slate-600 group-hover:text-primary-400 transition-colors" /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.total || 0) > 60 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Showing {((page-1)*60)+1}–{Math.min(page*60, data?.total||0)} of {data?.total}</span>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={() => setPage(p => p-1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Prev</button>
              <button disabled={page*60>=(data?.total||0)} onClick={() => setPage(p => p+1)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
