import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  getYear,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns';
import { useAppStore } from '../hooks/useAppStore';
import { SectionCard } from '../components/SectionCard';
import { SPLITS } from '../utils/constants';
import { splitToSlug } from '../utils/split';
import { workoutVolume } from '../utils/math';
import type { WorkoutSession, WorkoutSplit } from '../types/workout';

type HistoryViewMode = 'month' | 'week' | 'year';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

const SPLIT_BADGE_STYLES: Record<WorkoutSplit, string> = {
  Push: 'bg-rose-400/20 text-rose-200',
  Pull: 'bg-sky-400/20 text-sky-200',
  Legs: 'bg-emerald-400/20 text-emerald-200',
  Upper: 'bg-violet-400/20 text-violet-200',
  Lower: 'bg-amber-400/20 text-amber-200',
  'Full Body': 'bg-cyan-400/20 text-cyan-200',
  Cardio: 'bg-orange-400/20 text-orange-200',
  Custom: 'bg-slate-400/20 text-slate-200'
};

const SPLIT_SHORT_LABELS: Record<WorkoutSplit, string> = {
  Push: 'PU',
  Pull: 'PL',
  Legs: 'LG',
  Upper: 'UP',
  Lower: 'LO',
  'Full Body': 'FB',
  Cardio: 'CA',
  Custom: 'CU'
};

