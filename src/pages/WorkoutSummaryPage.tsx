import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, TrendingUp, TrendingDown, Minus, RotateCcw, Home, Star } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const WorkoutSummaryPage = () => {
  const navigate = useNavigate();
  const lastSummary = useAppStore((state) => state.lastSummary);
  const clearLastSummary = useAppStore((state) => state.clearLastSummary);
  const startWorkoutAction = useAppStore((state) => state.startWorkout);
  useEffect(() => {
    if (!lastSummary) {
      navigate('/', { replace: true });
    }
  }, [lastSummary, navigate]);

  if (!lastSummary) return null;

  const { workout, durationMinutes, totalVolume, totalSets, newPRs, volumeVsLast } = lastSummary;

  const handleRepeat = () => {
    startWorkoutAction(workout.split, workout.split, workout);
    navigate('/workout/active', { replace: true });
  };

  const handleHome = () => {
    clearLastSummary();
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Hero */}
      <div className="card p-6 text-center">
        <div className="mb-3 flex justify-center">
          <div className="rounded-full bg-[var(--ok)]/20 p-4">
            <Trophy className="h-10 w-10 text-[var(--ok)]" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">Workout Complete!</h2>
        <p className="muted mt-1 text-sm">{workout.split} • {workout.date}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{formatDuration(durationMinutes)}</p>
          <p className="muted text-sm">Duration</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{totalVolume.toLocaleString()}</p>
          <p className="muted text-sm">lbs lifted</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{workout.exercises.length}</p>
          <p className="muted text-sm">Exercises</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{totalSets}</p>
          <p className="muted text-sm">Sets</p>
        </div>
      </div>

      {/* Volume vs Last */}
      {volumeVsLast !== undefined && (
        <div className="card p-4">
          <p className="muted mb-1 text-xs uppercase tracking-wider">Volume vs Last {workout.split}</p>
          <div className="flex items-center gap-2">
            {volumeVsLast > 0 ? (
              <>
                <TrendingUp className="h-5 w-5 text-[var(--ok)]" />
                <p className="text-lg font-bold text-[var(--ok)]">+{volumeVsLast.toLocaleString()} lbs</p>
              </>
            ) : volumeVsLast < 0 ? (
              <>
                <TrendingDown className="h-5 w-5 text-[var(--danger)]" />
                <p className="text-lg font-bold text-[var(--danger)]">{volumeVsLast.toLocaleString()} lbs</p>
              </>
            ) : (
              <>
                <Minus className="h-5 w-5 text-[var(--text-muted)]" />
                <p className="muted text-lg font-bold">Same as last session</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Personal Records */}
      {newPRs.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" />
            <h3 className="font-bold">New Personal Records!</h3>
          </div>
          <div className="space-y-2">
            {newPRs.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between rounded-xl bg-yellow-500/10 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{pr.exerciseName}</p>
                  <p className="muted text-xs">{pr.weight} lbs × {pr.reps} reps</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-yellow-400">{pr.estimated1RM} lbs</p>
                  <p className="muted text-xs">est. 1RM</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise Breakdown */}
      <div className="card p-4">
        <h3 className="mb-3 font-bold">Exercise Breakdown</h3>
        <div className="space-y-3">
          {workout.exercises.map((ex) => {
            const vol = ex.sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
            const bestSet = ex.sets.reduce((best, s) => s.weight > best.weight ? s : best, ex.sets[0]);
            return (
              <div key={ex.id} className="border-b border-[var(--surface-2)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{ex.name}</p>
                    <p className="muted text-xs">{ex.sets.length} sets • Best: {bestSet?.weight}×{bestSet?.reps}</p>
                  </div>
                  <p className="text-sm font-semibold">{vol.toLocaleString()} lbs</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workout Notes */}
      {workout.notes && (
        <div className="card p-4">
          <p className="muted mb-1 text-xs uppercase tracking-wider">Notes</p>
          <p className="text-sm">{workout.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button type="button" className="btn-subtle flex-1 flex items-center justify-center gap-2 py-3" onClick={handleRepeat}>
          <RotateCcw className="h-5 w-5" />
          Repeat
        </button>
        <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2 py-3" onClick={handleHome}>
          <Home className="h-5 w-5" />
          Done
        </button>
      </div>
    </div>
  );
};
