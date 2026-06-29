import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import { getExerciseHistory, getExerciseOverview, getExerciseSessions } from '../services/selectors';

export const ExerciseDetailPage = () => {
  const navigate = useNavigate();
  const { exerciseName = '' } = useParams();
  const decodedName = decodeURIComponent(exerciseName);

  const workouts = useAppStore((state) => state.workouts);
  const exerciseCatalog = useAppStore((state) => state.exerciseCatalog);

  const definition = useMemo(
    () => exerciseCatalog.find((exercise) => exercise.name.toLowerCase() === decodedName.toLowerCase()),
    [exerciseCatalog, decodedName]
  );

  const history = useMemo(() => getExerciseHistory(workouts, decodedName), [workouts, decodedName]);
  const sessions = useMemo(() => getExerciseSessions(workouts, decodedName), [workouts, decodedName]);
  const overview = useMemo(() => getExerciseOverview(workouts, decodedName), [workouts, decodedName]);

  return (
    <div className="space-y-4">
      <SectionCard title={decodedName || 'Exercise'} subtitle="Exercise details, history, and progression" action={<button type="button" className="btn-subtle" onClick={() => navigate('/library')}>Back to Library</button>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="card p-3"><p className="muted text-xs">Muscle Group</p><p className="font-semibold">{definition?.bodyPart ?? 'Unknown'}</p></div>
          <div className="card p-3"><p className="muted text-xs">Category</p><p className="font-semibold">{definition?.category ?? 'Unknown'}</p></div>
          <div className="card p-3"><p className="muted text-xs">Custom Exercise</p><p className="font-semibold">{definition?.isCustom ? 'Yes' : 'No'}</p></div>
          <div className="card p-3"><p className="muted text-xs">Templates Using It</p><p className="font-semibold">{sessions.length}</p></div>
        </div>
      </SectionCard>

      <SectionCard title="Graphs" subtitle="Weight, 1RM, and volume over time">
        {history.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No charts available until you log workouts.</p>
        ) : (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line dataKey="weight" stroke="#22d3ee" dot={false} />
                <Line dataKey="estimated1RM" stroke="#f59e0b" dot={false} />
                <Line dataKey="volume" stroke="#fb7185" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Personal Records" subtitle="Best sets and records">
        {!overview ? (
          <p className="muted py-8 text-center text-sm">No Personal Records yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="card p-3"><p className="muted text-xs">Best Set</p><p className="font-semibold">{overview.bestSet.weight}x{overview.bestSet.reps}</p></div>
            <div className="card p-3"><p className="muted text-xs">Best 1RM</p><p className="font-semibold">{overview.estimated1RM} lbs</p></div>
            <div className="card p-3"><p className="muted text-xs">Best Volume</p><p className="font-semibold">{overview.bestVolume.toLocaleString()} lbs</p></div>
            <div className="card p-3"><p className="muted text-xs">Last Performed</p><p className="font-semibold">{overview.lastPerformed}</p></div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Previous Sessions" subtitle="Recent workouts containing this exercise">
        {sessions.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No sessions recorded for this exercise.</p>
        ) : (
          <div className="space-y-2">
            {sessions.slice().reverse().slice(0, 12).map((session) => {
              const exercise = session.exercises.find((item) => item.name === decodedName);
              return (
                <article key={session.id} className="card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{session.date} • {session.split}</p>
                      <p className="muted text-xs">{exercise?.notes || session.notes || 'No notes'}</p>
                    </div>
                    <p className="text-sm font-semibold">{exercise?.sets.length ?? 0} sets</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
