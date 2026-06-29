import { create } from 'zustand';
import { db } from '../database/db';
import { generateDemoWorkouts, DEMO_GOALS } from '../data/demoData';
import { buildAnalytics, type AnalyticsData } from '../services/metrics';
import { enqueueSync, flushSyncQueue, getLastSyncTimestamp } from '../services/syncService';
import { pullCloudChanges, pushQueuedCloudChanges } from '../services/cloudSyncService';
import type { BodyweightEntry } from '../database/db';
import { getSupabaseClient } from '../lib/supabase';
import type {
  ActiveExercise,
  ActiveWorkout,
  AppSettings,
  ExerciseDefinition,
  Goal,
  PersonalRecord,
  WorkoutSession,
  WorkoutSplit,
  WorkoutSummary
} from '../types/workout';
import { estimateOneRepMax, workoutVolume } from '../utils/math';
import { DEFAULT_SETTINGS } from '../utils/constants';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

interface BackupPayload {
  workouts: WorkoutSession[];
  settings: AppSettings;
  goals: Goal[];
  customExercises: ExerciseDefinition[];
  bodyweightEntries: BodyweightEntry[];
  exportedAt: string;
  version: string;
}

interface AppStore {
  workouts: WorkoutSession[];
  goals: Goal[];
  bodyweightEntries: BodyweightEntry[];
  settings: AppSettings;
  customExercises: ExerciseDefinition[];
  exerciseCatalog: ExerciseDefinition[];
  analytics: AnalyticsData;
  initialized: boolean;
  isOnline: boolean;
  syncing: boolean;
  lastSync: string | null;
  error?: string;
  activeWorkout: ActiveWorkout | null;
  lastSummary: WorkoutSummary | null;
  initialize: () => Promise<void>;
  addWorkout: (workout: WorkoutSession) => Promise<void>;
  updateWorkout: (workout: WorkoutSession) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  upsertGoal: (goal: Goal) => Promise<void>;
  removeGoal: (goalId: string) => Promise<void>;
  addCustomExercise: (exercise: Omit<ExerciseDefinition, 'id' | 'isCustom' | 'createdAt' | 'updatedAt'> & { name: string }) => Promise<ExerciseDefinition>;
  updateCustomExercise: (exerciseId: string, updates: Partial<Pick<ExerciseDefinition, 'name' | 'bodyPart' | 'category' | 'primarySplits'>>) => Promise<void>;
  deleteCustomExercise: (exerciseId: string) => Promise<void>;
  refreshAnalytics: () => void;
  attemptSync: () => Promise<void>;
  setOnline: (isOnline: boolean) => void;
  triggerCloudBackup: () => Promise<void>;
  exportBackup: () => string;
  exportBackupCsv: () => string;
  importBackup: (json: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  addBodyweightEntry: (entry: Omit<BodyweightEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BodyweightEntry>;
  updateBodyweightEntry: (entry: BodyweightEntry) => Promise<void>;
  deleteBodyweightEntry: (entryId: string) => Promise<void>;
  startWorkout: (split: WorkoutSplit, name?: string, templateWorkout?: WorkoutSession) => void;
  updateActiveWorkout: (workout: ActiveWorkout) => void;
  finishActiveWorkout: (notes?: string) => Promise<boolean>;
  discardActiveWorkout: () => void;
  clearLastSummary: () => void;
}

const EMPTY_ANALYTICS = buildAnalytics([]);
const DEMO_ID_KEY = 'titan-track-demo-workout-ids';
const MAX_BACKUP_SNAPSHOTS = 20;

const recalculate = (workouts: WorkoutSession[]) => buildAnalytics(workouts);

const mergeExerciseCatalog = (customExercises: ExerciseDefinition[]) => {
  const byName = new Map<string, ExerciseDefinition>();
  EXERCISE_LIBRARY.forEach((exercise) => {
    byName.set(exercise.name.toLowerCase(), exercise);
  });
  customExercises.forEach((exercise) => {
    byName.set(exercise.name.toLowerCase(), exercise);
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const buildBackupPayload = (state: Pick<AppStore, 'workouts' | 'settings' | 'goals' | 'customExercises' | 'bodyweightEntries'>): BackupPayload => ({
  workouts: state.workouts,
  settings: state.settings,
  goals: state.goals,
  customExercises: state.customExercises,
  bodyweightEntries: state.bodyweightEntries,
  exportedAt: new Date().toISOString(),
  version: '1.1.0'
});

const persistActiveWorkoutSnapshot = async (activeWorkout: ActiveWorkout | null) => {
  if (!activeWorkout) {
    await db.activeWorkoutSnapshots.delete('current');
    return;
  }

  await db.activeWorkoutSnapshots.put({
    id: 'current',
    payload: JSON.stringify(activeWorkout),
    updatedAt: new Date().toISOString()
  });
};

const maybeCreateAutoBackup = async (state: Pick<AppStore, 'settings' | 'workouts' | 'goals' | 'customExercises' | 'bodyweightEntries'>, trigger: string) => {
  if (!state.settings.cloudSyncEnabled) {
    return;
  }

  const snapshot = {
    id: crypto.randomUUID(),
    trigger,
    payload: JSON.stringify(buildBackupPayload(state)),
    createdAt: new Date().toISOString()
  };

  await db.backupSnapshots.put(snapshot);
  await enqueueSync('BACKUP_SNAPSHOT', {
    id: snapshot.id,
    trigger: snapshot.trigger,
    createdAt: snapshot.createdAt
  });

  const staleSnapshots = await db.backupSnapshots.orderBy('createdAt').toArray();
  if (staleSnapshots.length > MAX_BACKUP_SNAPSHOTS) {
    const staleIds = staleSnapshots.slice(0, staleSnapshots.length - MAX_BACKUP_SNAPSHOTS).map((entry) => entry.id);
    await db.backupSnapshots.bulkDelete(staleIds);
  }
};

const hydrateStateFromDb = async () => {
  const workouts = (await db.workouts.toArray()).sort((a, b) => (a.date > b.date ? 1 : -1));
  const settingsRecord = await db.appSettings.get('app');
  const goals = await db.goals.toArray();
  const customExercises = (await db.customExercises.toArray())
    .map((exercise) => ({ ...exercise, isCustom: true }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const bodyweightEntries = (await db.bodyweightEntries.toArray()).sort((a, b) => (a.date > b.date ? 1 : -1));

  return {
    workouts,
    settings: normalizeSettings(settingsRecord?.value),
    goals,
    customExercises,
    exerciseCatalog: mergeExerciseCatalog(customExercises),
    bodyweightEntries,
    analytics: recalculate(workouts)
  };
};

const normalizeSettings = (incoming: AppSettings | undefined): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...incoming,
  reminders: {
    ...DEFAULT_SETTINGS.reminders,
    ...(incoming?.reminders ?? {})
  }
});

const sanitizeWorkout = (workout: WorkoutSession, usedIds: Set<string>): WorkoutSession => {
  const workoutId = !workout.id || usedIds.has(workout.id) ? crypto.randomUUID() : workout.id;
  usedIds.add(workoutId);
  const createdAt = workout.createdAt || new Date().toISOString();
  const updatedAt = workout.updatedAt || createdAt;

  return {
    ...workout,
    id: workoutId,
    date: workout.date || createdAt.slice(0, 10),
    completed: true,
    totalVolume: workout.totalVolume,
    createdAt,
    updatedAt,
    exercises: workout.exercises
      .map((exercise) => ({
        ...exercise,
        id: exercise.id || crypto.randomUUID(),
        sets: exercise.sets
          .filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.reps > 0 && set.weight >= 0)
          .map((set) => ({
            ...set,
            id: set.id || crypto.randomUUID(),
            rpe: Number.isFinite(set.rpe) ? set.rpe : 8,
            restSeconds: Number.isFinite(set.restSeconds) ? set.restSeconds : 120
          }))
      }))
      .filter((exercise) => exercise.name.trim().length > 0 && exercise.sets.length > 0)
  };
};

const computeNewPRs = (session: WorkoutSession, existingPRs: PersonalRecord[]): PersonalRecord[] => {
  const existingPRMap = new Map(existingPRs.map((pr) => [pr.exerciseName, pr.estimated1RM]));

  const results = session.exercises.flatMap((exercise) =>
    exercise.sets
      .map((set) => {
        const est1RM = estimateOneRepMax(set.weight, set.reps);
        const prevBest = existingPRMap.get(exercise.name) ?? 0;
        if (est1RM > prevBest) {
          existingPRMap.set(exercise.name, est1RM);
          return {
            id: crypto.randomUUID(),
            exerciseName: exercise.name,
            date: session.date,
            weight: set.weight,
            reps: set.reps,
            estimated1RM: est1RM
          };
        }
        return null;
      })
      .filter((entry) => entry !== null)
  );

  return results as PersonalRecord[];
};

export const useAppStore = create<AppStore>((set, get) => ({
  workouts: [],
  goals: [],
  bodyweightEntries: [],
  settings: normalizeSettings(DEFAULT_SETTINGS),
  customExercises: [],
  exerciseCatalog: mergeExerciseCatalog([]),
  analytics: EMPTY_ANALYTICS,
  initialized: false,
  isOnline: navigator.onLine,
  syncing: false,
  lastSync: getLastSyncTimestamp(),
  activeWorkout: null,
  lastSummary: null,

  initialize: async () => {
    try {
      const existingWorkouts = await db.workouts.toArray();
      const appSettingsRecord = await db.appSettings.get('app');
      const legacySettings = (await db.settings.toArray())[0];
      const settings = normalizeSettings(appSettingsRecord?.value ?? legacySettings);
      const goals = await db.goals.toArray();
      const bodyweightEntries = (await db.bodyweightEntries.toArray()).sort((a, b) => (a.date > b.date ? 1 : -1));
      const activeSnapshot = await db.activeWorkoutSnapshots.get('current');
      const activeWorkout = (() => {
        if (!activeSnapshot) {
          return null;
        }
        try {
          return JSON.parse(activeSnapshot.payload) as ActiveWorkout;
        } catch {
          return null;
        }
      })();
      const customExercises = (await db.customExercises.toArray())
        .map((exercise) => ({ ...exercise, isCustom: true }))
        .sort((a, b) => a.name.localeCompare(b.name));

      await db.appSettings.put({ id: 'app', value: settings, updatedAt: new Date().toISOString() });

      if (existingWorkouts.length === 0 && settings.useDemoData) {
        const demoWorkouts = generateDemoWorkouts();
        await db.workouts.bulkPut(demoWorkouts);
        await db.goals.bulkPut(DEMO_GOALS);
        localStorage.setItem(DEMO_ID_KEY, JSON.stringify(demoWorkouts.map((workout) => workout.id)));

        set({
          workouts: demoWorkouts,
          settings,
          goals: DEMO_GOALS,
          bodyweightEntries,
          activeWorkout,
          customExercises,
          exerciseCatalog: mergeExerciseCatalog(customExercises),
          analytics: recalculate(demoWorkouts),
          initialized: true
        });
        return;
      }

      const sorted = existingWorkouts.sort((a, b) => (a.date > b.date ? 1 : -1));
      set({
        workouts: sorted,
        settings,
        goals: goals.length ? goals : settings.useDemoData ? DEMO_GOALS : [],
        bodyweightEntries,
        activeWorkout,
        customExercises,
        exerciseCatalog: mergeExerciseCatalog(customExercises),
        analytics: recalculate(sorted),
        initialized: true
      });
    } catch (error) {
      set({
        error: error instanceof Error ? `Initialization failed: ${error.message}` : 'Initialization failed',
        initialized: true
      });
    }
  },

  addWorkout: async (workout) => {
    try {
      const payload = { ...workout, updatedAt: new Date().toISOString() };
      await db.workouts.put(payload);
      await enqueueSync('CREATE_WORKOUT', payload);

      const workouts = [...get().workouts, payload].sort((a, b) => (a.date > b.date ? 1 : -1));
      set({ workouts, analytics: recalculate(workouts), error: undefined });
      await maybeCreateAutoBackup(get(), 'CREATE_WORKOUT');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save workout.' });
      throw error;
    }
  },

  updateWorkout: async (workout) => {
    try {
      const payload = { ...workout, updatedAt: new Date().toISOString() };
      await db.workouts.put(payload);
      await enqueueSync('UPDATE_WORKOUT', payload);

      const workouts = get().workouts.map((item) => (item.id === workout.id ? payload : item));
      set({ workouts, analytics: recalculate(workouts), error: undefined });
      await maybeCreateAutoBackup(get(), 'UPDATE_WORKOUT');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update workout.' });
      throw error;
    }
  },

  deleteWorkout: async (workoutId) => {
    try {
      await db.workouts.delete(workoutId);
      await enqueueSync('DELETE_WORKOUT', { id: workoutId });
      const workouts = get().workouts.filter((w) => w.id !== workoutId);
      set({ workouts, analytics: recalculate(workouts), error: undefined });
      await maybeCreateAutoBackup(get(), 'DELETE_WORKOUT');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete workout.' });
      throw error;
    }
  },

  updateSettings: async (settings) => {
    try {
      const normalized = normalizeSettings(settings);
      await db.appSettings.put({ id: 'app', value: normalized, updatedAt: new Date().toISOString() });
      await enqueueSync('UPDATE_SETTINGS', normalized);
      set({ settings: normalized, error: undefined });
      await maybeCreateAutoBackup(get(), 'UPDATE_SETTINGS');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update settings.' });
      throw error;
    }
  },

  upsertGoal: async (goal) => {
    try {
      await db.goals.put(goal);
      await enqueueSync('UPSERT_GOAL', goal);

      const goals = get().goals.some((item) => item.id === goal.id)
        ? get().goals.map((item) => (item.id === goal.id ? goal : item))
        : [...get().goals, goal];

      set({ goals, error: undefined });
      await maybeCreateAutoBackup(get(), 'UPSERT_GOAL');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save goal.' });
      throw error;
    }
  },

  removeGoal: async (goalId) => {
    try {
      await db.goals.delete(goalId);
      await enqueueSync('DELETE_GOAL', { id: goalId });
      set({ goals: get().goals.filter((goal) => goal.id !== goalId), error: undefined });
      await maybeCreateAutoBackup(get(), 'DELETE_GOAL');
      if (get().isOnline) {
        void get().attemptSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete goal.' });
      throw error;
    }
  },

  addCustomExercise: async (exercise) => {
    const nowIso = new Date().toISOString();
    const trimmedName = exercise.name.trim();
    if (!trimmedName) {
      throw new Error('Exercise name is required.');
    }

    const existing = get().exerciseCatalog.find((item) => item.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      throw new Error('An exercise with this name already exists.');
    }

    const created: ExerciseDefinition = {
      id: crypto.randomUUID(),
      name: trimmedName,
      bodyPart: exercise.bodyPart,
      category: exercise.category,
      primarySplits: exercise.primarySplits,
      isCustom: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.customExercises.put(created);
    await enqueueSync('UPSERT_CUSTOM_EXERCISE', created);

    const customExercises = [...get().customExercises, created].sort((a, b) => a.name.localeCompare(b.name));
    set({ customExercises, exerciseCatalog: mergeExerciseCatalog(customExercises), error: undefined });
    await maybeCreateAutoBackup(get(), 'UPSERT_CUSTOM_EXERCISE');
    if (get().isOnline) {
      void get().attemptSync();
    }
    return created;
  },

  updateCustomExercise: async (exerciseId, updates) => {
    const current = get().customExercises.find((exercise) => exercise.id === exerciseId);
    if (!current) {
      throw new Error('Exercise not found.');
    }

    const nextName = updates.name?.trim() ?? current.name;
    if (!nextName) {
      throw new Error('Exercise name is required.');
    }

    const nameConflict = get()
      .exerciseCatalog
      .find((exercise) => exercise.id !== exerciseId && exercise.name.toLowerCase() === nextName.toLowerCase());
    if (nameConflict) {
      throw new Error('Another exercise already uses that name.');
    }

    const updated: ExerciseDefinition = {
      ...current,
      ...updates,
      name: nextName,
      updatedAt: new Date().toISOString(),
      isCustom: true
    };

    await db.customExercises.put(updated);
    await enqueueSync('UPSERT_CUSTOM_EXERCISE', updated);

    const customExercises = get().customExercises
      .map((exercise) => (exercise.id === exerciseId ? updated : exercise))
      .sort((a, b) => a.name.localeCompare(b.name));
    set({ customExercises, exerciseCatalog: mergeExerciseCatalog(customExercises), error: undefined });
    await maybeCreateAutoBackup(get(), 'UPSERT_CUSTOM_EXERCISE');
    if (get().isOnline) {
      void get().attemptSync();
    }
  },

  deleteCustomExercise: async (exerciseId) => {
    await db.customExercises.delete(exerciseId);
    await enqueueSync('DELETE_CUSTOM_EXERCISE', { id: exerciseId });
    const customExercises = get().customExercises.filter((exercise) => exercise.id !== exerciseId);
    set({ customExercises, exerciseCatalog: mergeExerciseCatalog(customExercises), error: undefined });
    await maybeCreateAutoBackup(get(), 'DELETE_CUSTOM_EXERCISE');
    if (get().isOnline) {
      void get().attemptSync();
    }
  },

  refreshAnalytics: () => {
    set({ analytics: recalculate(get().workouts) });
  },

  attemptSync: async () => {
    if (!get().isOnline || get().syncing) {
      return;
    }
    set({ syncing: true, error: undefined });
    try {
      let synced = 0;
      const supabase = getSupabaseClient();
      const { data: userData } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

      if (userData.user) {
        synced += await pushQueuedCloudChanges(userData.user.id);
        await pullCloudChanges(userData.user.id);
      } else {
        synced += await flushSyncQueue();
      }

      const hydrated = await hydrateStateFromDb();
      set({
        ...hydrated,
        syncing: false,
        lastSync: synced > 0 || Boolean(userData.user) ? new Date().toISOString() : get().lastSync,
        error: undefined
      });
    } catch (error) {
      set({ syncing: false, error: error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed.' });
    }
  },

  setOnline: (isOnline) => set({ isOnline }),

  triggerCloudBackup: async () => {
    await maybeCreateAutoBackup(get(), 'MANUAL_BACKUP');
    if (get().isOnline) {
      void get().attemptSync();
    }
  },

  exportBackup: () => {
    const payload = buildBackupPayload(get());
    return JSON.stringify(payload, null, 2);
  },

  exportBackupCsv: () => {
    const header = [
      'date',
      'workout_id',
      'split',
      'duration_minutes',
      'exercise_name',
      'body_part',
      'category',
      'set_index',
      'weight',
      'reps',
      'rpe',
      'rest_seconds',
      'exercise_notes',
      'session_notes',
      'session_volume'
    ];

    const escape = (value: string | number | undefined) => {
      const raw = String(value ?? '');
      return `"${raw.split('"').join('""')}"`;
    };

    const rows = get().workouts.flatMap((workout) =>
      workout.exercises.flatMap((exercise) =>
        exercise.sets.map((set, setIndex) =>
          [
            workout.date,
            workout.id,
            workout.split,
            workout.durationMinutes,
            exercise.name,
            exercise.bodyPart,
            exercise.category,
            setIndex + 1,
            set.weight,
            set.reps,
            set.rpe,
            set.restSeconds,
            exercise.notes,
            workout.notes,
            workoutVolume(workout)
          ].map(escape).join(',')
        )
      )
    );

    return [header.join(','), ...rows].join('\n');
  },

  importBackup: async (json) => {
    const payload = JSON.parse(json) as Partial<BackupPayload>;
    if (!payload.workouts || !payload.settings || !payload.goals) {
      throw new Error('Invalid backup format');
    }

    const usedWorkoutIds = new Set<string>();
    const workouts = payload.workouts.map((workout) => sanitizeWorkout(workout, usedWorkoutIds));
    const settings = normalizeSettings(payload.settings);
    const goals = payload.goals;
    const customExercises = (payload.customExercises ?? [])
      .filter((exercise) => exercise.name.trim().length > 0)
      .map((exercise) => ({
        ...exercise,
        id: exercise.id || crypto.randomUUID(),
        isCustom: true,
        createdAt: exercise.createdAt || new Date().toISOString(),
        updatedAt: exercise.updatedAt || new Date().toISOString()
      }));
    const bodyweightEntries = (payload.bodyweightEntries ?? [])
      .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0 && entry.date)
      .map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        date: entry.date,
        weight: entry.weight,
        note: entry.note,
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: entry.updatedAt || new Date().toISOString()
      }));

    await db.transaction('rw', [db.workouts, db.appSettings, db.goals, db.customExercises, db.bodyweightEntries, db.activeWorkoutSnapshots], async () => {
      await db.workouts.clear();
      await db.appSettings.clear();
      await db.goals.clear();
      await db.customExercises.clear();
      await db.bodyweightEntries.clear();
      await db.activeWorkoutSnapshots.clear();
      await db.workouts.bulkPut(workouts);
      await db.appSettings.put({ id: 'app', value: settings, updatedAt: new Date().toISOString() });
      await db.goals.bulkPut(goals);
      if (customExercises.length > 0) {
        await db.customExercises.bulkPut(customExercises);
      }
      if (bodyweightEntries.length > 0) {
        await db.bodyweightEntries.bulkPut(bodyweightEntries);
      }
    });

    set({
      workouts,
      settings,
      goals,
      bodyweightEntries,
      customExercises,
      exerciseCatalog: mergeExerciseCatalog(customExercises),
      analytics: recalculate(workouts),
      activeWorkout: null,
      error: undefined
    });
    await maybeCreateAutoBackup(get(), 'IMPORT_BACKUP');
  },

  clearAllData: async () => {
    await db.transaction('rw', [db.workouts, db.goals, db.customExercises, db.bodyweightEntries, db.activeWorkoutSnapshots, db.backupSnapshots], async () => {
      await db.workouts.clear();
      await db.goals.clear();
      await db.customExercises.clear();
      await db.bodyweightEntries.clear();
      await db.activeWorkoutSnapshots.clear();
      await db.backupSnapshots.clear();
    });
    set({
      workouts: [],
      goals: [],
      bodyweightEntries: [],
      customExercises: [],
      exerciseCatalog: mergeExerciseCatalog([]),
      analytics: recalculate([]),
      activeWorkout: null,
      error: undefined
    });
    localStorage.removeItem(DEMO_ID_KEY);
  },

  clearDemoData: async () => {
    const demoIds = (() => {
      try {
        const raw = localStorage.getItem(DEMO_ID_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        return [];
      }
    })();

    if (demoIds.length > 0) {
      await db.workouts.bulkDelete(demoIds);
      const workouts = get().workouts.filter((workout) => !demoIds.includes(workout.id));
      set({ workouts, analytics: recalculate(workouts), error: undefined });
      return;
    }

    await db.transaction('rw', [db.workouts, db.goals], async () => {
      await db.workouts.clear();
      await db.goals.clear();
    });
    set({ workouts: [], goals: [], analytics: recalculate([]), error: undefined });
  },

  addBodyweightEntry: async (entry) => {
    const nowIso = new Date().toISOString();
    const created: BodyweightEntry = {
      id: crypto.randomUUID(),
      date: entry.date,
      weight: entry.weight,
      note: entry.note,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.bodyweightEntries.put(created);
    await enqueueSync('UPSERT_BODYWEIGHT', created);
    const bodyweightEntries = [...get().bodyweightEntries, created].sort((a, b) => (a.date > b.date ? 1 : -1));
    set({ bodyweightEntries, error: undefined });
    await maybeCreateAutoBackup(get(), 'UPSERT_BODYWEIGHT');
    if (get().isOnline) {
      void get().attemptSync();
    }
    return created;
  },

  updateBodyweightEntry: async (entry) => {
    const updated: BodyweightEntry = { ...entry, updatedAt: new Date().toISOString() };
    await db.bodyweightEntries.put(updated);
    await enqueueSync('UPSERT_BODYWEIGHT', updated);
    const bodyweightEntries = get().bodyweightEntries.map((item) => (item.id === updated.id ? updated : item));
    set({ bodyweightEntries, error: undefined });
    await maybeCreateAutoBackup(get(), 'UPSERT_BODYWEIGHT');
    if (get().isOnline) {
      void get().attemptSync();
    }
  },

  deleteBodyweightEntry: async (entryId) => {
    await db.bodyweightEntries.delete(entryId);
    await enqueueSync('DELETE_BODYWEIGHT', { id: entryId });
    const bodyweightEntries = get().bodyweightEntries.filter((entry) => entry.id !== entryId);
    set({ bodyweightEntries, error: undefined });
    await maybeCreateAutoBackup(get(), 'DELETE_BODYWEIGHT');
    if (get().isOnline) {
      void get().attemptSync();
    }
  },

  startWorkout: (split, name, templateWorkout) => {
    const workouts = get().workouts;
    const catalog = get().exerciseCatalog;
    const lastForSplit = [...workouts].reverse().find((w) => w.split === split);
    const prs = get().analytics.personalRecords;
    const prByName = new Map(prs.map((pr) => [pr.exerciseName, pr]));

    let exercises: ActiveExercise[];

    if (templateWorkout) {
      exercises = templateWorkout.exercises.map((ex) => {
        const pr = prByName.get(ex.name);
        return {
          id: crypto.randomUUID(),
          name: ex.name,
          bodyPart: ex.bodyPart,
          category: ex.category,
          notes: ex.notes,
          pr: pr ? { weight: pr.weight, reps: pr.reps, est1RM: pr.estimated1RM } : undefined,
          sets: ex.sets.map((s) => ({
            id: crypto.randomUUID(),
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            restSeconds: s.restSeconds,
            completed: false,
            previousWeight: s.weight,
            previousReps: s.reps
          }))
        };
      });
    } else if (lastForSplit) {
      exercises = lastForSplit.exercises.map((ex) => {
        const pr = prByName.get(ex.name);
        return {
          id: crypto.randomUUID(),
          name: ex.name,
          bodyPart: ex.bodyPart,
          category: ex.category,
          pr: pr ? { weight: pr.weight, reps: pr.reps, est1RM: pr.estimated1RM } : undefined,
          sets: ex.sets.map((s) => ({
            id: crypto.randomUUID(),
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            restSeconds: s.restSeconds,
            completed: false,
            previousWeight: s.weight,
            previousReps: s.reps
          }))
        } as ActiveExercise;
      });
    } else {
      const fallbackExercises = catalog.filter(
        (e) => e.primarySplits.includes(split) || split === 'Full Body' || split === 'Custom'
      ).slice(0, 3);
      const defaults = fallbackExercises.length > 0 ? fallbackExercises : catalog.slice(0, 1);
      exercises = defaults.map((def) => ({
        id: crypto.randomUUID(),
        name: def.name,
        bodyPart: def.bodyPart,
        category: def.category,
        sets: [
          { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false },
          { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false },
          { id: crypto.randomUUID(), weight: 95, reps: 8, rpe: 8, restSeconds: 120, completed: false }
        ]
      } as ActiveExercise));
    }

    const activeWorkout: ActiveWorkout = {
      id: crypto.randomUUID(),
      split,
      name: name || split,
      startTime: new Date().toISOString(),
      exercises
    };
    set({ activeWorkout });
    void persistActiveWorkoutSnapshot(activeWorkout);
  },

  updateActiveWorkout: (workout) => {
    set({ activeWorkout: workout });
    void persistActiveWorkoutSnapshot(workout);
  },

  finishActiveWorkout: async (notes) => {
    const active = get().activeWorkout;
    if (!active) {
      return false;
    }

    const now = new Date();
    const startMs = new Date(active.startTime).getTime();
    const durationMinutes = Math.max(1, Math.round(Math.max(0, now.getTime() - startMs) / 60000));
    const nowIso = now.toISOString();
    const dateStr = nowIso.slice(0, 10);

    const completedExercises = active.exercises
      .map((exercise) => ({
        ...exercise,
        sets: exercise.sets
          .filter((set) => set.completed)
          .filter((set) => Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.reps > 0 && set.weight >= 0)
      }))
      .filter((exercise) => exercise.name.trim().length > 0 && exercise.sets.length > 0);

    if (completedExercises.length === 0) {
      set({ error: 'Complete at least one valid set before finishing your workout.' });
      return false;
    }

    const session: WorkoutSession = {
      id: active.id,
      date: dateStr,
      split: active.split,
      durationMinutes,
      totalVolume: completedExercises.reduce(
        (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + set.weight * set.reps, 0),
        0
      ),
      completed: true,
      notes: notes?.trim() || undefined,
      exercises: completedExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        category: exercise.category,
        notes: exercise.notes,
        sets: exercise.sets.map((set) => ({
          id: set.id,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          restSeconds: set.restSeconds
        }))
      })),
      createdAt: active.startTime,
      updatedAt: nowIso
    };

    try {
      const totalVolume = workoutVolume(session);
      const prevForSplit = [...get().workouts]
        .reverse()
        .find((workout) => workout.split === session.split && workout.id !== session.id);
      const volumeVsLast = prevForSplit ? totalVolume - workoutVolume(prevForSplit) : undefined;
      const newPRs = computeNewPRs(session, get().analytics.personalRecords);

      await get().addWorkout(session);

      const summary: WorkoutSummary = {
        workout: session,
        durationMinutes,
        totalVolume,
        totalSets: session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0),
        newPRs,
        volumeVsLast
      };

      set({ activeWorkout: null, lastSummary: summary, error: undefined });
      await persistActiveWorkoutSnapshot(null);
      await maybeCreateAutoBackup(get(), 'FINISH_WORKOUT');
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save workout. Please try again.' });
      return false;
    }
  },

  discardActiveWorkout: () => {
    set({ activeWorkout: null });
    void persistActiveWorkoutSnapshot(null);
  },

  clearLastSummary: () => {
    set({ lastSummary: null });
  }
}));
