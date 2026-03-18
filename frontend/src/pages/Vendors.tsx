import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, X, ExternalLink, Star } from 'lucide-react';
import api from '../lib/api';
import { statusColor, formatDate } from '../lib/utils';

interface Vendor {
  id: string; name: string; website: string; description: string; category: string;
  tier: number; status: string; risk_rating: string; contact_name: string; contact_email: string;
  data_types: string; last_review_date: string; next_review_date: string; notes: string;
}

const riskRatingColor: Record<string, string> = {
  low: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/50',
  medium: 'bg-amber-900/40 text-amber-300 border border-amber-800/50',
  high: 'bg-red-900/40 text-red-300 border border-red-800/50',
  critical: 'bg-red-900/60 text-red-200 border border-red-700',
};

export default function Vendors() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ name: '', website: '', description: '', category: 'saas', tier: 2, risk_rating: 'medium', contact_name: '', contact_email: '', notes: '' });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['vendors', search, category, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (category) p.append('category', category);
      if (statusFilter) p.append('status', statusFilter);
      return api.get(`/vendors?${p}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/vendors', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/vendors/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const tierLabels = ['', 'Critical', 'Important', 'Standard'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Vendor Management</h2>
          <p className="section-subtitle">Assess and monitor third-party vendor risk</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={15} /> Add Vendor</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tier 1 Critical', count: vendors.filter(v => v.tier === 1).length, color: 'text-red-400' },
          { label: 'High Risk', count: vendors.filter(v => v.risk_rating === 'high' || v.risk_rating === 'critical').length, color: 'text-orange-400' },
          { label: 'Approved', count: vendors.filter(v => v.status === 'approved').length, color: 'text-emerald-400' },
          { label: 'Under Review', count: vendors.filter(v => v.status === 'under_review').length, color: 'text-amber-400' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card p-4">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-sm text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1 min-w-[200px]" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="select w-36">
          <option value="">All Types</option>
          {['cloud', 'saas', 'infrastructure', 'security', 'hr', 'finance', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select w-36">
          <option value="">All Statuses</option>
          {['active', 'approved', 'under_review', 'rejected', 'offboarded'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendors.map(vendor => {
          let dataTypes: string[] = [];
          try { dataTypes = JSON.parse(vendor.data_types || '[]'); } catch {}
          return (
            <div key={vendor.id} className="card-hover p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-400">
                    {vendor.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{vendor.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star key={i} size={10} className={i < (4 - vendor.tier) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                      ))}
                      <span className="text-xs text-slate-500 ml-0.5">Tier {vendor.tier}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge text-xs ${statusColor(vendor.status)}`}>{vendor.status.replace('_', ' ')}</span>
                  <span className={`badge text-xs ${riskRatingColor[vendor.risk_rating] || ''}`}>{vendor.risk_rating}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">{vendor.description}</p>

              {dataTypes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {dataTypes.slice(0, 3).map(dt => (
                    <span key={dt} className="badge text-xs bg-slate-800 text-slate-400 border-slate-700">{dt}</span>
                  ))}
                  {dataTypes.length > 3 && <span className="badge text-xs bg-slate-800 text-slate-500 border-slate-700">+{dataTypes.length - 3}</span>}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <div className="text-xs text-slate-500">
                  {vendor.next_review_date ? `Review: ${formatDate(vendor.next_review_date)}` : vendor.category}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={vendor.status}
                    onChange={e => updateMutation.mutate({ id: vendor.id, body: { status: e.target.value } })}
                    className="text-xs bg-transparent border-0 outline-none cursor-pointer text-slate-400 hover:text-slate-200"
                  >
                    {['active', 'approved', 'under_review', 'rejected', 'offboarded'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {vendor.website && (
                    <a href={vendor.website} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary-400">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Vendor</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Vendor Name', key: 'name', type: 'text', placeholder: 'e.g. Snowflake' },
                { label: 'Website', key: 'website', type: 'url', placeholder: 'https://...' },
                { label: 'Contact Name', key: 'contact_name', type: 'text', placeholder: 'Primary contact' },
                { label: 'Contact Email', key: 'contact_email', type: 'email', placeholder: 'security@vendor.com' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input type={type} className="input" placeholder={placeholder} value={(form as Record<string, unknown>)[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="label">Description</label>
                <textarea rows={2} className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this vendor do?" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select className="select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {['cloud', 'saas', 'infrastructure', 'security', 'hr', 'finance', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tier</label>
                  <select className="select" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: parseInt(e.target.value) }))}>
                    <option value={1}>1 - Critical</option>
                    <option value={2}>2 - Important</option>
                    <option value={3}>3 - Standard</option>
                  </select>
                </div>
                <div>
                  <label className="label">Risk Rating</label>
                  <select className="select" value={form.risk_rating} onChange={e => setForm(f => ({ ...f, risk_rating: e.target.value }))}>
                    {['low', 'medium', 'high', 'critical'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Adding...' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
