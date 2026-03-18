import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Shield, ChevronRight, CheckCircle2, Clock, XCircle, Minus } from 'lucide-react';
import api from '../lib/api';
import ScoreRing from '../components/ui/ScoreRing';

interface Framework {
  id: string;
  name: string;
  version: string;
  description: string;
  type: string;
}

interface FrameworkStats {
  id: string;
  name: string;
  version: string;
  description: string;
  total: number;
  implemented: number;
  in_progress: number;
  not_applicable: number;
  not_implemented: number;
  score: number;
}

export default function Frameworks() {
  const { data: frameworks } = useQuery<Framework[]>({
    queryKey: ['frameworks'],
    queryFn: () => api.get('/frameworks'),
  });

  const frameworkQueries = (frameworks || []).map(fw =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery<FrameworkStats>({
      queryKey: ['framework', fw.id],
      queryFn: () => api.get(`/frameworks/${fw.id}`),
      enabled: !!fw.id,
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-header">Compliance Frameworks</h2>
        <p className="section-subtitle">Manage your compliance posture across multiple security frameworks</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(frameworks || []).map((fw, i) => {
          const stats = frameworkQueries[i]?.data;
          const score = stats?.score ?? 0;

          return (
            <Link key={fw.id} to={`/frameworks/${fw.id}`} className="card-hover p-6 block">
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${fw.type === 'nist' ? 'bg-primary-900/40 border border-primary-800/50' : 'bg-emerald-900/40 border border-emerald-800/50'}`}>
                  <Shield size={22} className={fw.type === 'nist' ? 'text-primary-400' : 'text-emerald-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{fw.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{fw.version}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 flex-shrink-0 mt-1" />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{fw.description}</p>

                  {stats && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500">Compliance Score</span>
                        <span className={`text-sm font-bold ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{score.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-3">
                        {[
                          { label: 'Implemented', count: stats.implemented, color: 'text-emerald-400', Icon: CheckCircle2 },
                          { label: 'In Progress', count: stats.in_progress, color: 'text-amber-400', Icon: Clock },
                          { label: 'Not Impl.', count: stats.not_implemented, color: 'text-red-400', Icon: XCircle },
                          { label: 'N/A', count: stats.not_applicable, color: 'text-slate-500', Icon: Minus },
                        ].map(({ label, count, color, Icon }) => (
                          <div key={label} className="text-center">
                            <div className={`text-lg font-bold ${color}`}>{count}</div>
                            <div className="text-xs text-slate-600">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
