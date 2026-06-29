import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import { workoutVolume } from '../utils/math';

export const TemplatesPage = () => {
  const navigate = useNavigate();
  const workouts = useAppStore((state) => state.workouts);
  const startWorkout = useAppStore((state) => state.startWorkout);

  const templates = useMemo(() => {
    const seen = new Set<string>();
    return [...workouts]
      .reverse()
      .filter((workout) => {
        const key = `${workout.split}-${workout.exercises.map((exercise) => exercise.name).join('|')}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }, [workouts]);

  return (
    <div className="space-y-4">
      <SectionCard title="Templates" subtitle="Reuse previous workouts as templates">
        {templates.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No templates yet. Complete a workout to create one automatically.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <article key={template.id} className="card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{template.split} Template</p>
                    <p className="muted text-xs">{template.exercises.length} exercises • Last used {template.date}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      startWorkout(template.split, `${template.split} Template`, template);
                      navigate('/workout/active');
                    }}
                  >
                    Start
                  </button>
                </div>
                <p className="muted mt-2 text-xs">{template.exercises.map((exercise) => exercise.name).join(' • ')}</p>
                <p className="mt-2 text-sm font-semibold">{workoutVolume(template).toLocaleString()} lbs</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
