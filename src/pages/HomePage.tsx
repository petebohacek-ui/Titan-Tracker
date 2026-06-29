import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Dumbbell, Flame, Play, RotateCcw, ChevronRight, Target, Clock } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { workoutVolume } from '../utils/math';
import type { WorkoutSplit } from '../types/workout';

const QUICK_SPLITS: { split: WorkoutSplit; emoji: string }[] = [
  { split: 'Push', emoji: '🤜' },
  { split: 'Pull', emoji: '🤛' },
  { split: 'Legs', emoji: '🦵' },
  { split: 'Upper', emoji: '💪' },
  { split: 'Lower', emoji: '🏋️' },
  { split: 'Full Body', emoji: '⚡' },
  { split: 'Cardio', emoji: '🏃' },
  { split: 'Custom', emoji: '✏️' },
];

export const HomePage = () => {
  const navigate = useNavigate();
  const workouts = useAppStore((state) => state.workouts);
  const goals = useAppStore((state) => state.goals);
  const analytics = useAppStore((state) => state.analytics);
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const startWorkout = useAppStore((state) => state.startWorkout);

  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  const recentWorkouts = [...workouts].reverse().slice(0, 5);
  const streak = analytics.kpis.currentStreak;

  const lastBySplit = (split: WorkoutSplit) =>
    [...workouts].reverse().find((w) => w.split === split);

  const handleStartWorkout = (split: WorkoutSplit) => {
    startWorkout(split, workoutName || split);
    setShowSplitPicker(false);
    setWorkoutName('');
    navigate('/workout/active');
  };

  const handleRepeatLast = (split: WorkoutSplit) => {
    const last = lastBySplit(split);
    startWorkout(split, split, last ?? undefined);
    navigate('/workout/active');
  };

  const handleContinue = () => {
    navigate('/workout/active');
  };

  return (
    <div className="home-page space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Today</h2>
          <p className="muted text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1.5">
            <Flame className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">{streak} day streak</span>
          </div>
        )}
      </div>

      {/* Continue Banner */}
      {activeWorkout && (
        <button
          type="button"
          onClick={handleContinue}
          className="continue-banner w-full"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-400/20 p-2.5">
              <Play className="h-5 w-5 text-cyan-400" fill="currentColor" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-cyan-300">Continue Workout</p>
              <p className="muted text-xs">{activeWorkout.name} • {activeWorkout.exercises.length} exercises</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-cyan-400" />
        </button>
      )}

      {/* Start Workout Button */}
      {!activeWorkout && (
        <button
          type="button"
          className="start-workout-btn w-full"
          onClick={() => setShowSplitPicker(true)}
        >
          <Dumbbell className="h-7 w-7" />
          <span>Start Workout</span>
        </button>
      )}

      {/* Split Picker Modal */}
      {showSplitPicker && (
        <div className="modal-overlay" onClick={() => setShowSplitPicker(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Choose Workout</h3>
              <button type="button" className="btn-subtle px-3 py-1 text-sm" onClick={() => setShowSplitPicker(false)}>Cancel</button>
            </div>
            <input
              className="field mb-4"
              placeholder="Workout name (optional)"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2.5">
              {QUICK_SPLITS.map(({ split, emoji }) => (
                <button
                  key={split}
                  type="button"
                  className="split-pick-btn"
                  onClick={() => handleStartWorkout(split)}
                >
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-semibold">{split}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Repeat */}
      <section>
        <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Repeat Last</h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['Push', 'Pull', 'Legs'] as WorkoutSplit[]).map((split) => {
            const last = lastBySplit(split);
            return (
              <button
                key={split}
                type="button"
                className="repeat-btn flex-shrink-0"
                onClick={() => handleRepeatLast(split)}
                disabled={!last}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="font-semibold">{split}</span>
                {last && <span className="muted text-xs">{last.date}</span>}
                {!last && <span className="muted text-xs">No history</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quick Navigation</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <NavLink to="/dashboard" className="btn-subtle text-center text-sm">Dashboard</NavLink>
          <NavLink to="/analytics" className="btn-subtle text-center text-sm">Analytics</NavLink>
          <NavLink to="/history" className="btn-subtle text-center text-sm">History</NavLink>
          <NavLink to="/goals" className="btn-subtle text-center text-sm">Goals</NavLink>
          <NavLink to="/templates" className="btn-subtle text-center text-sm">Templates</NavLink>
          <NavLink to="/over-time" className="btn-subtle text-center text-sm">Over Time</NavLink>
        </div>
      </section>

      {/* Today's Goals */}
      {goals.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <Target className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Goals</h3>
          </div>
          <div className="space-y-2">
            {goals.slice(0, 3).map((goal) => {
              const pct = Math.min(100, Math.round((goal.progress / goal.target) * 100));
              return (
                <div key={goal.id} className="card p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold">{goal.label}</p>
                    <p className="muted text-xs">{goal.progress}/{goal.target} {goal.unit}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-2)]">
                    <div className="h-1.5 rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Workouts */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <Clock className="h-4 w-4 text-[var(--primary)]" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recent Workouts</h3>
        </div>
        {recentWorkouts.length === 0 ? (
          <div className="card p-6 text-center">
            <Dumbbell className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="muted text-sm">No workouts yet. Start your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map((workout) => (
              <article key={workout.id} className="card flex items-center justify-between p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">{workout.split}</span>
                    <p className="text-sm font-semibold">{workout.notes ?? ''}</p>
                  </div>
                  <p className="muted mt-0.5 text-xs">
                    {workout.date} • {workout.durationMinutes} min • {workout.exercises.length} exercises
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{workoutVolume(workout).toLocaleString()}</p>
                  <p className="muted text-xs">lbs</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
