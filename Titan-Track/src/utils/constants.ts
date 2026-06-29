import type { AppSettings, Goal, ReminderSettings, WorkoutSplit } from '../types/workout';

export const SPLITS: WorkoutSplit[] = [
  'Push',
  'Pull',
  'Legs',
  'Upper',
  'Lower',
  'Full Body',
  'Cardio',
  'Custom'
];

export const PRIMARY_LIFTS = [
  'Barbell Bench Press',
  'Barbell Back Squat',
  'Conventional Deadlift',
  'Standing Overhead Press',
  'Barbell Row',
  'Pull-Up'
];

export const DEFAULT_REMINDERS: ReminderSettings = {
  workoutReminders: true,
  prCelebrations: true,
  streakReminders: true,
  recoverySuggestions: true,
  missedWorkoutNotifications: true,
  goalProgressUpdates: true
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  weightUnit: 'lbs',
  reminders: DEFAULT_REMINDERS,
  cloudSyncEnabled: false,
  useDemoData: true,
  notificationsEnabled: true,
  restTimerDefaultSeconds: 120,
  bodyweightTrackingEnabled: false,
  appVersion: '1.0.0',
  developerToolsEnabled: false
};

export const DEFAULT_GOALS: Goal[] = [
  {
    id: 'goal-bench',
    label: 'Bench 225 lbs',
    type: 'Target Bench',
    target: 225,
    progress: 185,
    unit: 'lbs'
  },
  {
    id: 'goal-squat',
    label: 'Squat 315 lbs',
    type: 'Target Squat',
    target: 315,
    progress: 255,
    unit: 'lbs'
  },
  {
    id: 'goal-weekly',
    label: 'Weekly Workout Goal',
    type: 'Weekly Workout Goal',
    target: 4,
    progress: 3,
    unit: 'sessions'
  }
];
