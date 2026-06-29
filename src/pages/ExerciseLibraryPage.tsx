import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import { getExerciseHistory } from '../services/selectors';
import type { BodyPart, ExerciseCategory, ExerciseDefinition } from '../types/workout';

const BODY_PART_OPTIONS: BodyPart[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

export const ExerciseLibraryPage = () => {
  const navigate = useNavigate();
  const workouts = useAppStore((state) => state.workouts);
  const exerciseCatalog = useAppStore((state) => state.exerciseCatalog);
  const updateCustomExercise = useAppStore((state) => state.updateCustomExercise);
  const deleteCustomExercise = useAppStore((state) => state.deleteCustomExercise);

  const [query, setQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState(exerciseCatalog[0]?.name ?? '');
  const [editingExercise, setEditingExercise] = useState<ExerciseDefinition | null>(null);
  const [editError, setEditError] = useState('');

  const filteredExercises = useMemo(
    () => exerciseCatalog.filter((exercise) => exercise.name.toLowerCase().includes(query.toLowerCase())),
    [exerciseCatalog, query]
  );

  const currentExercise = filteredExercises.find((exercise) => exercise.name === selectedExercise) ?? filteredExercises[0] ?? null;
  const history = useMemo(
    () => getExerciseHistory(workouts, currentExercise?.name ?? ''),
    [workouts, currentExercise?.name]
  );

  const handleSaveCustomExercise = async () => {
    if (!editingExercise) return;
    try {
      await updateCustomExercise(editingExercise.id, {
        name: editingExercise.name,
        bodyPart: editingExercise.bodyPart,
        category: editingExercise.category,
        primarySplits: editingExercise.primarySplits
      });
      setEditError('');
      setEditingExercise(null);
      setSelectedExercise(editingExercise.name);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to save exercise changes.');
    }
  };

  const handleDeleteCustomExercise = async (exercise: ExerciseDefinition) => {
    if (!window.confirm(`Delete ${exercise.name}? Workout history will be preserved.`)) {
      return;
    }
    await deleteCustomExercise(exercise.id);
    if (selectedExercise === exercise.name) {
      const next = filteredExercises.find((entry) => entry.id !== exercise.id);
      setSelectedExercise(next?.name ?? '');
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Exercise Library" subtitle="Search exercises and inspect complete training history">
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <input
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by exercise name"
          />
          <select
            className="field"
            value={currentExercise?.name ?? ''}
            onChange={(event) => setSelectedExercise(event.target.value)}
            disabled={filteredExercises.length === 0}
          >
            {filteredExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.name}>
                {exercise.name} ({exercise.bodyPart})
              </option>
            ))}
          </select>
        </div>

        {filteredExercises.length === 0 ? (
          <p className="muted text-sm">No exercises match your search.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {filteredExercises.map((exercise) => (
              <article
                key={exercise.id}
                className={`card p-3 text-left ${currentExercise?.name === exercise.name ? 'ring-2 ring-sky-300' : ''}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setSelectedExercise(exercise.name)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{exercise.name}</p>
                    {exercise.isCustom && <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-xs">Custom</span>}
                  </div>
                  <p className="muted text-xs">{exercise.bodyPart} • {exercise.category}</p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-subtle text-xs"
                    onClick={() => {
                      navigate(`/exercise/${encodeURIComponent(exercise.name)}`);
                    }}
                  >
                    View Details
                  </button>
                  {exercise.isCustom && (
                    <>
                      <button
                        type="button"
                        className="btn-subtle text-xs"
                        onClick={() => {
                          setEditingExercise(exercise);
                          setEditError('');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-subtle text-xs text-[var(--danger)]"
                        onClick={() => {
                          void handleDeleteCustomExercise(exercise);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`${currentExercise?.name ?? 'Exercise'} History`} subtitle="Volume, 1RM, and progression timeline">
        {history.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No training history yet for this exercise.</p>
        ) : (
          <>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="estimated1RM" name="Estimated 1RM" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="volume" name="Volume" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-400">
                    <th className="p-2">Date</th>
                    <th className="p-2">Weight</th>
                    <th className="p-2">Sets</th>
                    <th className="p-2">Reps</th>
                    <th className="p-2">Volume</th>
                    <th className="p-2">Est. 1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((entry, index) => (
                      <tr key={`${entry.date}-${entry.weight}-${entry.volume}-${index}`} className="border-t border-slate-500/20">
                        <td className="p-2">{entry.date}</td>
                        <td className="p-2">{entry.weight} lbs</td>
                        <td className="p-2">{entry.sets}</td>
                        <td className="p-2">{entry.reps}</td>
                        <td className="p-2">{entry.volume.toLocaleString()} lbs</td>
                        <td className="p-2">{entry.estimated1RM} lbs</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {editingExercise && (
        <div className="modal-overlay" onClick={() => setEditingExercise(null)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">Edit Custom Exercise</h3>
            <div className="space-y-2">
              <input
                className="field"
                value={editingExercise.name}
                onChange={(event) => setEditingExercise({ ...editingExercise, name: event.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="field"
                  value={editingExercise.bodyPart}
                  onChange={(event) => setEditingExercise({ ...editingExercise, bodyPart: event.target.value as BodyPart })}
                >
                  {BODY_PART_OPTIONS.map((bodyPart) => (
                    <option key={bodyPart} value={bodyPart}>
                      {bodyPart}
                    </option>
                  ))}
                </select>
                <select
                  className="field"
                  value={editingExercise.category}
                  onChange={(event) => setEditingExercise({ ...editingExercise, category: event.target.value as ExerciseCategory })}
                >
                  <option value="Compound">Compound</option>
                  <option value="Isolation">Isolation</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-subtle flex-1" onClick={() => setEditingExercise(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary flex-1" onClick={() => void handleSaveCustomExercise()}>
                  Save
                </button>
              </div>
              {editError && <p className="text-xs text-[var(--danger)]">{editError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
