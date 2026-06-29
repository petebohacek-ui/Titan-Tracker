import { useMemo, useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import type { BodyPart, ExerciseCategory, WorkoutSplit, ExerciseDefinition } from '../types/workout';
import { useAppStore } from '../hooks/useAppStore';

interface ExercisePickerProps {
  split: WorkoutSplit;
  onSelect: (exercise: ExerciseDefinition) => void;
  onClose: () => void;
}

const BODY_PARTS: Array<BodyPart | 'All'> = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio'];

export const ExercisePicker = ({ split, onSelect, onClose }: ExercisePickerProps) => {
  const exerciseCatalog = useAppStore((state) => state.exerciseCatalog);
  const workouts = useAppStore((state) => state.workouts);
  const addCustomExercise = useAppStore((state) => state.addCustomExercise);
  const [query, setQuery] = useState('');
  const [bodyPart, setBodyPart] = useState<BodyPart | 'All'>('All');
  const [newName, setNewName] = useState('');
  const [newBodyPart, setNewBodyPart] = useState<BodyPart>('Chest');
  const [newCategory, setNewCategory] = useState<ExerciseCategory>('Compound');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState('');

  const filtered = useMemo(() => {
    return exerciseCatalog.filter((ex) => {
      const matchesQuery = !query || ex.name.toLowerCase().includes(query.toLowerCase());
      const matchesBodyPart = bodyPart === 'All' || ex.bodyPart === bodyPart;
      return matchesQuery && matchesBodyPart;
    });
  }, [exerciseCatalog, query, bodyPart]);

  const suggested = useMemo(() => {
    const recentExerciseMap = new Map<string, ExerciseDefinition>();
    [...workouts]
      .reverse()
      .flatMap((workout) => workout.exercises)
      .forEach((exercise) => {
        const key = exercise.name.toLowerCase();
        if (recentExerciseMap.has(key)) {
          return;
        }
        const fromCatalog = exerciseCatalog.find((entry) => entry.name.toLowerCase() === key);
        recentExerciseMap.set(
          key,
          fromCatalog ?? {
            id: `history-${key}`,
            name: exercise.name,
            bodyPart: exercise.bodyPart,
            category: exercise.category,
            primarySplits: [split],
            isCustom: true
          }
        );
      });

    const splitSuggestions = exerciseCatalog.filter((ex) => ex.primarySplits.includes(split) || split === 'Custom');
    return [...splitSuggestions, ...Array.from(recentExerciseMap.values())]
      .reduce<ExerciseDefinition[]>((acc, exercise) => {
        if (acc.some((item) => item.name.toLowerCase() === exercise.name.toLowerCase())) {
          return acc;
        }
        acc.push(exercise);
        return acc;
      }, [])
      .slice(0, 40);
  }, [exerciseCatalog, split, workouts]);

  const handleCreateExercise = async () => {
    if (!newName.trim()) return;
    try {
      const custom = await addCustomExercise({
        name: newName.trim(),
        bodyPart: newBodyPart,
        category: newCategory,
        primarySplits: [split]
      });
      setCreateError('');
      onSelect(custom);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create exercise.');
    }
  };

  const displayList = query || bodyPart !== 'All' ? filtered : suggested;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet exercise-picker-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Add Exercise</h3>
          <button type="button" className="icon-btn" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="field pl-9"
            placeholder="Search exercises..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            inputMode="search"
          />
        </div>

        {/* Muscle Group Filter */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {BODY_PARTS.map((bp) => (
            <button
              key={bp}
              type="button"
              className={`filter-chip flex-shrink-0 ${bodyPart === bp ? 'filter-chip-active' : ''}`}
              onClick={() => setBodyPart(bp)}
            >
              {bp}
            </button>
          ))}
        </div>

        {/* Section label */}
        <p className="muted mb-2 text-xs uppercase tracking-wider">
          {query || bodyPart !== 'All' ? `${filtered.length} results` : `Suggested for ${split}`}
        </p>

        {/* Exercise list */}
        <div className="exercise-list overflow-y-auto">
          {displayList.map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="exercise-pick-row w-full"
              onClick={() => onSelect(ex)}
            >
              <div className="text-left">
                <p className="font-semibold">{ex.name}</p>
                <p className="muted text-xs">{ex.bodyPart} • {ex.category}</p>
              </div>
              <Plus className="h-4 w-4 text-[var(--primary)]" />
            </button>
          ))}

          {displayList.length === 0 && (
            <div className="py-6 text-center">
              <p className="muted text-sm">No exercises found.</p>
              <button type="button" className="mt-2 text-sm text-[var(--primary)]" onClick={() => setShowCreateForm(true)}>
                Create "{query}"
              </button>
            </div>
          )}
        </div>

        {/* Create custom */}
        <div className="mt-3 border-t border-[var(--surface-2)] pt-3">
          {!showCreateForm ? (
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-[var(--primary)]"
              onClick={() => {
                setShowCreateForm(true);
                setNewName(query);
                setCreateError('');
              }}
            >
              <Plus className="h-4 w-4" />
              Create Custom Exercise
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Create Exercise</p>
              <input
                className="field"
                placeholder="Exercise name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <select className="field text-sm" value={newBodyPart} onChange={(e) => setNewBodyPart(e.target.value as BodyPart)}>
                  {(['Chest','Back','Legs','Shoulders','Arms','Core','Cardio'] as BodyPart[]).map((bp) => (
                    <option key={bp} value={bp}>{bp}</option>
                  ))}
                </select>
                <select className="field text-sm" value={newCategory} onChange={(e) => setNewCategory(e.target.value as ExerciseCategory)}>
                  <option value="Compound">Compound</option>
                  <option value="Isolation">Isolation</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-subtle flex-1 text-sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError('');
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn-primary flex-1 text-sm" onClick={() => void handleCreateExercise()} disabled={!newName.trim()}>
                  Add
                </button>
              </div>
              {createError && <p className="text-xs text-[var(--danger)]">{createError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
