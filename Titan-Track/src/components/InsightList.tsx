import type { Insight } from '../types/workout';

interface InsightListProps {
  insights: Insight[];
}

const accentClass = (type: Insight['type']) => {
  if (type === 'success') return 'text-emerald-400';
  if (type === 'warning') return 'text-amber-400';
  return 'text-sky-400';
};

export const InsightList = ({ insights }: InsightListProps) => (
  <ul className="space-y-2">
    {insights.map((insight) => (
      <li key={insight.id} className="card p-3 text-sm">
        <span className={accentClass(insight.type)}>●</span> {insight.message}
      </li>
    ))}
  </ul>
);
