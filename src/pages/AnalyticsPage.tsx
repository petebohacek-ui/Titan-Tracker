import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChartCard } from '../components/ChartCard';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';

const keyLifts = [
  'Conventional Deadlift',
  'Barbell Back Squat',
  'Barbell Bench Press',
  'Standing Overhead Press',
  'Barbell Row',
  'Weighted Pull-Up',
  'Pull-Up'
];

const COLORS = ['#22d3ee', '#fb7185', '#a78bfa', '#f59e0b', '#10b981', '#60a5fa'];

export const AnalyticsPage = () => {
  const analytics = useAppStore((state) => state.analytics);
  const [liftFilter, setLiftFilter] = useState('Barbell Bench Press');

  const strengthData = useMemo(
    () => analytics.strengthSeries.filter((entry) => keyLifts.includes(entry.exercise) && entry.exercise === liftFilter),
    [analytics.strengthSeries, liftFilter]
  );

  const calendarCells = analytics.workoutCalendar.slice(-84);
  const topVolumeExercises = analytics.volumeByExercise.slice().sort((a, b) => b.volume - a.volume).slice(0, 10);
  const mostFrequentExercises = analytics.volumeByExercise.slice().sort((a, b) => b.volume - a.volume).slice(0, 10);
  const mostImprovedExercises = analytics.personalRecords
    .reduce<Record<string, number>>((acc, pr) => {
      acc[pr.exerciseName] = (acc[pr.exerciseName] ?? 0) + 1;
      return acc;
    }, {});

  const improvedData = Object.entries(mostImprovedExercises)
    .map(([name, prs]) => ({ name, prs }))
    .sort((a, b) => b.prs - a.prs)
    .slice(0, 10);

  if (analytics.kpis.totalWorkouts === 0) {
    return (
      <SectionCard title="Analytics" subtitle="No charts available until you log workouts.">
        <p className="muted text-sm">Start your first Push workout to unlock charts and progress analytics.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Strength Progress" subtitle="Filter major lifts to inspect estimated 1RM progression">
        <div className="mb-3 flex flex-wrap gap-2">
          {keyLifts.map((lift) => (
            <button
              key={lift}
              className={`btn-subtle ${liftFilter === lift ? 'ring-2 ring-sky-300' : ''}`}
              type="button"
              onClick={() => setLiftFilter(lift)}
            >
              {lift}
            </button>
          ))}
        </div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="est1RM" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Weekly Volume" subtitle="Rolling 12-week training load">
          <ResponsiveContainer>
            <AreaChart data={analytics.weeklyVolumeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="volume" stroke="#22d3ee" fill="#22d3ee55" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Volume" subtitle="Month-over-month trend">
          <ResponsiveContainer>
            <BarChart data={analytics.monthlyVolumeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="volume" fill="#fb7185" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by Split" subtitle="Workout split distribution">
          <ResponsiveContainer>
            <BarChart data={analytics.volumeBySplit}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="split" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="volume" fill="#a78bfa" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume per Exercise" subtitle="Top exercises by accumulated volume">
          <ResponsiveContainer>
            <BarChart data={topVolumeExercises}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="volume" fill="#22d3ee" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Muscle Balance" subtitle="Volume distribution by muscle group">
          <ResponsiveContainer>
            <PieChart>
              <Tooltip />
              <Pie data={analytics.volumeByMuscle} dataKey="volume" nameKey="name" innerRadius={45} outerRadius={90} fill="#22d3ee" label>
                {analytics.volumeByMuscle.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Performance Trends" subtitle="Duration with rolling averages">
          <ResponsiveContainer>
            <LineChart data={analytics.durationSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="duration" stroke="#f59e0b" dot={false} />
              <Line dataKey="rolling7" stroke="#22d3ee" dot={false} />
              <Line dataKey="rolling30" stroke="#fb7185" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Intensity, Fatigue, Recovery" subtitle="Scatter intensity map">
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="rolling7" name="7-day intensity" />
              <YAxis dataKey="rolling30" name="30-day intensity" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={analytics.intensitySeries} fill="#22d3ee" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionCard title="Training Consistency" subtitle="Calendar heatmap and weekly frequency">
        <div className="mb-4 grid grid-cols-14 gap-1">
          {calendarCells.map((cell) => {
            const strength = cell.count === 0 ? 0.1 : Math.min(0.9, cell.count * 0.35);
            return (
              <div
                key={cell.date}
                title={`${cell.date}: ${cell.count} workouts`}
                className="h-3 rounded-sm"
                style={{ backgroundColor: `rgba(34, 211, 238, ${strength})` }}
              />
            );
          })}
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={analytics.frequencySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line dataKey="workouts" stroke="#10b981" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="PR Timeline" subtitle="Monthly PR count">
          <ResponsiveContainer>
            <BarChart data={analytics.prTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#22d3ee" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <SectionCard title="Top 10 Lifts" subtitle="Heaviest lifts recorded">
          <ol className="space-y-2">
            {analytics.topLifts.map((lift, index) => (
              <li key={`${lift.exercise}-${lift.weight}-${index}`} className="card flex items-center justify-between p-2 text-sm">
                <span>{index + 1}. {lift.exercise}</span>
                <strong>{lift.weight} lbs</strong>
              </li>
            ))}
          </ol>
        </SectionCard>

        <ChartCard title="Exercise Rankings" subtitle="Most frequent and most improved exercises">
          <ResponsiveContainer>
            <BarChart data={mostFrequentExercises}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="volume" name="Top Volume Exercises" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most Improved Exercises" subtitle="Exercises with most PR events">
          <ResponsiveContainer>
            <BarChart data={improvedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="prs" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
};
