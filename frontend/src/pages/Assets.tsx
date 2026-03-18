import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Plus, X, Server, Globe, Database, Laptop, Cloud, Smartphone } from 'lucide-react';
import api from '../lib/api';
import { statusColor } from '../lib/utils';

interface Asset {
  id: string; name: string; description: string; type: string; category: string;
  owner: string; classification: string; status: string; criticality: string;
  hostname: string; ip_address: string; os: string; vendor: string;
}

import type { LucideIcon } from 'lucide-react';
const typeIcon: Record<string, LucideIcon> = {
  server: Server, workstation: Laptop, application: Globe, database: Database,
  cloud: Cloud, saas: Cloud, mobile: Smartphone, network: Server,
};

const criticalityColor: Record<string, string> = {
  critical: 'border-l-4 border-red-500',
  high: 'border-l-4 border-orange-500',
  medium: 'border-l-4 border-amber-500',
  low: 'border-l-4 border-emerald-500',
};

const classificationColor: Record<string, string> = {
  public: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
  internal: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
  confidential: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
  restricted: 'bg-red-900/40 text-red-300 border border-red-800/50',
};

export default function Assets() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [critFilter, setCritFilter] = useState('');
  const [form, setForm] = useState({ name: '', description: '', type: 'server', category: 'hardware', owner: '', classification: 'internal', criticality: 'medium', hostname: '', ip_address: '', os: '' });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets', search, typeFilter, critFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (typeFilter) p.append('type', typeFilter);
      if (critFilter) p.append('criticality', critFilter);
      return api.get(`/assets?${p}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/assets', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setShowModal(false); },
  });

  const critCounts = assets.reduce<Record<string, number>>((acc, a) => { acc[a.criticality] = (acc[a.criticality] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Asset Inventory</h2>
          <p className="section-subtitle">Track and classify organizational assets</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={15} /> Add Asset</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical Assets', count: critCounts['critical'] || 0, color: 'text-red-400' },
          { label: 'High Priority', count: critCounts['high'] || 0, color: 'text-orange-400' },
          { label: 'Total Assets', count: assets.length, color: 'text-slate-300' },
          { label: 'Active', count: assets.filter(a => a.status === 'active').length, color: 'text-emerald-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="select w-40">
          <option value="">All Types</option>
          {['server', 'workstation', 'network', 'application', 'database', 'saas', 'cloud', 'mobile'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={critFilter} onChange={e => setCritFilter(e.target.value)} className="select w-36">
          <option value="">All Criticality</option>
          {['critical', 'high', 'medium', 'low'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="table-header p-3 text-left">Asset</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-28">Type</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-28">Owner</th>
              <th className="table-header p-3 text-left hidden md:table-cell w-28">Classification</th>
              <th className="table-header p-3 text-left w-28">Criticality</th>
              <th className="table-header p-3 text-left hidden lg:table-cell w-32">Hostname</th>
            </tr>
          </thead>
          <tbody>
            {assets.map(asset => {
              const Icon = typeIcon[asset.type] || HardDrive;
              return (
                <tr key={asset.id} className={`border-b border-slate-800/50 hover:bg-slate-800/20 ${criticalityColor[asset.criticality] || ''}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <Icon size={13} className="text-slate-400" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-200">{asset.name}</div>
                        {asset.description && <div className="text-xs text-slate-500 truncate max-w-xs">{asset.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-xs text-slate-400 capitalize">{asset.type}</td>
                  <td className="p-3 hidden lg:table-cell text-xs text-slate-400">{asset.owner || '—'}</td>
                  <td className="p-3 hidden md:table-cell">
                    <span className={`badge text-xs ${classificationColor[asset.classification] || ''}`}>{asset.classification}</span>
                  </td>
                  <td className="p-3">
                    <span className={`badge text-xs ${asset.criticality === 'critical' ? 'bg-red-900/40 text-red-300 border-red-800/50' : asset.criticality === 'high' ? 'bg-orange-900/40 text-orange-300 border-orange-800/50' : asset.criticality === 'medium' ? 'bg-amber-900/40 text-amber-300 border-amber-800/50' : 'bg-slate-800 text-slate-400 border-slate-700'} border`}>
                      {asset.criticality}
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell font-mono text-xs text-slate-500">{asset.hostname || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Asset</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Asset Name</label><input type="text" className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea rows={2} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label>
                  <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['server', 'workstation', 'network', 'application', 'database', 'saas', 'cloud', 'mobile'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Owner</label><input type="text" className="input" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Classification</label>
                  <select className="select" value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}>
                    {['public', 'internal', 'confidential', 'restricted'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Criticality</label>
                  <select className="select" value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value }))}>
                    {['low', 'medium', 'high', 'critical'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Hostname</label><input type="text" className="input" value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} /></div>
                <div><label className="label">IP Address</label><input type="text" className="input" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="btn-primary">Add Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
