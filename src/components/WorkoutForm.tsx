import { useMemo, useState } from 'react';
import { formatISO } from 'date-fns';
import type { WorkoutSession, WorkoutSplit } from '../types/workout';
import { useAppStore } from '../hooks/useAppStore';

interface WorkoutFormProps {
  split: WorkoutSplit;
  onCreate: (session: WorkoutSession) => Promise<void>;
}

interface DraftSet {
  id: string;
  reps: number;
  weight: number;
  rpe: number;
  restSeconds: number;
}

interface DraftExercise {
  id: string;
  name: string;
  bodyPart: WorkoutSession['exercises'][number]['bodyPart'];
  category: WorkoutSession['exercises'][number]['category'];
  sets: DraftSet[];
  notes?: string;
}

const createSet = (): DraftSet => ({
  id: crypto.randomUUID(),
  reps: 8,
  weight: 95,
  rpe: 8,
  restSeconds: 120
});

const createExercise = (split: WorkoutSplit, options: AppStoreExerciseOption[]): DraftExercise => {
  const fallback =
    options.find((exercise) => exercise.primarySplits.includes(split) || split === 'Full Body' || split === 'Custom') ??
    options[0] ?? {
      id: crypto.randomUUID(),
      name: 'Custom Exercise',
      bodyPart: 'Chest' as const,
      category: 'Compound' as const,
      primarySplits: [split]
    };

  return {
    id: crypto.randomUUID(),
    name: fallback.name,
    bodyPart: fallback.bodyPart,
    category: fallback.category,
    sets: [createSet(), createSet(), createSet()]
  };
};

type AppStoreExerciseOption = ReturnType<typeof useAppStore.getState>['exerciseCatalog'][number];

export const WorkoutForm = ({ split, onCreate }: WorkoutFormProps) => {
  const exerciseCatalog = useAppStore((state) => state.exerciseCatalog);

  const exerciseOptions = useMemo(
    () => exerciseCatalog.filter((exercise) => exercise.primarySplits.includes(split) || split === 'Full Body' || split === 'Custom'),
    [exerciseCatalog, split]
  );

  const [date, setDate] = useState(formatISO(new Date(), { representation: 'date' }));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>(() => [createExercise(split, exerciseOptions)]);
  const [submitting, setSubmitting] = useState(false);

  const updateExercise = (exerciseId: string, patch: Partial<DraftExercise>) => {
    setExercises((current) => current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)));
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<DraftSet>) => {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }
        return {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set))
        };
      })
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, sets: [...exercise.sets, createSet()] } : exercise
      )
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId || exercise.sets.length <= 1) {
          return exercise;
        }
        return { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) };
      })
    );
  };

  const addExercise = () => setExercises((current) => [...current, createExercise(split, exerciseOptions)]);

  const removeExercise = (exerciseId: string) => {
    setExercises((current) => (current.length > 1 ? current.filter((exercise) => exercise.id !== exerciseId) : current));
  };

  const onSubmit = async () => {
    if (exercises.length === 0 || exercises.some((exercise) => exercise.sets.length === 0)) {
      return;
    }

    setSubmitting(true);
    const nowIso = new Date().toISOString();

    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      date,
      split,
      durationMinutes,
      totalVolume: exercises.reduce(
        (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + set.weight * set.reps, 0),
        0
      ),
      completed: true,
      notes: notes.trim() || undefined,
      exercises,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await onCreate(session);

    setDate(formatISO(new Date(), { representation: 'date' }));
    setDurationMinutes(60);
    setNotes('');
    setExercises([createExercise(split, exerciseOptions)]);
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="muted">Date</span>
          <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Duration (minutes)</span>
          <input
            className="field"
            type="number"
            min={10}
            max={240}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-1">
          <span className="muted">Session Notes</span>
          <input className="field" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="How did today feel?" />
        </label>
      </div>

      {exercises.map((exercise, exerciseIndex) => (
        <article key={exercise.id} className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="field max-w-xs"
              value={exercise.name}
              onChange={(event) => {
                const selected = exerciseOptions.find((item) => item.name === event.target.value);
                if (!selected) return;
                updateExercise(exercise.id, {
                  name: selected.name,
                  bodyPart: selected.bodyPart,
                  category: selected.category
                });
              }}
            >
              {exerciseOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            <span className="muted text-xs">{exercise.bodyPart}</span>
            <span className="muted text-xs">{exercise.category}</span>
            <button className="btn-subtle ml-auto" onClick={() => removeExercise(exercise.id)} type="button">
              Remove Exercise
            </button>
          </div>

          <div className="space-y-2">
            {exercise.sets.map((set, setIndex) => (
              <div key={set.id} className="grid grid-cols-5 gap-2 rounded-xl bg-slate-500/5 p-2 text-sm">
                <label>
                  <span className="muted text-xs">Set {setIndex + 1}</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={set.weight}
                    onChange={(event) => updateSet(exercise.id, set.id, { weight: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span className="muted text-xs">Reps</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={set.reps}
                    onChange={(event) => updateSet(exercise.id, set.id, { reps: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span className="muted text-xs">RPE</span>
                  <input
                    className="field"
                    type="number"
                    min={5}
                    max={10}
                    step={0.5}
                    value={set.rpe}
                    onChange={(event) => updateSet(exercise.id, set.id, { rpe: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span className="muted text-xs">Rest (s)</span>
                  <input
                    className="field"
                    type="number"
                    min={30}
                    max={600}
                    step={15}
                    value={set.restSeconds}
                    onChange={(event) => updateSet(exercise.id, set.id, { restSeconds: Number(event.target.value) })}
                  />
                </label>
                <button
                  className="btn-subtle mt-5"
                  type="button"
                  onClick={() => removeSet(exercise.id, set.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="muted text-xs">Exercise {exerciseIndex + 1}</p>
            <button className="btn-subtle" type="button" onClick={() => addSet(exercise.id)}>
              + Add Set
            </button>
          </div>
        </article>
      ))}

      <div className="flex flex-wrap gap-3">
        <button className="btn-subtle" type="button" onClick={addExercise}>
          + Add Exercise
        </button>
        <button className="btn-primary" type="button" disabled={submitting} onClick={onSubmit}>
          {submitting ? 'Saving...' : 'Complete Workout'}
        </button>
      </div>
    </div>
  );
};
