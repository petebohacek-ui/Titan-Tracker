import { useMemo, useState } from 'react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import { getExerciseHistory, getExerciseNames, getExerciseOverview } from '../services/selectors';

type RangeFilter = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

const RANGE_LABELS: Record<RangeFilter, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '6m': '6 months',
  '1y': '1 year',
  all: 'All time'
};

const inRange = (date: string, range: RangeFilter) => {
  if (range === 'all') return true;
  const now = new Date();
  const value = new Date(date);
  if (range === '7d') return now.getTime() - value.getTime() <= 7 * 24 * 3600 * 1000;
  if (range === '30d') return now.getTime() - value.getTime() <= 30 * 24 * 3600 * 1000;
  if (range === '90d') return now.getTime() - value.getTime() <= 90 * 24 * 3600 * 1000;
  if (range === '6m') return now.getTime() - value.getTime() <= 182 * 24 * 3600 * 1000;
  return now.getTime() - value.getTime() <= 365 * 24 * 3600 * 1000;
};

export const OverTimePage = () => {
  const workouts = useAppStore((state) => state.workouts);
  const exerciseNames = useMemo(() => getExerciseNames(workouts), [workouts]);
  const [exerciseName, setExerciseName] = useState(exerciseNames[0] ?? '');
  const [range, setRange] = useState<RangeFilter>('90d');

  const history = useMemo(
    () => getExerciseHistory(workouts, exerciseName).filter((item) => inRange(item.date, range)),
    [workouts, exerciseName, range]
  );

  const overview = useMemo(
    () => getExerciseOverview(workouts.filter((workout) => inRange(workout.date, range)), exerciseName),
    [workouts, exerciseName, range]
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Progress Over Time" subtitle="Track each exercise across time windows">
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <select className="field" value={exerciseName} onChange={(event) => setExerciseName(event.target.value)}>
            {exerciseNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RANGE_LABELS) as RangeFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`btn-subtle text-xs ${range === value ? 'ring-2 ring-sky-300' : ''}`}
                onClick={() => setRange(value)}
              >
                {RANGE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No charts available until you log workouts.</p>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line dataKey="weight" stroke="#22d3ee" name="Weight" dot={false} />
                <Line dataKey="estimated1RM" stroke="#f59e0b" name="Estimated 1RM" dot={false} />
                <Line dataKey="volume" stroke="#fb7185" name="Volume" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Exercise Snapshot" subtitle="Sets, reps, volume, and consistency stats">
        {!overview ? (
          <p className="muted py-8 text-center text-sm">No workout data for this exercise in the selected range.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="card p-3"><p className="muted text-xs">Sessions</p><p className="text-xl font-bold">{overview.sessions}</p></div>
            <div className="card p-3"><p className="muted text-xs">Frequency</p><p className="text-xl font-bold">{overview.sessions}</p></div>
            <div className="card p-3"><p className="muted text-xs">Sets</p><p className="text-xl font-bold">{overview.totalSets}</p></div>
            <div className="card p-3"><p className="muted text-xs">Reps</p><p className="text-xl font-bold">{overview.totalReps}</p></div>
            <div className="card p-3"><p className="muted text-xs">Avg Weight</p><p className="text-xl font-bold">{overview.averageWeight}</p></div>
            <div className="card p-3"><p className="muted text-xs">Best Set</p><p className="text-xl font-bold">{overview.bestSet.weight}x{overview.bestSet.reps}</p></div>
            <div className="card p-3"><p className="muted text-xs">Best 1RM</p><p className="text-xl font-bold">{overview.estimated1RM}</p></div>
            <div className="card p-3"><p className="muted text-xs">Best Volume</p><p className="text-xl font-bold">{overview.bestVolume.toLocaleString()}</p></div>
            <div className="card p-3"><p className="muted text-xs">Total Volume</p><p className="text-xl font-bold">{overview.totalVolume.toLocaleString()}</p></div>
            <div className="card p-3"><p className="muted text-xs">Last Performed</p><p className="text-xl font-bold">{overview.lastPerformed}</p></div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
