import { addDays, formatISO, subDays } from 'date-fns';
import { EXERCISE_LIBRARY } from './exerciseLibrary';
import type { BodyPart, ExerciseCategory, Goal, SetEntry, WorkoutSession, WorkoutSplit } from '../types/workout';
import { DEFAULT_GOALS } from '../utils/constants';

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const rng = mulberry32(424242);

const choose = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];

const splitBlueprint: Record<WorkoutSplit, string[]> = {
  Push: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Standing Overhead Press', 'Lateral Raise', 'Cable Tricep Pushdown'],
  Pull: ['Conventional Deadlift', 'Barbell Row', 'Pull-Up', 'Dumbbell Curl'],
  Legs: ['Barbell Back Squat', 'Leg Press', 'Romanian Deadlift', 'Hanging Leg Raise'],
  Upper: ['Barbell Bench Press', 'Barbell Row', 'Standing Overhead Press', 'Pull-Up'],
  Lower: ['Barbell Back Squat', 'Romanian Deadlift', 'Leg Press', 'Hanging Leg Raise'],
  'Full Body': ['Barbell Back Squat', 'Barbell Bench Press', 'Barbell Row', 'Hanging Leg Raise'],
  Cardio: ['Rowing Ergometer'],
  Custom: []
};

const baseWeights: Record<string, number> = {
  'Barbell Bench Press': 165,
  'Incline Dumbbell Press': 60,
  'Standing Overhead Press': 95,
  'Cable Tricep Pushdown': 70,
  'Lateral Raise': 25,
  'Conventional Deadlift': 285,
  'Barbell Row': 155,
  'Pull-Up': 0,
  'Dumbbell Curl': 35,
  'Barbell Back Squat': 235,
  'Leg Press': 360,
  'Romanian Deadlift': 205,
  'Hanging Leg Raise': 0,
  'Rowing Ergometer': 1
};

const bodyPartByName: Record<string, BodyPart> = Object.fromEntries(
  EXERCISE_LIBRARY.map((exercise) => [exercise.name, exercise.bodyPart])
);

const categoryByName: Record<string, ExerciseCategory> = Object.fromEntries(
  EXERCISE_LIBRARY.map((exercise) => [exercise.name, exercise.category])
);

const buildSets = (exerciseName: string, workoutIndex: number): SetEntry[] => {
  const setCount = exerciseName === 'Rowing Ergometer' ? 1 : 3 + (rng() > 0.7 ? 1 : 0);
  const progressionFactor = 1 + workoutIndex * 0.0025;

  return Array.from({ length: setCount }, (_, idx) => {
    const deloadWave = Math.sin(workoutIndex / 9) < -0.8 ? 0.92 : 1;
    const fatigueDrop = idx * 0.015;
    const noise = 0.92 + rng() * 0.18;
    const rawWeight = baseWeights[exerciseName] * progressionFactor * deloadWave * (1 - fatigueDrop) * noise;
    const weight = exerciseName.includes('Pull-Up') || exerciseName.includes('Leg Raise') ? 0 : Math.max(5, Math.round(rawWeight / 5) * 5);
    const repsBase = exerciseName === 'Rowing Ergometer' ? 12 : 6 + Math.floor(rng() * 6);

    return {
      id: crypto.randomUUID(),
      reps: repsBase,
      weight,
      rpe: Number((7.2 + rng() * 2.1).toFixed(1)),
      restSeconds: exerciseName === 'Rowing Ergometer' ? 90 : 120 + Math.floor(rng() * 120)
    };
  });
};

export const generateDemoWorkouts = (): WorkoutSession[] => {
  const workouts: WorkoutSession[] = [];
  const totalSessions = 84;
  const start = subDays(new Date(), 220);
  let current = start;

  for (let i = 0; i < totalSessions; i += 1) {
    const shouldSkip = rng() > 0.86;
    current = addDays(current, shouldSkip ? 3 : 2);
    const split = choose(['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body'] as WorkoutSplit[]);
    const exerciseNames = splitBlueprint[split];
    const selected = exerciseNames.slice(0, Math.max(3, Math.min(5, exerciseNames.length - (rng() > 0.7 ? 1 : 0))));

    const exercises = selected.map((name) => ({
      id: crypto.randomUUID(),
      name,
      bodyPart: bodyPartByName[name],
      category: categoryByName[name],
      sets: buildSets(name, i),
      notes: rng() > 0.86 ? 'Tempo-focused set quality session.' : undefined
    }));

    const workoutDate = formatISO(current, { representation: 'date' });

    workouts.push({
      id: crypto.randomUUID(),
      date: workoutDate,
      split,
      durationMinutes: 48 + Math.floor(rng() * 38),
      completed: true,
      notes: rng() > 0.92 ? 'Recovery-focused day, reduced volume.' : undefined,
      exercises,
      createdAt: formatISO(current),
      updatedAt: formatISO(current)
    });
  }

  return workouts;
};

export const DEMO_GOALS: Goal[] = DEFAULT_GOALS.map((goal) => ({ ...goal }));
