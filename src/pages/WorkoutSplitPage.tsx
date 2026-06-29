import { useMemo, useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { WorkoutForm } from '../components/WorkoutForm';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import { splitFromSlug } from '../utils/split';
import { workoutVolume } from '../utils/math';
import { RotateCcw, Trash2, Pencil } from 'lucide-react';
import { SPLITS } from '../utils/constants';
import type { WorkoutSplit } from '../types/workout';

const splitToSlug = (split: WorkoutSplit) => split.toLowerCase().replace(' ', '-');

export const WorkoutSplitPage = () => {
  const { split: splitSlug } = useParams();
  const navigate = useNavigate();
  const split = splitFromSlug(splitSlug);

  const workouts = useAppStore((state) => state.workouts);
  const personalRecords = useAppStore((state) => state.analytics.personalRecords);
  const addWorkout = useAppStore((state) => state.addWorkout);
  const updateWorkout = useAppStore((state) => state.updateWorkout);
  const deleteWorkout = useAppStore((state) => state.deleteWorkout);
  const startWorkout = useAppStore((state) => state.startWorkout);

  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [prOnly, setPrOnly] = useState(false);
  const [minWeight, setMinWeight] = useState(0);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editNotes, setEditNotes] = useState('');

  const filteredWorkouts = useMemo(() => {
    const prSet = new Set(personalRecords.map((pr) => `${pr.exerciseName}-${pr.date}`));
    return workouts
      .filter((workout) => workout.split === split)
      .filter((workout) => (!startDate || workout.date >= startDate) && (!endDate || workout.date <= endDate))
      .filter((workout) =>
        workout.exercises.some((exercise) => {
          const matchesSearch = !search || exercise.name.toLowerCase().includes(search.toLowerCase());
          const matchesMuscle = muscleGroup === 'All' || exercise.bodyPart === muscleGroup;
          const matchesWeight = exercise.sets.some((set) => set.weight >= minWeight);
          const matchesPr = !prOnly || prSet.has(`${exercise.name}-${workout.date}`);
          return matchesSearch && matchesMuscle && matchesWeight && matchesPr;
        })
      )
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [workouts, split, search, muscleGroup, startDate, endDate, prOnly, minWeight, personalRecords]);

  const muscleOptions = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  const handleRepeat = (workoutId: string) => {
    const workout = workouts.find((w) => w.id === workoutId);
    if (workout) {
      startWorkout(workout.split, workout.split, workout);
      navigate('/workout/active');
    }
  };

  const handleDelete = async (workoutId: string) => {
    if (window.confirm('Delete this workout? This cannot be undone.')) {
      await deleteWorkout(workoutId);
    }
  };

  const startEdit = (workoutId: string) => {
    const workout = workouts.find((entry) => entry.id === workoutId);
    if (!workout) return;
    setEditingWorkoutId(workout.id);
    setEditDate(workout.date);
    setEditDuration(workout.durationMinutes);
    setEditNotes(workout.notes ?? '');
  };

  const saveEdit = async () => {
    if (!editingWorkoutId) return;
    const existing = workouts.find((entry) => entry.id === editingWorkoutId);
    if (!existing) {
      setEditingWorkoutId(null);
      return;
    }
    await updateWorkout({
      ...existing,
      date: editDate,
      durationMinutes: Math.max(1, editDuration),
      notes: editNotes.trim() || undefined
    });
    setEditingWorkoutId(null);
  };

  return (
    <div className="space-y-4">
      {/* Split Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {SPLITS.map((s) => (
          <NavLink
            key={s}
            to={`/history/${splitToSlug(s)}`}
            className={({ isActive }) =>
              `flex-shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'btn-subtle'
              }`
            }
          >
            {s}
          </NavLink>
        ))}
      </div>

      <SectionCard title={`${split} Workout Log`} subtitle="Create and complete workouts with automatic analytics">
        <WorkoutForm split={split} onCreate={addWorkout} />
      </SectionCard>

      <SectionCard title="Search & Filters" subtitle="Exercise, date range, muscle group, PR status, and weight range">
        <div className="grid gap-2 md:grid-cols-6">
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercise" />
          <select className="field" value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)}>
            {muscleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input className="field" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <input className="field" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <input className="field" type="number" min={0} value={minWeight} onChange={(event) => setMinWeight(Number(event.target.value))} placeholder="Min weight" />
          <label className="card flex items-center justify-center gap-2 px-3 text-sm">
            <input type="checkbox" checked={prOnly} onChange={(event) => setPrOnly(event.target.checked)} />
            PR only
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Workout History" subtitle={`Filtered ${split} sessions`}>
        <div className="space-y-2">
          {filteredWorkouts.map((workout) => (
            <article key={workout.id} className="card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="font-semibold">{format(parseISO(workout.date), 'EEE, MMM d, yyyy')}</h4>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="shrink-0 text-sm">{workoutVolume(workout).toLocaleString()} lbs</span>
                  <button
                    type="button"
                    className="icon-btn text-[var(--primary)]"
                    title="Repeat workout"
                    onClick={() => handleRepeat(workout.id)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn text-[var(--primary)]"
                    title="Edit workout"
                    onClick={() => startEdit(workout.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn text-[var(--danger)]"
                    title="Delete workout"
                    onClick={() => void handleDelete(workout.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="muted text-xs">Duration {workout.durationMinutes} min</p>
              <ul className="mt-2 space-y-1 text-sm">
                {workout.exercises.map((exercise) => (
                  <li key={exercise.id}>
                    {exercise.name}: {exercise.sets.map((set) => `${set.weight}×${set.reps}`).join(', ')}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {filteredWorkouts.length === 0 && (
            <p className="muted py-6 text-center text-sm">No {split} workouts found.</p>
          )}
        </div>
      </SectionCard>

      {editingWorkoutId && (
        <div className="modal-overlay" onClick={() => setEditingWorkoutId(null)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">Edit Workout</h3>
            <div className="space-y-2">
              <input className="field" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
              <input className="field" type="number" min={1} value={editDuration} onChange={(event) => setEditDuration(Number(event.target.value))} />
              <textarea className="field" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Workout notes" />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-subtle flex-1" onClick={() => setEditingWorkoutId(null)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" onClick={() => void saveEdit()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
