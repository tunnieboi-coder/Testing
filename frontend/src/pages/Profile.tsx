import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal, CheckCircle2, XCircle, ChevronRight, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface ProfileQuestion {
  id: string; question: string; category: string; answer: string | null; impact_controls: string;
}

interface Recommendation {
  controlId: string; identifier: string; title: string; reason: string; priority: string;
}

const CATEGORIES_ORDER = [
  'Identity & Access', 'Cloud Infrastructure', 'Monitoring & Detection', 'Vulnerability Management',
  'Endpoint Security', 'Data Protection', 'Incident Response', 'Business Continuity',
  'Configuration Management', 'Security Training', 'Personnel Security', 'Third Party Risk',
  'Network Security', 'Change Management', 'Supply Chain',
];

export default function Profile() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('Identity & Access');

  const { data: questions = [] } = useQuery<ProfileQuestion[]>({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
  });

  const { data: recommendations = [] } = useQuery<Recommendation[]>({
    queryKey: ['profile-recommendations'],
    queryFn: () => api.get('/profile/recommendations'),
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) => api.patch(`/profile/${id}`, { answer }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['profile-recommendations'] });
    },
  });

  const categories = CATEGORIES_ORDER.filter(c => questions.some(q => q.category === c));
  const categorizedQuestions = questions.filter(q => q.category === activeCategory);

  const answeredCount = questions.filter(q => q.answer !== null).length;
  const yesCount = questions.filter(q => q.answer === 'yes').length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-header">Technical Profile Questionnaire</h2>
        <p className="section-subtitle">Answer questions about your environment to get personalized NIST 800-53 testing recommendations</p>
      </div>

      {/* Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-200">{answeredCount}/{questions.length} questions answered</div>
            <div className="text-xs text-slate-500 mt-0.5">{yesCount} capabilities confirmed</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-400">{Math.round(answeredCount / (questions.length || 1) * 100)}%</div>
            <div className="text-xs text-slate-500">complete</div>
          </div>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500"
            style={{ width: `${Math.round(answeredCount / (questions.length || 1) * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category nav */}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Categories</div>
          {categories.map(cat => {
            const catQuestions = questions.filter(q => q.category === cat);
            const catAnswered = catQuestions.filter(q => q.answer !== null).length;
            const allYes = catQuestions.every(q => q.answer === 'yes');
            const anyNo = catQuestions.some(q => q.answer === 'no');
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${activeCategory === cat ? 'bg-primary-900/30 text-primary-400 border border-primary-800/50' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
              >
                <span className="truncate">{cat}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-xs text-slate-500">{catAnswered}/{catQuestions.length}</span>
                  {catAnswered === catQuestions.length && (
                    allYes ? <CheckCircle2 size={12} className="text-emerald-400" /> : anyNo ? <XCircle size={12} className="text-red-400" /> : <CheckCircle2 size={12} className="text-amber-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Questions */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">{activeCategory}</div>
          {categorizedQuestions.map(q => {
            let impactControls: string[] = [];
            try { impactControls = JSON.parse(q.impact_controls || '[]'); } catch {}
            return (
              <div key={q.id} className={`card p-4 space-y-3 border transition-colors ${q.answer === 'yes' ? 'border-emerald-900/60' : q.answer === 'no' ? 'border-red-900/60' : 'border-slate-800'}`}>
                <p className="text-sm text-slate-200 leading-relaxed">{q.question}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => answerMutation.mutate({ id: q.id, answer: 'yes' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${q.answer === 'yes' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-emerald-900/40 hover:text-emerald-300'}`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => answerMutation.mutate({ id: q.id, answer: 'no' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${q.answer === 'no' ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-red-900/40 hover:text-red-300'}`}
                  >
                    No
                  </button>
                  <button
                    onClick={() => answerMutation.mutate({ id: q.id, answer: 'partial' })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${q.answer === 'partial' ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-amber-900/40 hover:text-amber-300'}`}
                  >
                    Partial
                  </button>
                </div>
                {impactControls.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {impactControls.map(c => (
                      <span key={c} className="font-mono text-xs bg-slate-800 text-primary-400 border border-slate-700 px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Recommendations */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Recommendations</div>
          {recommendations.length === 0 ? (
            <div className="card p-5 text-center">
              <Lightbulb size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Answer "No" to questions to see recommended controls</p>
            </div>
          ) : recommendations.map(rec => (
            <Link key={rec.controlId} to={`/controls/${rec.controlId}`} className="card-hover p-4 block space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-primary-400 font-semibold">{rec.identifier}</span>
                <div className="flex items-center gap-1">
                  <span className="badge text-xs bg-slate-800 text-slate-400 border-slate-700">{rec.priority}</span>
                  <ChevronRight size={12} className="text-slate-600" />
                </div>
              </div>
              <div className="text-xs font-medium text-slate-200">{rec.title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{rec.reason}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
