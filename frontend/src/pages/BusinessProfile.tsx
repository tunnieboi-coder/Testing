import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CheckCircle2, XCircle, TrendingUp, HelpCircle, AlertTriangle } from 'lucide-react';
import api from '../lib/api';

interface BusinessQuestion {
  id: string;
  question: string;
  description: string;
  category: string;
  answer: 'yes' | 'no' | null;
  risk_multiplier: number;
  sort_order: number;
}

interface BusinessProfileResponse {
  questions: BusinessQuestion[];
  multiplier: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  criticality: 'System Criticality',
  data_sensitivity: 'Data Sensitivity',
  regulatory: 'Regulatory & Compliance',
  exposure: 'Attack Surface & Exposure',
  financial: 'Financial & Legal',
};

const CATEGORY_COLORS: Record<string, string> = {
  criticality: 'text-red-400 bg-red-900/20 border-red-900/40',
  data_sensitivity: 'text-orange-400 bg-orange-900/20 border-orange-900/40',
  regulatory: 'text-amber-400 bg-amber-900/20 border-amber-900/40',
  exposure: 'text-blue-400 bg-blue-900/20 border-blue-900/40',
  financial: 'text-purple-400 bg-purple-900/20 border-purple-900/40',
};

function multiplierColor(m: number) {
  if (m >= 2.5) return 'text-red-400';
  if (m >= 1.8) return 'text-orange-400';
  if (m >= 1.3) return 'text-amber-400';
  return 'text-emerald-400';
}

function multiplierLabel(m: number) {
  if (m >= 2.5) return 'Critical';
  if (m >= 1.8) return 'High';
  if (m >= 1.3) return 'Elevated';
  if (m > 1.0) return 'Moderate';
  return 'Baseline';
}

export default function BusinessProfile() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<BusinessProfileResponse>({
    queryKey: ['business-profile'],
    queryFn: () => api.get('/business-profile'),
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: 'yes' | 'no' | null }) =>
      api.patch(`/business-profile/${id}`, { answer }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-profile'] });
      qc.invalidateQueries({ queryKey: ['risks'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const questions = data?.questions ?? [];
  const multiplier = data?.multiplier ?? 1.0;

  const answered = questions.filter(q => q.answer !== null).length;
  const yesCount = questions.filter(q => q.answer === 'yes').length;

  const grouped = questions.reduce<Record<string, BusinessQuestion[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-header">Business Risk Profile</h2>
        <p className="section-subtitle">
          Answer questions about your business context. Each "Yes" applies a multiplier to all risk scores,
          reflecting the real-world severity of risks for your organization.
        </p>
      </div>

      {/* Multiplier banner */}
      <div className={`card p-5 border ${multiplier >= 2.5 ? 'border-red-800/60' : multiplier >= 1.8 ? 'border-orange-800/60' : multiplier >= 1.3 ? 'border-amber-800/60' : 'border-slate-700'}`}>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold ${multiplierColor(multiplier)} bg-slate-800`}>
              {multiplier.toFixed(2)}×
            </div>
            <div>
              <div className={`text-lg font-bold ${multiplierColor(multiplier)}`}>
                {multiplierLabel(multiplier)} Business Risk
              </div>
              <div className="text-sm text-slate-400">Current aggregate risk multiplier</div>
            </div>
          </div>

          <div className="flex gap-6 flex-wrap flex-1">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-200">{answered}/{questions.length}</div>
              <div className="text-xs text-slate-500 mt-0.5">Questions answered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">{yesCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Active amplifiers</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${multiplierColor(multiplier)}`}>
                {multiplier > 1 ? `+${Math.round((multiplier - 1) * 100)}%` : '0%'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Risk elevation</div>
            </div>
          </div>
        </div>

        {multiplier > 1.0 && (
          <div className="mt-4 flex items-start gap-2 bg-amber-900/20 border border-amber-900/40 rounded-lg px-4 py-3">
            <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              All risk scores are currently multiplied by <strong>{multiplier.toFixed(2)}×</strong>.
              A base score of 15 (High) becomes <strong>{Math.round(15 * multiplier)}</strong> ({multiplierLabel(Math.round(15 * multiplier) >= 20 ? 2.5 : 1.0)}) in your adjusted risk register.
              Reduce exposure by mitigating the flagged business factors.
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">{answered} of {questions.length} answered</span>
          <span className="text-xs text-slate-400">{Math.round(answered / (questions.length || 1) * 100)}% complete</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
            style={{ width: `${Math.round(answered / (questions.length || 1) * 100)}%` }}
          />
        </div>
      </div>

      {/* Questions by category */}
      <div className="space-y-6">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
          const qs = grouped[cat];
          if (!qs?.length) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${CATEGORY_COLORS[cat]}`}>{label}</span>
              </div>
              <div className="space-y-3">
                {qs.map(q => (
                  <div
                    key={q.id}
                    className={`card p-5 border transition-colors ${
                      q.answer === 'yes'
                        ? 'border-red-900/60 bg-red-950/20'
                        : q.answer === 'no'
                        ? 'border-emerald-900/40'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 leading-relaxed">{q.question}</p>
                        {q.description && (
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{q.description}</p>
                        )}
                      </div>
                      {/* Multiplier badge */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${
                          q.answer === 'yes'
                            ? 'bg-red-900/40 text-red-300 border border-red-800/60'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          <TrendingUp size={11} />
                          {q.risk_multiplier.toFixed(1)}× if Yes
                        </div>
                      </div>
                    </div>

                    {/* Yes / No buttons */}
                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => answerMutation.mutate({ id: q.id, answer: q.answer === 'yes' ? null : 'yes' })}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                          q.answer === 'yes'
                            ? 'bg-red-700 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-red-900/40 hover:text-red-300'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        Yes
                      </button>
                      <button
                        onClick={() => answerMutation.mutate({ id: q.id, answer: q.answer === 'no' ? null : 'no' })}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                          q.answer === 'no'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-emerald-900/40 hover:text-emerald-300'
                        }`}
                      >
                        <XCircle size={13} />
                        No
                      </button>
                      {q.answer !== null && (
                        <button
                          onClick={() => answerMutation.mutate({ id: q.id, answer: null })}
                          className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      {q.answer === null && (
                        <div className="ml-auto flex items-center gap-1 text-xs text-slate-600">
                          <HelpCircle size={11} />
                          Unanswered
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
