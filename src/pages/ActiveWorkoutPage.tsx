import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, ChevronDown, ChevronUp, X, Flag, Timer } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { ExercisePicker } from '../components/ExercisePicker';
import type { ActiveExercise, ActiveSet, ExerciseDefinition } from '../types/workout';

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const ActiveWorkoutPage = () => {
  const navigate = useNavigate();
  const activeWorkout = useAppStore((state) => state.activeWorkout);
  const updateActiveWorkout = useAppStore((state) => state.updateActiveWorkout);
  const finishActiveWorkout = useAppStore((state) => state.finishActiveWorkout);
  const discardActiveWorkout = useAppStore((state) => state.discardActiveWorkout);
  const appError = useAppStore((state) => state.error);

  const [elapsed, setElapsed] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finishNotes, setFinishNotes] = useState('');
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!activeWorkout) {
      navigate('/', { replace: true });
      return;
    }
    const start = new Date(activeWorkout.startTime).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeWorkout, navigate]);

  if (!activeWorkout) return null;

  const totalVolume = activeWorkout.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter((s) => s.completed).reduce((s2, s) => s2 + s.weight * s.reps, 0), 0
  );
  const completedSets = activeWorkout.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);

  const updateExercise = (exerciseId: string, patch: Partial<ActiveExercise>) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex) => ex.id === exerciseId ? { ...ex, ...patch } : ex)
    };
    updateActiveWorkout(updated);
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<ActiveSet>) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        return { ...ex, sets: ex.sets.map((s) => s.id === setId ? { ...s, ...patch } : s) };
      })
    };
    updateActiveWorkout(updated);
  };

  const addSet = (exerciseId: string) => {
    const ex = activeWorkout.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const lastSet = ex.sets[ex.sets.length - 1];
    const newSet: ActiveSet = {
      id: crypto.randomUUID(),
      weight: lastSet?.weight ?? 95,
      reps: lastSet?.reps ?? 8,
      rpe: lastSet?.rpe ?? 8,
      restSeconds: lastSet?.restSeconds ?? 120,
      completed: false,
      previousWeight: lastSet?.previousWeight,
      previousReps: lastSet?.previousReps
    };
    updateExercise(exerciseId, { sets: [...ex.sets, newSet] });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    const ex = activeWorkout.exercises.find((e) => e.id === exerciseId);
    if (!ex || ex.sets.length <= 1) return;
    updateExercise(exerciseId, { sets: ex.sets.filter((s) => s.id !== setId) });
  };

  const removeExercise = (exerciseId: string) => {
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.filter((ex) => ex.id !== exerciseId)
    };
    updateActiveWorkout(updated);
  };

  const addExercise = (def: ExerciseDefinition) => {
    const newExercise: ActiveExercise = {
      id: crypto.randomUUID(),
      name: def.name,
      bodyPart: def.bodyPart,
      category: def.category,
      sets: [
        { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false },
        { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false },
        { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false }
      ]
    };
    updateActiveWorkout({ ...activeWorkout, exercises: [...activeWorkout.exercises, newExercise] });
    setShowPicker(false);
  };

  const toggleCollapse = (exerciseId: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const handleFinish = async () => {
    setFinishing(true);
    const saved = await finishActiveWorkout(finishNotes);
    setFinishing(false);
    if (saved) {
      navigate('/workout/summary', { replace: true });
    }
  };

  const handleDiscard = () => {
    discardActiveWorkout();
    navigate('/', { replace: true });
  };

  return (
    <div className="active-workout-page space-y-4 pb-32">
      {/* Sticky Header */}
      <div className="workout-header sticky top-0 z-30 card p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="muted text-xs uppercase tracking-wider">{activeWorkout.split}</p>
            <h2 className="text-lg font-bold leading-tight">{activeWorkout.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-[var(--surface-2)] px-3 py-1.5">
              <Timer className="h-4 w-4 text-[var(--primary)]" />
              <span className="font-mono text-sm font-semibold">{formatDuration(elapsed)}</span>
            </div>
            <button type="button" className="icon-btn text-[var(--text-muted)]" onClick={() => setConfirmDiscard(true)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Live Stats */}
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{activeWorkout.exercises.length}</p>
            <p className="muted text-xs">Exercises</p>
          </div>
          <div>
            <p className="text-lg font-bold">{completedSets}</p>
            <p className="muted text-xs">Sets Done</p>
          </div>
          <div>
            <p className="text-lg font-bold">{totalVolume > 0 ? `${totalVolume.toLocaleString()}` : '—'}</p>
            <p className="muted text-xs">Volume (lbs)</p>
          </div>
        </div>
      </div>

      {/* Exercises */}
      {activeWorkout.exercises.map((exercise) => {
        const isCollapsed = collapsedExercises.has(exercise.id);
        return (
          <div key={exercise.id} className="card">
            {/* Exercise Header */}
            <div className="flex items-center gap-2 p-4 pb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                    {exercise.bodyPart}
                  </span>
                  {exercise.pr && (
                    <span className="rounded-lg bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                      PR: {exercise.pr.weight}×{exercise.pr.reps}
                    </span>
                  )}
                </div>
                <h4 className="mt-1 font-bold">{exercise.name}</h4>
                {exercise.pr && (
                  <p className="muted text-xs">1RM est: {exercise.pr.est1RM} lbs</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="icon-btn" onClick={() => toggleCollapse(exercise.id)}>
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
                <button type="button" className="icon-btn text-[var(--danger)]" onClick={() => removeExercise(exercise.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="px-4 pb-4">
                {/* Set Table Header */}
                <div className="mb-2 grid grid-cols-[1.5rem_1fr_1fr_1fr_1.5rem] gap-2 text-center">
                  <p className="muted text-xs">Set</p>
                  <p className="muted text-xs">Previous</p>
                  <p className="muted text-xs">Weight</p>
                  <p className="muted text-xs">Reps</p>
                  <p className="muted text-xs">✓</p>
                </div>

                {/* Sets */}
                {exercise.sets.map((set, setIdx) => (
                  <div
                    key={set.id}
                    className={`set-row mb-1.5 grid grid-cols-[1.5rem_1fr_1fr_1fr_1.5rem] items-center gap-2 rounded-xl p-2 transition-colors ${set.completed ? 'set-row-done' : ''}`}
                  >
                    <span className="text-center text-sm font-semibold text-[var(--text-muted)]">{setIdx + 1}</span>
                    <span className="text-center text-xs text-[var(--text-muted)]">
                      {set.previousWeight && set.previousReps
                        ? `${set.previousWeight}×${set.previousReps}`
                        : '—'}
                    </span>
                    <input
                      className="set-input text-center"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={2.5}
                      value={set.weight}
                      onChange={(e) => updateSet(exercise.id, set.id, { weight: Number(e.target.value) })}
                    />
                    <input
                      className="set-input text-center"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      value={set.reps}
                      onChange={(e) => updateSet(exercise.id, set.id, { reps: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      className={`set-check ${set.completed ? 'set-check-done' : ''}`}
                      onClick={() => updateSet(exercise.id, set.id, { completed: !set.completed })}
                    >
                      {set.completed && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}

                {/* Set actions */}
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-subtle flex-1 py-2 text-sm" onClick={() => addSet(exercise.id)}>
                    + Add Set
                  </button>
                  {exercise.sets.length > 1 && (
                    <button
                      type="button"
                      className="btn-subtle px-3 py-2 text-sm text-[var(--danger)]"
                      onClick={() => removeSet(exercise.id, exercise.sets[exercise.sets.length - 1].id)}
                    >
                      − Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {activeWorkout.exercises.length === 0 && (
        <div className="card p-8 text-center">
          <p className="muted text-sm">Add an exercise to get started</p>
        </div>
      )}

      {/* Sticky Bottom Actions */}
      <div className="workout-bottom-actions">
        <button type="button" className="btn-subtle flex-1 flex items-center justify-center gap-2" onClick={() => setShowPicker(true)}>
          <Plus className="h-5 w-5" />
          Add Exercise
        </button>
        <button
          type="button"
          className="btn-primary flex-1 flex items-center justify-center gap-2"
          onClick={() => setShowFinishModal(true)}
          disabled={completedSets === 0}
        >
          <Flag className="h-5 w-5" />
          Finish Workout
        </button>
      </div>

      {/* Exercise Picker Modal */}
      {showPicker && (
        <ExercisePicker
          split={activeWorkout.split}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Finish Modal */}
      {showFinishModal && (
        <div className="modal-overlay" onClick={() => setShowFinishModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold">Finish Workout?</h3>
            <div className="mb-3 grid grid-cols-3 gap-3 text-center">
              <div className="card p-3">
                <p className="text-xl font-bold">{formatDuration(elapsed)}</p>
                <p className="muted text-xs">Duration</p>
              </div>
              <div className="card p-3">
                <p className="text-xl font-bold">{completedSets}</p>
                <p className="muted text-xs">Sets</p>
              </div>
              <div className="card p-3">
                <p className="text-xl font-bold">{totalVolume > 999 ? `${(totalVolume/1000).toFixed(1)}k` : totalVolume}</p>
                <p className="muted text-xs">lbs</p>
              </div>
            </div>
            <textarea
              className="field mb-4 min-h-[80px] resize-none"
              placeholder="Add workout notes (optional)"
              value={finishNotes}
              onChange={(e) => setFinishNotes(e.target.value)}
            />
            {appError && <p className="mb-3 text-xs text-[var(--danger)]">{appError}</p>}
            <div className="flex gap-3">
              <button type="button" className="btn-subtle flex-1" onClick={() => setShowFinishModal(false)}>Continue</button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => void handleFinish()}
                disabled={finishing}
              >
                {finishing ? 'Saving...' : 'Save Workout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Modal */}
      {confirmDiscard && (
        <div className="modal-overlay" onClick={() => setConfirmDiscard(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold">Discard Workout?</h3>
            <p className="muted mb-4 text-sm">All progress will be lost.</p>
            <div className="flex gap-3">
              <button type="button" className="btn-subtle flex-1" onClick={() => setConfirmDiscard(false)}>Keep Going</button>
              <button type="button" className="flex-1 rounded-xl bg-[var(--danger)] py-2.5 font-semibold text-white" onClick={handleDiscard}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
