import type { ExerciseDefinition } from '../types/workout';

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  {
    id: 'bench-press',
    name: 'Barbell Bench Press',
    bodyPart: 'Chest',
    category: 'Compound',
    primarySplits: ['Push', 'Upper', 'Full Body']
  },
  {
    id: 'incline-db-press',
    name: 'Incline Dumbbell Press',
    bodyPart: 'Chest',
    category: 'Compound',
    primarySplits: ['Push', 'Upper']
  },
  {
    id: 'deadlift',
    name: 'Conventional Deadlift',
    bodyPart: 'Back',
    category: 'Compound',
    primarySplits: ['Pull', 'Lower', 'Full Body']
  },
  {
    id: 'squat',
    name: 'Barbell Back Squat',
    bodyPart: 'Legs',
    category: 'Compound',
    primarySplits: ['Legs', 'Lower', 'Full Body']
  },
  {
    id: 'ohp',
    name: 'Standing Overhead Press',
    bodyPart: 'Shoulders',
    category: 'Compound',
    primarySplits: ['Push', 'Upper']
  },
  {
    id: 'barbell-row',
    name: 'Barbell Row',
    bodyPart: 'Back',
    category: 'Compound',
    primarySplits: ['Pull', 'Upper', 'Full Body']
  },
  {
    id: 'pull-up',
    name: 'Pull-Up',
    bodyPart: 'Back',
    category: 'Compound',
    primarySplits: ['Pull', 'Upper']
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    bodyPart: 'Legs',
    category: 'Compound',
    primarySplits: ['Legs', 'Lower']
  },
  {
    id: 'rdl',
    name: 'Romanian Deadlift',
    bodyPart: 'Legs',
    category: 'Compound',
    primarySplits: ['Legs', 'Lower']
  },
  {
    id: 'lateral-raise',
    name: 'Lateral Raise',
    bodyPart: 'Shoulders',
    category: 'Isolation',
    primarySplits: ['Push', 'Upper']
  },
  {
    id: 'tricep-pushdown',
    name: 'Cable Tricep Pushdown',
    bodyPart: 'Arms',
    category: 'Isolation',
    primarySplits: ['Push', 'Upper']
  },
  {
    id: 'bicep-curl',
    name: 'Dumbbell Curl',
    bodyPart: 'Arms',
    category: 'Isolation',
    primarySplits: ['Pull', 'Upper']
  },
  {
    id: 'hanging-leg-raise',
    name: 'Hanging Leg Raise',
    bodyPart: 'Core',
    category: 'Isolation',
    primarySplits: ['Lower', 'Full Body']
  },
  {
    id: 'rowing-machine',
    name: 'Rowing Ergometer',
    bodyPart: 'Cardio',
    category: 'Compound',
    primarySplits: ['Cardio']
  }
];
