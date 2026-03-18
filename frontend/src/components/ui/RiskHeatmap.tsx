import { Tooltip, TooltipProps } from 'recharts';

interface HeatmapCell {
  likelihood: number;
  impact: number;
  count: number;
  titles?: string;
}

interface RiskHeatmapProps {
  data: HeatmapCell[];
}

const likelihoods = [5, 4, 3, 2, 1];
const impacts = [1, 2, 3, 4, 5];

function getCellColor(likelihood: number, impact: number) {
  const score = likelihood * impact;
  if (score >= 20) return 'bg-red-600/80 border-red-500/50';
  if (score >= 15) return 'bg-orange-500/80 border-orange-400/50';
  if (score >= 9) return 'bg-amber-500/80 border-amber-400/50';
  if (score >= 4) return 'bg-yellow-600/60 border-yellow-500/50';
  return 'bg-emerald-700/50 border-emerald-600/50';
}

const likelihoodLabels = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const impactLabels = ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];

export default function RiskHeatmap({ data }: RiskHeatmapProps) {
  const lookup = new Map(data.map(d => [`${d.likelihood}-${d.impact}`, d]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[380px]">
        {/* Impact labels across top */}
        <div className="flex mb-1 pl-20">
          {impacts.map(i => (
            <div key={i} className="flex-1 text-center text-xs text-slate-500 px-1 truncate">{impactLabels[i]}</div>
          ))}
        </div>
        {/* Grid */}
        {likelihoods.map(l => (
          <div key={l} className="flex items-center mb-1 gap-1">
            <div className="w-20 text-right text-xs text-slate-500 pr-2 leading-tight flex-shrink-0">{likelihoodLabels[l]}</div>
            {impacts.map(i => {
              const cell = lookup.get(`${l}-${i}`);
              return (
                <div
                  key={i}
                  className={`flex-1 aspect-square flex items-center justify-center rounded border text-sm font-bold transition-all cursor-default ${getCellColor(l, i)} ${cell?.count ? 'text-white' : 'text-slate-600'}`}
                  title={cell ? `${cell.titles?.split('||').join(', ')}` : `L${l} × I${i} = ${l * i}`}
                >
                  {cell?.count || ''}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-4 mt-3 pl-20">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-700/50" /><span className="text-xs text-slate-500">Low</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/80" /><span className="text-xs text-slate-500">Medium</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500/80" /><span className="text-xs text-slate-500">High</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-600/80" /><span className="text-xs text-slate-500">Critical</span></div>
        </div>
      </div>
    </div>
  );
}