export const HistoryPage = () => {
  const navigate = useNavigate();
  const workouts = useAppStore((state) => state.workouts);
  const [viewMode, setViewMode] = useState<HistoryViewMode>('month');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);

  const workoutsByDate = useMemo(() => {
    const grouped: Record<string, typeof workouts> = {};
    workouts.forEach((workout) => {
      if (!grouped[workout.date]) {
        grouped[workout.date] = [];
      }
      grouped[workout.date].push(workout);
    });
    Object.keys(grouped).forEach((key) => {
      grouped[key] = grouped[key]
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
    return grouped;
  }, [workouts]);

  const monthCountByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(workoutsByDate).forEach(([dateKey, entries]) => {
      const monthKey = format(parseISO(dateKey), 'yyyy-MM');
      counts[monthKey] = (counts[monthKey] ?? 0) + entries.length;
    });
    return counts;
  }, [workoutsByDate]);

  const monthCells = useMemo(() => {
    const start = startOfWeek(startOfMonth(focusDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(focusDate), { weekStartsOn: 1 });
    const cells: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      cells.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return cells;
  }, [focusDate]);

  const weekCells = useMemo(() => {
    const start = startOfWeek(focusDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [focusDate]);

  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(getYear(focusDate), index, 1)),
    [focusDate]
  );

  const selectedWorkouts = workoutsByDate[selectedDateKey] ?? [];
  const selectedDateLabel = format(parseISO(selectedDateKey), 'EEEE, MMMM d, yyyy');
  const selectedWorkout = useMemo(
    () => workouts.find((workout) => workout.id === selectedWorkoutId) ?? null,
    [workouts, selectedWorkoutId]
  );

  const periodLabel =
    viewMode === 'month'
      ? format(focusDate, 'MMMM yyyy')
      : viewMode === 'week'
        ? `${format(startOfWeek(focusDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(focusDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
        : format(focusDate, 'yyyy');

  const movePeriod = (direction: -1 | 1) => {
    if (viewMode === 'month') {
      setFocusDate((previous) => addMonths(previous, direction));
      return;
    }
    if (viewMode === 'week') {
      setFocusDate((previous) => addWeeks(previous, direction));
      return;
    }
    setFocusDate((previous) => addYears(previous, direction));
  };

  const selectDate = (date: Date) => {
    const key = toDateKey(date);
    setSelectedDateKey(key);
    setFocusDate(date);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tagName = active?.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || active?.isContentEditable) {
        return;
      }

      if (event.key === 'Escape') {
        setSelectedWorkoutId(null);
        return;
      }

      let nextDate: Date | null = null;

      if (viewMode === 'year') {
        if (event.key === 'ArrowLeft') nextDate = addMonths(focusDate, -1);
        if (event.key === 'ArrowRight') nextDate = addMonths(focusDate, 1);
        if (event.key === 'ArrowUp') nextDate = addMonths(focusDate, -3);
        if (event.key === 'ArrowDown') nextDate = addMonths(focusDate, 3);
      } else {
        if (event.key === 'ArrowLeft') nextDate = addDays(focusDate, -1);
        if (event.key === 'ArrowRight') nextDate = addDays(focusDate, 1);
        if (event.key === 'ArrowUp') nextDate = addDays(focusDate, -7);
        if (event.key === 'ArrowDown') nextDate = addDays(focusDate, 7);
      }

      if (!nextDate) return;
      event.preventDefault();
      selectDate(nextDate);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusDate, viewMode]);

  const renderSplitBadges = (sessions: WorkoutSession[]) => {
    const uniqueSplits = Array.from(new Set(sessions.map((session) => session.split))) as WorkoutSplit[];
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {uniqueSplits.slice(0, 3).map((split) => (
          <span key={split} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SPLIT_BADGE_STYLES[split]}`}>
            {SPLIT_SHORT_LABELS[split]}
          </span>
        ))}
        {uniqueSplits.length > 3 && <span className="muted text-[10px]">+{uniqueSplits.length - 3}</span>}
      </div>
    );
  };

  const renderDayCell = (date: Date, inCurrentMonth: boolean) => {
    const dateKey = toDateKey(date);
    const sessions = workoutsByDate[dateKey] ?? [];
    const count = sessions.length;
    const isSelected = dateKey === selectedDateKey;

    return (
      <button
        key={dateKey}
        type="button"
        className={`card min-h-[92px] p-2 text-left transition ${isSelected ? 'ring-2 ring-sky-300' : ''} ${inCurrentMonth ? '' : 'opacity-55'}`}
        onClick={() => selectDate(date)}
      >
        <p className="text-xs font-semibold">{format(date, 'd')}</p>
        <p className="muted mt-2 text-xs">{count > 0 ? `${count} workout${count === 1 ? '' : 's'}` : 'No workouts'}</p>
        {count > 0 && renderSplitBadges(sessions)}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <SectionCard title="History" subtitle="Browse completed workouts by split">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {SPLITS.map((split) => (
            <NavLink key={split} to={`/history/${splitToSlug(split)}`} className="btn-subtle text-center text-sm">
              {split}
            </NavLink>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="History Calendar"
        subtitle="Switch views, click dates, and use arrow keys to move quickly across the calendar."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn-subtle text-xs" onClick={() => movePeriod(-1)}>
              Prev
            </button>
            <button type="button" className="btn-subtle text-xs" onClick={() => setFocusDate(new Date())}>
              Today
            </button>
            <button type="button" className="btn-subtle text-xs" onClick={() => movePeriod(1)}>
              Next
            </button>
          </div>
        }
      >
        {workouts.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No workouts yet. Start your first Push workout.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{periodLabel}</p>
              <div className="flex gap-2">
                <button type="button" className={`btn-subtle text-xs ${viewMode === 'month' ? 'ring-2 ring-sky-300' : ''}`} onClick={() => setViewMode('month')}>
                  Month
                </button>
                <button type="button" className={`btn-subtle text-xs ${viewMode === 'week' ? 'ring-2 ring-sky-300' : ''}`} onClick={() => setViewMode('week')}>
                  Week
                </button>
                <button type="button" className={`btn-subtle text-xs ${viewMode === 'year' ? 'ring-2 ring-sky-300' : ''}`} onClick={() => setViewMode('year')}>
                  Year
                </button>
              </div>
            </div>

            {viewMode !== 'year' && (
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                {WEEKDAY_LABELS.map((label) => (
                  <p key={label}>{label}</p>
                ))}
              </div>
            )}

            {viewMode === 'month' && (
              <div className="grid grid-cols-7 gap-2">
                {monthCells.map((date) => renderDayCell(date, isSameMonth(date, focusDate)))}
              </div>
            )}

            {viewMode === 'week' && (
              <div className="grid grid-cols-7 gap-2">
                {weekCells.map((date) => renderDayCell(date, true))}
              </div>
            )}

            {viewMode === 'year' && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {yearMonths.map((monthDate) => {
                  const monthKey = format(monthDate, 'yyyy-MM');
                  const count = monthCountByKey[monthKey] ?? 0;
                  return (
                    <button
                      key={monthKey}
                      type="button"
                      className={`card p-3 text-left ${isSameMonth(monthDate, focusDate) ? 'ring-2 ring-sky-300' : ''}`}
                      onClick={() => {
                        setFocusDate(monthDate);
                        setViewMode('month');
                      }}
                    >
                      <p className="font-semibold">{format(monthDate, 'MMMM')}</p>
                      <p className="muted text-xs">{count} workout{count === 1 ? '' : 's'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title={selectedDateLabel} subtitle="Workouts completed on the selected date">
        {selectedWorkouts.length === 0 ? (
          <p className="muted py-8 text-center text-sm">No workouts logged for this date.</p>
        ) : (
          <div className="space-y-2">
            {selectedWorkouts.map((workout) => (
              <button
                key={workout.id}
                type="button"
                className="card block w-full p-3 text-left"
                onClick={() => setSelectedWorkoutId(workout.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{workout.split}</p>
                    <p className="muted text-xs">{workout.durationMinutes} min • {workout.exercises.length} exercises</p>
                    {workout.notes && <p className="muted mt-1 text-xs">{workout.notes}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{workoutVolume(workout).toLocaleString()} lbs</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {selectedWorkout && (
        <div className="modal-overlay" onClick={() => setSelectedWorkoutId(null)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">{selectedWorkout.split} Workout Session</h3>
            <p className="muted mb-3 text-sm">{format(parseISO(selectedWorkout.date), 'EEEE, MMMM d, yyyy')}</p>

            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <div className="card p-2">
                <p className="muted text-xs">Duration</p>
                <p className="font-semibold">{selectedWorkout.durationMinutes} min</p>
              </div>
              <div className="card p-2">
                <p className="muted text-xs">Exercises</p>
                <p className="font-semibold">{selectedWorkout.exercises.length}</p>
              </div>
              <div className="card p-2">
                <p className="muted text-xs">Total Volume</p>
                <p className="font-semibold">{workoutVolume(selectedWorkout).toLocaleString()} lbs</p>
              </div>
              <div className="card p-2">
                <p className="muted text-xs">Status</p>
                <p className="font-semibold">{selectedWorkout.completed ? 'Completed' : 'In Progress'}</p>
              </div>
            </div>

            {selectedWorkout.notes && (
              <div className="card mb-3 p-2">
                <p className="muted text-xs">Session Notes</p>
                <p className="text-sm">{selectedWorkout.notes}</p>
              </div>
            )}

            <div className="space-y-2">
              {selectedWorkout.exercises.map((exercise) => (
                <article key={exercise.id} className="card p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-semibold">{exercise.name}</p>
                    <p className="muted text-xs">{exercise.bodyPart} • {exercise.category}</p>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {exercise.sets.map((set, index) => (
                      <li key={set.id} className="muted text-xs">
                        Set {index + 1}: {set.weight} x {set.reps} • RPE {set.rpe} • Rest {set.restSeconds}s
                      </li>
                    ))}
                  </ul>
                  {exercise.notes && <p className="muted mt-2 text-xs">{exercise.notes}</p>}
                </article>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-subtle flex-1" onClick={() => setSelectedWorkoutId(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  navigate(`/history/${splitToSlug(selectedWorkout.split)}`);
                  setSelectedWorkoutId(null);
                }}
              >
                Open Split History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
