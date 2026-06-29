import { useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import type { Goal } from '../types/workout';

const emptyGoal = (): Goal => ({
  id: crypto.randomUUID(),
  label: '',
  type: 'Weekly Workout Goal',
  target: 4,
  progress: 0,
  unit: 'sessions'
});

export const GoalsPage = () => {
  const goals = useAppStore((state) => state.goals);
  const upsertGoal = useAppStore((state) => state.upsertGoal);
  const removeGoal = useAppStore((state) => state.removeGoal);

  const [draft, setDraft] = useState<Goal>(emptyGoal());

  return (
    <div className="space-y-4">
      <SectionCard title="Goals" subtitle="Set targets and track progress">
        <div className="grid gap-2 md:grid-cols-5">
          <input className="field" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Goal label" />
          <select className="field" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Goal['type'] })}>
            <option>Target Bench</option>
            <option>Target Squat</option>
            <option>Target Deadlift</option>
            <option>Target Bodyweight</option>
            <option>Weekly Workout Goal</option>
            <option>Monthly Volume Goal</option>
            <option>Personal Record Goal</option>
          </select>
          <input className="field" type="number" min={0} value={draft.target} onChange={(event) => setDraft({ ...draft, target: Number(event.target.value) })} />
          <input className="field" type="number" min={0} value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })} />
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (!draft.label.trim() || draft.target <= 0) return;
              void upsertGoal({ ...draft, id: crypto.randomUUID() });
              setDraft(emptyGoal());
            }}
          >
            Add Goal
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Current Goals" subtitle="Live progress and quick updates">
        {goals.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No goals yet. Create your first goal.</p>
        ) : (
          <div className="space-y-2">
            {goals.map((goal) => {
              const pct = Math.max(0, Math.min(100, (goal.progress / Math.max(1, goal.target)) * 100));
              return (
                <div key={goal.id} className="card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{goal.label}</p>
                      <p className="muted text-xs">{goal.progress}/{goal.target} {goal.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="btn-subtle" onClick={() => void upsertGoal({ ...goal, progress: Math.max(0, goal.progress - 1) })}>-1</button>
                      <button type="button" className="btn-subtle" onClick={() => void upsertGoal({ ...goal, progress: goal.progress + 1 })}>+1</button>
                      <button type="button" className="btn-subtle text-[var(--danger)]" onClick={() => void removeGoal(goal.id)}>Delete</button>
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded bg-slate-400/20">
                    <div className="h-2 rounded bg-cyan-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
