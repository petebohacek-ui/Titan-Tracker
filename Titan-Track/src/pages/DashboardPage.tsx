import { NavLink } from 'react-router-dom';
import { KpiCard } from '../components/KpiCard';
import { SectionCard } from '../components/SectionCard';
import { InsightList } from '../components/InsightList';
import { useAppStore } from '../hooks/useAppStore';
import { workoutVolume } from '../utils/math';
import { ChevronRight } from 'lucide-react';

export const DashboardPage = () => {
  const analytics = useAppStore((state) => state.analytics);
  const workouts = useAppStore((state) => state.workouts);
  const goals = useAppStore((state) => state.goals);

  const recentWorkouts = workouts.slice(-5).reverse();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="muted text-sm">Daily training overview with live metrics</p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Workout Count" value={String(analytics.kpis.totalWorkouts)} />
        <KpiCard label="Current Streak" value={`${analytics.kpis.currentStreak} days`} />
        <KpiCard label="Weekly Volume" value={`${analytics.kpis.weeklyVolume.toLocaleString()} lbs`} />
        <KpiCard label="Monthly Volume" value={`${analytics.kpis.monthlyVolume.toLocaleString()} lbs`} />
        <KpiCard label="Total Weight Lifted" value={`${analytics.kpis.totalWeightLifted.toLocaleString()} lbs`} />
        <KpiCard label="Highest Lift" value={analytics.kpis.highestLift ? `${analytics.kpis.highestLift.weight} lbs` : 'N/A'} hint={analytics.kpis.highestLift?.exercise} />
        <KpiCard label="Favorite Exercise" value={analytics.kpis.favoriteExercise} />
        <KpiCard label="Training Frequency" value={`${analytics.kpis.averageWeeklyWorkouts} / week`} />
        <KpiCard label="Avg Workout Duration" value={`${analytics.kpis.averageWorkoutDuration} min`} />
        <KpiCard label="Avg Weekly Workouts" value={`${analytics.kpis.averageWeeklyWorkouts}`} />
        <KpiCard label="Recovery Score" value={`${analytics.kpis.recoveryScore}%`} />
        <KpiCard label="Consistency Score" value={`${analytics.kpis.consistencyScore}%`} />
        <KpiCard
          label="Newest PR"
          value={analytics.kpis.newestPr ? `${analytics.kpis.newestPr.exerciseName} ${analytics.kpis.newestPr.estimated1RM} lbs` : 'No PR Yet'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Smart Insights" subtitle="Auto-generated coaching insights">
          {analytics.insights.length === 0 ? (
            <p className="muted text-sm">No insights yet. Complete a workout to generate recommendations.</p>
          ) : (
            <InsightList insights={analytics.insights} />
          )}
        </SectionCard>

        <SectionCard title="Goals" subtitle="Progress toward current targets">
          {goals.length === 0 ? (
            <p className="muted text-sm">No goals set. Add one in Goals or Settings.</p>
          ) : (
            <ul className="space-y-2">
              {goals.map((goal) => {
                const pct = Math.max(0, Math.min(100, (goal.progress / Math.max(1, goal.target)) * 100));
                return (
                  <li key={goal.id} className="card p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{goal.label}</p>
                      <p className="text-xs">{goal.progress}/{goal.target} {goal.unit}</p>
                    </div>
                    <div className="mt-2 h-2 rounded bg-slate-400/20">
                      <div className="h-2 rounded bg-cyan-400" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recent Workouts" subtitle="Latest completed sessions">
        {recentWorkouts.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No workouts yet.</p>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((workout) => (
              <article key={workout.id} className="card flex items-center justify-between p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">{workout.split}</span>
                  </div>
                  <p className="muted text-xs mt-1">{workout.date} • {workout.durationMinutes} min • {workout.exercises.length} exercises</p>
                </div>
                <p className="text-sm font-semibold">{workoutVolume(workout).toLocaleString()} lbs</p>
              </article>
            ))}
          </div>
        )}
        <div className="mt-3">
          <NavLink
            to="/history"
            className="flex items-center justify-center gap-1 rounded-xl py-2 text-sm text-[var(--primary)]"
          >
            View Full History <ChevronRight className="h-4 w-4" />
          </NavLink>
        </div>
      </SectionCard>
    </div>
  );
}
