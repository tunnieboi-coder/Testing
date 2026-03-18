import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Shield, Plus, X, ChevronDown, ChevronUp, Info, Edit2, Save } from 'lucide-react';
import api from '../lib/api';
import { useSystemStore } from '../store/systemStore';

interface InfoType {
  id: string; identifier: string; name: string; description: string;
  section: string; section_name: string; category: string;
  confidentiality_impact: string; integrity_impact: string; availability_impact: string;
  rationale: string;
}

interface SystemInfoType {
  id: string; system_id: string; type_id: string;
  identifier: string; name: string; description: string;
  section: string; section_name: string; category: string;
  default_confidentiality: string; default_integrity: string; default_availability: string;
  confidentiality_override: string | null; integrity_override: string | null; availability_override: string | null;
  override_justification: string | null; notes: string | null;
}

interface SecurityCategory {
  confidentiality: string; integrity: string; availability: string;
  impact_level: string; applicable_baseline: string; type_count: number;
}

interface GRCSystem { id: string; name: string; }

const IMPACT_COLOR: Record<string, string> = {
  Low: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  Moderate: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
  High: 'text-red-400 bg-red-900/30 border-red-800/50',
  'N/A': 'text-slate-500 bg-slate-800 border-slate-700',
};

const IMPACT_DOT: Record<string, string> = {
  Low: 'bg-emerald-400', Moderate: 'bg-amber-400', High: 'bg-red-400', 'N/A': 'bg-slate-600',
};

