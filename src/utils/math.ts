import { addDays, differenceInCalendarDays, formatISO, parseISO, startOfDay } from 'date-fns';
import type { SetEntry, WorkoutExercise, WorkoutSession } from '../types/workout';

export const round = (value: number, precision = 2): number => {
  const power = 10 ** precision;
  return Math.round(value * power) / power;
};

export const estimateOneRepMax = (weight: number, reps: number): number => {
  if (reps <= 1) {
    return round(weight, 1);
  }
  return round(weight * (1 + reps / 30), 1);
};

export const setVolume = (set: SetEntry): number => set.weight * set.reps;

export const exerciseVolume = (exercise: WorkoutExercise): number =>
  exercise.sets.reduce((sum, set) => sum + setVolume(set), 0);

export const workoutVolume = (workout: WorkoutSession): number =>
  workout.exercises.reduce((sum, exercise) => sum + exerciseVolume(exercise), 0);

export const workoutAverageIntensity = (workout: WorkoutSession): number => {
  const allSets = workout.exercises.flatMap((exercise) => exercise.sets);
  if (allSets.length === 0) {
    return 0;
  }
  const avgRpe = allSets.reduce((sum, set) => sum + set.rpe, 0) / allSets.length;
  return round((avgRpe / 10) * 100, 1);
};

export const movingAverage = (values: number[], window: number): number[] => {
  if (window <= 0) {
    return values;
  }
  return values.map((_, idx) => {
    const slice = values.slice(Math.max(0, idx - window + 1), idx + 1);
    return round(slice.reduce((sum, item) => sum + item, 0) / slice.length, 1);
  });
};

export const daysSince = (isoDate: string): number =>
  differenceInCalendarDays(startOfDay(new Date()), startOfDay(parseISO(isoDate)));

export const isoDaysRange = (startDate: string, days: number): string[] => {
  const base = parseISO(startDate);
  return Array.from({ length: days }, (_, i) => formatISO(addDays(base, i), { representation: 'date' }));
};
