import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, CheckCircle2, Clock, XCircle, FileText, Sparkles,
  Download, Edit2, X, ChevronLeft, AlertTriangle, Pen, ThumbsDown, Eye,
} from 'lucide-react';
import api from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Signature {
  id: string; role: string; signature_order: number;
  user_id: string | null; user_name: string | null; user_email: string | null;
  status: 'pending' | 'signed' | 'rejected';
  signed_at: string | null; rejected_at: string | null; rejection_reason: string | null;
}

interface AtoDocument {
  id: string; document_type: string; title: string; status: string;
  version: string; generated_at: string | null; llm_model: string | null; word_count: number | null;
}

interface AtoPackage {
  id: string; title: string; package_type: string; impact_level: string; status: string;
  authorization_boundary: string | null;
  system_name: string | null; system_description: string | null; system_type: string | null;
  system_owner_name: string | null; isso_name: string | null; authorizing_official_name: string | null;
  submission_date: string | null; decision_date: string | null; expiration_date: string | null;
  denial_reason: string | null; notes: string | null;
  signatures: Signature[];
  documents: AtoDocument[];
}

interface DocContent {
  id: string; document_type: string; title: string; content: string;
  status: string; word_count: number | null; llm_model: string | null; generated_at: string | null;
}

interface DocTypeMeta { label: string; description: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIG_ROLE_LABEL: Record<string, string> = {
  system_owner: 'System Owner',
  isso: 'ISSO',
  authorizing_official: 'Authorizing Official',
};

const STATUS_COLOR: Record<string, string> = {
  in_progress:  'text-blue-400 bg-blue-900/30 border-blue-800/50',
  submitted:    'text-amber-400 bg-amber-900/30 border-amber-800/50',
  under_review: 'text-purple-400 bg-purple-900/30 border-purple-800/50',
  approved:     'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  denied:       'text-red-400 bg-red-900/30 border-red-800/50',
  expired:      'text-slate-400 bg-slate-800 border-slate-700',
};

const DOC_TYPE_ORDER = ['ssp', 'rar', 'sar', 'ato_letter', 'poam', 'iscp', 'pia', 'cis', 'sctm'];

function SignatureStep({ sig, isCurrentUser }: { sig: Signature; isCurrentUser: boolean }) {
  const isSigned   = sig.status === 'signed';
  const isRejected = sig.status === 'rejected';
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      isSigned   ? 'border-emerald-800/40 bg-emerald-900/10' :
      isRejected ? 'border-red-800/40 bg-red-900/10' :
      isCurrentUser ? 'border-primary-700/50 bg-primary-900/10' :
      'border-slate-800 bg-slate-900/30'
    }`}>
      <div className={`mt-0.5 ${isSigned ? 'text-emerald-400' : isRejected ? 'text-red-400' : 'text-slate-500'}`}>
        {isSigned ? <CheckCircle2 size={16} /> : isRejected ? <XCircle size={16} /> : <Clock size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Step {sig.signature_order}: {SIG_ROLE_LABEL[sig.role] ?? sig.role}</span>
          {isCurrentUser && !isSigned && !isRejected && (
            <span className="text-xs text-primary-400 font-medium">(your turn)</span>
          )}
        </div>
        {sig.user_name && <div className="text-xs text-slate-400 mt-0.5">{sig.user_name}{sig.user_email ? ` · ${sig.user_email}` : ''}</div>}
        {isSigned   && sig.signed_at    && <div className="text-xs text-emerald-500 mt-0.5">Signed {formatDate(sig.signed_at)}</div>}
        {isRejected && sig.rejected_at  && <div className="text-xs text-red-400 mt-0.5">Rejected {formatDate(sig.rejected_at)}{sig.rejection_reason ? ` — ${sig.rejection_reason}` : ''}</div>}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ATOPackageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [viewDoc, setViewDoc] = useState<DocContent | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: pkg, isLoading } = useQuery<AtoPackage>({
    queryKey: ['ato-package', id],
    queryFn: () => api.get(`/ato/${id}`),
    enabled: !!id,
  });

  const { data: docTypes } = useQuery<Record<string, DocTypeMeta>>({
    queryKey: ['ato-doc-types'],
    queryFn: () => api.get('/ato/meta/document-types'),
  });

  const { data: llmActive } = useQuery<{ active: string }>({
    queryKey: ['llm-settings'],
    queryFn: () => api.get('/ato/llm-settings'),
  });

  const signMutation = useMutation({
    mutationFn: () => api.post(`/ato/${id}/sign`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ato-package', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/ato/${id}/reject`, { reason: rejectReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ato-package', id] }); setShowReject(false); },
  });

  const generateMutation = useMutation({
    mutationFn: async (docType: string) => {
      setGenerating(docType);
      const result = await api.post(`/ato/${id}/documents/generate`, { document_type: docType });
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ato-package', id] }); setGenerating(null); },
    onError: () => setGenerating(null),
  });

  const viewDocMutation = useMutation({
    mutationFn: (docId: string) => api.get<DocContent>(`/ato/${id}/documents/${docId}`),
    onSuccess: (data) => setViewDoc(data),
  });

  if (isLoading || !pkg) {
    return <div className="text-slate-500 text-sm p-6">Loading…</div>;
  }

  // What's the current user's role in the signing workflow?
  const mySig = pkg.signatures.find(s => s.role === user?.role);
  const canSign   = !!mySig && mySig.status === 'pending';
  const canGenerate = user?.role === 'isso' || user?.role === 'admin';

  // Check if all previous signers have signed
  const prevSigned = mySig
    ? pkg.signatures.filter(s => s.signature_order < mySig.signature_order).every(s => s.status === 'signed')
    : false;
  const myTurn = canSign && prevSigned;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/ato')} className="btn-ghost p-1.5 mt-0.5"><ChevronLeft size={16} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="section-header mb-0">{pkg.title}</h2>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border capitalize ${STATUS_COLOR[pkg.status] ?? STATUS_COLOR.in_progress}`}>
              {pkg.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
            <span className="capitalize">{pkg.package_type.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span className={`font-semibold capitalize ${pkg.impact_level === 'high' ? 'text-red-400' : pkg.impact_level === 'moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {pkg.impact_level} Impact
            </span>
            {pkg.system_name && <><span>·</span><span>System: {pkg.system_name}</span></>}
            {pkg.expiration_date && <><span>·</span><span>Expires: {formatDate(pkg.expiration_date)}</span></>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left column — details + signature */}
        <div className="space-y-4">
          {/* Package info */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Package Details</h3>
            {[
              { label: 'System Owner', value: pkg.system_owner_name },
              { label: 'ISSO',         value: pkg.isso_name },
              { label: 'Auth. Official', value: pkg.authorizing_official_name },
              { label: 'Submitted',    value: pkg.submission_date ? formatDate(pkg.submission_date) : null },
              { label: 'Decision',     value: pkg.decision_date ? formatDate(pkg.decision_date) : null },
              { label: 'Expiration',   value: pkg.expiration_date ? formatDate(pkg.expiration_date) : null },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="text-slate-200 text-right">{value}</span>
              </div>
            ))}
            {pkg.authorization_boundary && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-xs text-slate-500 mb-1">Authorization Boundary</div>
                <div className="text-xs text-slate-300">{pkg.authorization_boundary}</div>
              </div>
            )}
            {pkg.denial_reason && (
              <div className="pt-2 border-t border-red-900/40">
                <div className="text-xs text-red-400 mb-1">Denial Reason</div>
                <div className="text-xs text-slate-300">{pkg.denial_reason}</div>
              </div>
            )}
          </div>

          {/* Signature workflow */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signature Workflow</h3>
            <p className="text-xs text-slate-500">Signatures must be collected in order: System Owner → ISSO → Authorizing Official</p>
            {pkg.signatures.map(sig => (
              <SignatureStep
                key={sig.id}
                sig={sig}
                isCurrentUser={sig.role === user?.role}
              />
            ))}

            {/* Sign / Reject actions */}
            {myTurn && !showReject && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => signMutation.mutate()}
                  disabled={signMutation.isPending}
                  className="btn-primary flex-1 justify-center"
                >
                  <Pen size={13} />
                  {signMutation.isPending ? 'Signing…' : 'Sign Package'}
                </button>
                <button onClick={() => setShowReject(true)} className="btn-secondary text-red-400 hover:text-red-300">
                  <ThumbsDown size={13} />
                </button>
              </div>
            )}
            {showReject && (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="label text-red-400">Rejection reason</label>
                <textarea rows={2} className="input" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain why you are rejecting / returning this package…" />
                <div className="flex gap-2">
                  <button onClick={() => setShowReject(false)} className="btn-secondary flex-1">Cancel</button>
                  <button
                    onClick={() => rejectMutation.mutate()}
                    disabled={rejectMutation.isPending}
                    className="btn-secondary text-red-400 hover:text-red-300 flex-1"
                  >
                    {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
            {canSign && !prevSigned && (
              <p className="text-xs text-slate-500 text-center">Waiting for previous signer(s) to sign first</p>
            )}
          </div>
        </div>

        {/* Right column — documents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ATO Documents</h3>
              {llmActive && (
                <span className="text-xs text-slate-500">
                  <Sparkles size={10} className="inline mr-1 text-primary-400" />
                  {llmActive.active}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPE_ORDER.map(type => {
                const meta    = docTypes?.[type];
                const existing = pkg.documents.find(d => d.document_type === type);
                const isGen   = generating === type;

                return (
                  <div key={type} className={`p-3 rounded-lg border ${
                    existing?.status === 'final' ? 'border-emerald-800/40 bg-emerald-900/10' :
                    existing ? 'border-slate-700 bg-slate-800/30' :
                    'border-slate-800 bg-slate-900/20'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-200 leading-snug">{meta?.label ?? type.toUpperCase()}</div>
                        {existing && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-xs ${existing.status === 'final' ? 'text-emerald-400' : existing.status === 'generated' ? 'text-amber-400' : 'text-slate-500'}`}>
                              {existing.status}
                            </span>
                            {existing.word_count && <span className="text-xs text-slate-600">{existing.word_count.toLocaleString()} words</span>}
                            {existing.llm_model && <span className="text-xs text-slate-600 font-mono truncate">{existing.llm_model.split('-').slice(-2).join('-')}</span>}
                          </div>
                        )}
                        {!existing && meta && (
                          <div className="text-xs text-slate-600 mt-0.5 leading-snug">{meta.description}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 mt-2">
                      {existing && (
                        <button
                          onClick={() => viewDocMutation.mutate(existing.id)}
                          className="btn-ghost text-xs flex items-center gap-1 text-slate-400 hover:text-primary-400"
                        >
                          <Eye size={11} /> View
                        </button>
                      )}
                      {canGenerate && (
                        <button
                          onClick={() => generateMutation.mutate(type)}
                          disabled={isGen || !!generating}
                          className="btn-ghost text-xs flex items-center gap-1 text-slate-500 hover:text-primary-400 disabled:opacity-40"
                        >
                          {isGen
                            ? <><Sparkles size={11} className="animate-pulse text-primary-400" /> Generating…</>
                            : <><Sparkles size={11} /> {existing ? 'Regenerate' : 'Generate'}</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Document viewer modal */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="card w-full max-w-4xl my-6">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur-sm">
              <div>
                <h3 className="font-semibold text-sm">{viewDoc.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  <span className="capitalize">{viewDoc.status}</span>
                  {viewDoc.word_count && <span>{viewDoc.word_count.toLocaleString()} words</span>}
                  {viewDoc.llm_model && <span className="font-mono">{viewDoc.llm_model}</span>}
                  {viewDoc.generated_at && <span>Generated {formatDate(viewDoc.generated_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([viewDoc.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${viewDoc.document_type}-${id}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  <Download size={13} /> Export Markdown
                </button>
                <button onClick={() => setViewDoc(null)} className="btn-ghost p-1.5"><X size={16} /></button>
              </div>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-xs text-slate-300 font-sans leading-relaxed">
                {viewDoc.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
