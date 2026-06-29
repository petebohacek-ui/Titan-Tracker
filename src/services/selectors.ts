import { parseISO } from 'date-fns';
import { estimateOneRepMax } from '../utils/math';
import type { WorkoutSession } from '../types/workout';

export const getExerciseHistory = (workouts: WorkoutSession[], exerciseName: string) =>
  workouts
    .flatMap((workout) =>
      workout.exercises
        .filter((exercise) => exercise.name === exerciseName)
        .map((exercise) => {
          const volume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
          const heaviestSet = [...exercise.sets].sort((a, b) => b.weight - a.weight)[0];
          return {
            date: workout.date,
            sets: exercise.sets.length,
            reps: Math.round(exercise.sets.reduce((sum, set) => sum + set.reps, 0) / exercise.sets.length),
            weight: heaviestSet?.weight ?? 0,
            volume,
            estimated1RM: estimateOneRepMax(heaviestSet?.weight ?? 0, heaviestSet?.reps ?? 1)
          };
        })
    )
    .sort((a, b) => (parseISO(a.date) > parseISO(b.date) ? 1 : -1));

export const getExerciseNames = (workouts: WorkoutSession[]) =>
  Array.from(
    new Set(
      workouts.flatMap((workout) =>
        workout.exercises
          .map((exercise) => exercise.name)
          .filter((name) => name.trim().length > 0)
      )
    )
  ).sort((a, b) => a.localeCompare(b));

export const getExerciseSessions = (workouts: WorkoutSession[], exerciseName: string) =>
  workouts
    .filter((workout) => workout.exercises.some((exercise) => exercise.name === exerciseName))
    .sort((a, b) => (parseISO(a.date) > parseISO(b.date) ? 1 : -1));

export const getExerciseOverview = (workouts: WorkoutSession[], exerciseName: string) => {
  const history = getExerciseHistory(workouts, exerciseName);
  if (history.length === 0) {
    return null;
  }

  const totalSets = history.reduce((sum, item) => sum + item.sets, 0);
  const totalReps = history.reduce((sum, item) => sum + item.reps * item.sets, 0);
  const totalVolume = history.reduce((sum, item) => sum + item.volume, 0);
  const bestVolume = Math.max(...history.map((item) => item.volume));
  const bestSet = history.reduce((best, item) => (item.weight > best.weight ? item : best), history[0]);

  return {
    sessions: history.length,
    totalSets,
    totalReps,
    totalVolume,
    averageWeight: Math.round(history.reduce((sum, item) => sum + item.weight, 0) / history.length),
    estimated1RM: Math.max(...history.map((item) => item.estimated1RM)),
    bestVolume,
    bestSet,
    lastPerformed: history[history.length - 1]?.date
  };
};