export default function SecurityCategorization() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { currentSystemId } = useSystemStore();
  const [sectionFilter, setSectionFilter] = useState('');
  const [impactFilter, setImpactFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editingSelection, setEditingSelection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    confidentiality_override: string; integrity_override: string;
    availability_override: string; override_justification: string; notes: string;
  }>({ confidentiality_override: '', integrity_override: '', availability_override: '', override_justification: '', notes: '' });

  // System selection
  const systemIdFromParam = searchParams.get('system');
  const selectedSystemId = systemIdFromParam || currentSystemId;

  const { data: systems = [] } = useQuery<GRCSystem[]>({
    queryKey: ['systems'],
    queryFn: () => api.get('/systems'),
  });

  const { data: catalog = [] } = useQuery<InfoType[]>({
    queryKey: ['800-60-catalog'],
    queryFn: () => api.get('/categorization/catalog'),
  });

  const { data: selections = [] } = useQuery<SystemInfoType[]>({
    queryKey: ['system-info-types', selectedSystemId],
    queryFn: () => api.get(`/categorization/systems/${selectedSystemId}/types`),
    enabled: !!selectedSystemId,
  });

  const { data: category } = useQuery<SecurityCategory>({
    queryKey: ['security-category', selectedSystemId],
    queryFn: () => api.get(`/categorization/systems/${selectedSystemId}/category`),
    enabled: !!selectedSystemId,
  });

  const addTypeMutation = useMutation({
    mutationFn: (type_id: string) => api.post(`/categorization/systems/${selectedSystemId}/types`, { type_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-info-types', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['security-category', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['systems'] });
    },
  });

  const removeTypeMutation = useMutation({
    mutationFn: (selectionId: string) => api.delete(`/categorization/systems/${selectedSystemId}/types/${selectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-info-types', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['security-category', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['systems'] });
    },
  });

  const updateSelectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.patch(`/categorization/systems/${selectedSystemId}/types/${id}`, {
        confidentiality_override: editForm.confidentiality_override || null,
        integrity_override: editForm.integrity_override || null,
        availability_override: editForm.availability_override || null,
        override_justification: editForm.override_justification || null,
        notes: editForm.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-info-types', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['security-category', selectedSystemId] });
      qc.invalidateQueries({ queryKey: ['systems'] });
      setEditingSelection(null);
    },
  });

  const selectedTypeIds = new Set(selections.map(s => s.type_id));

  const sections = useMemo(() => [...new Set(catalog.map(t => t.section))].sort(), [catalog]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(t => {
      if (sectionFilter && t.section !== sectionFilter) return false;
      if (impactFilter) {
        const maxImpact = [t.confidentiality_impact, t.integrity_impact, t.availability_impact]
          .includes(impactFilter === 'High' ? 'High' : impactFilter === 'Moderate' ? 'Moderate' : 'Low');
        if (!maxImpact) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.identifier.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [catalog, sectionFilter, impactFilter, search]);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, { section_name: string; types: InfoType[] }> = {};
    for (const t of filteredCatalog) {
      if (!groups[t.section]) groups[t.section] = { section_name: t.section_name, types: [] };
      groups[t.section].types.push(t);
    }
    return groups;
  }, [filteredCatalog]);

  const startEditSelection = (sel: SystemInfoType) => {
    setEditForm({
      confidentiality_override: sel.confidentiality_override || '',
      integrity_override: sel.integrity_override || '',
      availability_override: sel.availability_override || '',
      override_justification: sel.override_justification || '',
      notes: sel.notes || '',
    });
    setEditingSelection(sel.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Security Categorization</h2>
          <p className="section-subtitle">Select NIST SP 800-60 information types to determine system security category and control baseline</p>
        </div>
      </div>

      {/* System Selector */}
      <div className="card p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Shield size={14} className="text-primary-400" />
          <span className="text-slate-400">System:</span>
        </div>
        <select
          className="select w-64"
          value={selectedSystemId || ''}
          onChange={e => {
            const id = e.target.value;
            if (id) setSearchParams({ system: id });
            else setSearchParams({});
          }}
        >
          <option value="">Select a system...</option>
          {systems.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {category && selectedSystemId && (
          <div className="flex items-center gap-4 ml-auto">
            <div className="text-xs text-slate-500">SC =</div>
            <div className="flex items-center gap-2">
              {[
                { label: 'C', val: category.confidentiality },
                { label: 'I', val: category.integrity },
                { label: 'A', val: category.availability },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">{label}:</span>
                  <span className={`badge text-xs border px-1.5 ${IMPACT_COLOR[val] || ''}`}>{val}</span>
                </div>
              ))}
            </div>
            <div className="border-l border-slate-700 pl-4 flex items-center gap-2">
              <span className="text-xs text-slate-400">Baseline:</span>
              <span className={`badge border text-xs font-semibold ${IMPACT_COLOR[category.applicable_baseline] || ''}`}>
                {category.applicable_baseline}
              </span>
            </div>
          </div>
        )}
      </div>

      {!selectedSystemId ? (
        <div className="card p-10 text-center text-slate-500">
          <Shield size={32} className="mx-auto mb-3 text-slate-700" />
          <p>Select a system above to manage its information types and security categorization.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Selected Types Panel */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              Selected Types ({selections.length})
            </div>

            {category && (
              <div className="card p-4 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Computed Security Category</div>
                <div className="text-xs text-slate-500">
                  SC {systems.find(s => s.id === selectedSystemId)?.name} = &#123;(confidentiality, {category.confidentiality}),
                  (integrity, {category.integrity}), (availability, {category.availability})&#125;
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    { label: 'Confidentiality', val: category.confidentiality },
                    { label: 'Integrity', val: category.integrity },
                    { label: 'Availability', val: category.availability },
                  ].map(({ label, val }) => (
                    <div key={label} className="text-center">
                      <div className={`text-lg font-bold ${val === 'High' ? 'text-red-400' : val === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {val[0]}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-500 mb-1">Overall Impact / Baseline</div>
                  <span className={`badge border text-xs font-semibold ${IMPACT_COLOR[category.applicable_baseline] || ''}`}>
                    {category.applicable_baseline} Impact
                  </span>
                </div>
              </div>
            )}

            {selections.length === 0 ? (
              <div className="card p-5 text-center text-slate-500 text-xs">
                No information types selected. Browse the catalog and add types relevant to this system.
              </div>
            ) : selections.map(sel => {
              const effectiveC = sel.confidentiality_override || sel.default_confidentiality;
              const effectiveI = sel.integrity_override || sel.default_integrity;
              const effectiveA = sel.availability_override || sel.default_availability;
              const isEditing = editingSelection === sel.id;

              return (
                <div key={sel.id} className="card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-xs text-primary-400 font-semibold">{sel.identifier}</div>
                      <div className="text-xs text-slate-300 mt-0.5 leading-tight">{sel.name}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => isEditing ? setEditingSelection(null) : startEditSelection(sel)}
                        className="btn-ghost p-1"><Edit2 size={11} /></button>
                      <button onClick={() => removeTypeMutation.mutate(sel.id)}
                        className="btn-ghost p-1 text-red-400 hover:text-red-300"><X size={11} /></button>
                    </div>
                  </div>

                  {/* CIA Values */}
                  <div className="flex gap-1.5">
                    {[
                      { label: 'C', val: effectiveC, orig: sel.default_confidentiality },
                      { label: 'I', val: effectiveI, orig: sel.default_integrity },
                      { label: 'A', val: effectiveA, orig: sel.default_availability },
                    ].map(({ label, val, orig }) => (
                      <div key={label} className="flex-1 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${IMPACT_COLOR[val] || ''}`}>
                          {label}: {val[0]}
                        </span>
                        {val !== orig && <div className="text-[9px] text-slate-600 mt-0.5">was {orig[0]}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Override editor */}
                  {isEditing && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="text-xs text-slate-400 font-medium">Override Impact Values</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'C Override', key: 'confidentiality_override' as const },
                          { label: 'I Override', key: 'integrity_override' as const },
                          { label: 'A Override', key: 'availability_override' as const },
                        ].map(({ label, key }) => (
                          <div key={key}>
                            <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
                            <select className="select text-xs py-1"
                              value={editForm[key]}
                              onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}>
                              <option value="">Default</option>
                              <option value="Low">Low</option>
                              <option value="Moderate">Moderate</option>
                              <option value="High">High</option>
                            </select>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-0.5">Justification (required for overrides)</div>
                        <textarea rows={2} className="input text-xs"
                          value={editForm.override_justification}
                          onChange={e => setEditForm(f => ({ ...f, override_justification: e.target.value }))}
                          placeholder="Explain why the default impact level is being overridden..." />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingSelection(null)} className="btn-ghost text-xs py-1">Cancel</button>
                        <button
                          onClick={() => updateSelectionMutation.mutate({ id: sel.id, data: editForm })}
                          className="btn-primary text-xs py-1"
                        >
                          <Save size={11} /> Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Catalog Panel */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
              800-60 Catalog ({catalog.length} types)
            </div>

            {/* Filters */}
            <div className="card p-3 flex flex-wrap gap-2">
              <input type="text" placeholder="Search types..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="input flex-1 min-w-[180px] py-1.5 text-xs" />
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)} className="select w-40 text-xs">
                <option value="">All Sections</option>
                {sections.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select value={impactFilter} onChange={e => setImpactFilter(e.target.value)} className="select w-32 text-xs">
                <option value="">Any Impact</option>
                <option value="High">Has High</option>
                <option value="Moderate">Has Moderate</option>
                <option value="Low">Low Only</option>
              </select>
            </div>

            {/* Grouped catalog */}
            <div className="space-y-3">
              {Object.entries(groupedCatalog).map(([section, { section_name, types }]) => (
                <div key={section} className="card overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-300">{section} — {section_name}</div>
                    <div className="text-xs text-slate-500">{types.length} types</div>
                  </div>
                  <div className="divide-y divide-slate-800/50">
                    {types.map(type => {
                      const isSelected = selectedTypeIds.has(type.id);
                      const isExpanded = expandedType === type.id;
                      return (
                        <div key={type.id} className={`${isSelected ? 'bg-primary-900/10' : ''}`}>
                          <div className="flex items-center gap-3 px-4 py-2.5">
                            {/* Identifier + Name */}
                            <button
                              onClick={() => setExpandedType(isExpanded ? null : type.id)}
                              className="flex items-center gap-2 flex-1 text-left min-w-0"
                            >
                              <span className="font-mono text-xs text-primary-400 flex-shrink-0 w-16">{type.identifier}</span>
                              <span className="text-xs text-slate-300 truncate">{type.name}</span>
                              {isExpanded ? <ChevronUp size={12} className="text-slate-500 flex-shrink-0" /> : <ChevronDown size={12} className="text-slate-500 flex-shrink-0" />}
                            </button>

                            {/* CIA badges */}
                            <div className="flex gap-1 flex-shrink-0">
                              {[
                                { label: 'C', val: type.confidentiality_impact },
                                { label: 'I', val: type.integrity_impact },
                                { label: 'A', val: type.availability_impact },
                              ].map(({ label, val }) => (
                                <div key={label} className="flex items-center gap-0.5">
                                  <div className={`w-1.5 h-1.5 rounded-full ${IMPACT_DOT[val] || 'bg-slate-600'}`} />
                                  <span className="text-[10px] text-slate-500">{label[0]}</span>
                                </div>
                              ))}
                            </div>

                            {/* Add/Remove */}
                            {isSelected ? (
                              <span className="text-xs text-emerald-400 flex items-center gap-1 flex-shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Selected
                              </span>
                            ) : (
                              <button
                                onClick={() => addTypeMutation.mutate(type.id)}
                                disabled={addTypeMutation.isPending}
                                className="btn-ghost p-1.5 text-primary-400 hover:text-primary-300 flex-shrink-0"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-2.5 bg-slate-900/30">
                              <p className="text-xs text-slate-400 leading-relaxed">{type.description}</p>
                              <div className="flex gap-3">
                                {[
                                  { label: 'Confidentiality', val: type.confidentiality_impact },
                                  { label: 'Integrity', val: type.integrity_impact },
                                  { label: 'Availability', val: type.availability_impact },
                                ].map(({ label, val }) => (
                                  <div key={label} className={`badge border text-xs ${IMPACT_COLOR[val] || ''}`}>
                                    {label}: {val}
                                  </div>
                                ))}
                              </div>
                              {type.rationale && (
                                <div className="flex items-start gap-1.5 text-xs text-slate-500">
                                  <Info size={11} className="flex-shrink-0 mt-0.5" />
                                  <span className="leading-relaxed">{type.rationale}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
