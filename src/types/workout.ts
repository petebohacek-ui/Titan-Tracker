export type WorkoutSplit =
  | 'Push'
  | 'Pull'
  | 'Legs'
  | 'Upper'
  | 'Lower'
  | 'Full Body'
  | 'Cardio'
  | 'Custom';

export type BodyPart =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Cardio';

export type ExerciseCategory = 'Compound' | 'Isolation';

export interface SetEntry {
  id: string;
  reps: number;
  weight: number;
  rpe: number;
  restSeconds: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  category: ExerciseCategory;
  sets: SetEntry[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  split: WorkoutSplit;
  durationMinutes: number;
  totalVolume?: number;
  completed: boolean;
  notes?: string;
  exercises: WorkoutExercise[];
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseDefinition {
  id: string;
  name: string;
  bodyPart: BodyPart;
  category: ExerciseCategory;
  primarySplits: WorkoutSplit[];
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonalRecord {
  id: string;
  exerciseName: string;
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
}

export interface Goal {
  id: string;
  label: string;
  type:
    | 'Target Bench'
    | 'Target Squat'
    | 'Target Deadlift'
    | 'Target Bodyweight'
    | 'Weekly Workout Goal'
    | 'Monthly Volume Goal'
    | 'Personal Record Goal';
  target: number;
  progress: number;
  unit: string;
}

export interface ReminderSettings {
  workoutReminders: boolean;
  prCelebrations: boolean;
  streakReminders: boolean;
  recoverySuggestions: boolean;
  missedWorkoutNotifications: boolean;
  goalProgressUpdates: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  weightUnit: 'lbs' | 'kg';
  reminders: ReminderSettings;
  cloudSyncEnabled: boolean;
  useDemoData: boolean;
  notificationsEnabled: boolean;
  restTimerDefaultSeconds: number;
  bodyweightTrackingEnabled: boolean;
  appVersion: string;
  developerToolsEnabled: boolean;
}

export interface ActiveSet {
  id: string;
  weight: number;
  reps: number;
  rpe: number;
  restSeconds: number;
  completed: boolean;
  previousWeight?: number;
  previousReps?: number;
}

export interface ActiveExercise {
  id: string;
  name: string;
  bodyPart: BodyPart;
  category: ExerciseCategory;
  sets: ActiveSet[];
  notes?: string;
  lastPerformed?: string;
  pr?: { weight: number; reps: number; est1RM: number };
}

export interface ActiveWorkout {
  id: string;
  split: WorkoutSplit;
  name?: string;
  startTime: string;
  exercises: ActiveExercise[];
}

export interface WorkoutSummary {
  workout: WorkoutSession;
  durationMinutes: number;
  totalVolume: number;
  totalSets: number;
  newPRs: PersonalRecord[];
  volumeVsLast?: number;
}

export interface Insight {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
}
