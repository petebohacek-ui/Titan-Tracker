import { parseISO } from 'date-fns';
import { db } from '../database/db';
import { getSupabaseClient } from '../lib/supabase';
import type { AppSettings, ExerciseDefinition, Goal, WorkoutSession } from '../types/workout';
import type { BodyweightEntry, SyncOperation } from '../database/db';

type WorkoutRow = {
  id: string;
  user_id: string;
  date: string;
  split: WorkoutSession['split'];
  duration_minutes: number;
  total_volume: number;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WorkoutSetRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  body_part: WorkoutSession['exercises'][number]['bodyPart'];
  category: WorkoutSession['exercises'][number]['category'];
  set_index: number;
  reps: number;
  weight: number;
  rpe: number;
  rest_seconds: number;
  notes: string | null;
  updated_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  label: string;
  type: Goal['type'];
  target: number;
  progress: number;
  unit: string;
  updated_at: string;
};

type CustomExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  body_part: ExerciseDefinition['bodyPart'];
  category: ExerciseDefinition['category'];
  primary_splits: WorkoutSession['split'][];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  user_id: string;
  payload: AppSettings;
  updated_at: string;
};

type BodyweightRow = {
  id: string;
  user_id: string;
  date: string;
  weight: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

const CLOUD_SYNC_KEY_PREFIX = 'titan-track-cloud-sync-';

const getCloudSyncKey = (userId: string) => `${CLOUD_SYNC_KEY_PREFIX}${userId}`;

const mapWorkoutToCloud = (userId: string, workout: WorkoutSession) => ({
  id: workout.id,
  user_id: userId,
  date: workout.date,
  split: workout.split,
  duration_minutes: workout.durationMinutes,
  total_volume: workout.totalVolume ?? 0,
  completed: workout.completed,
  notes: workout.notes ?? null,
  created_at: workout.createdAt,
  updated_at: workout.updatedAt
});

const mapGoalToCloud = (userId: string, goal: Goal) => ({
  id: goal.id,
  user_id: userId,
  label: goal.label,
  type: goal.type,
  target: goal.target,
  progress: goal.progress,
  unit: goal.unit,
  updated_at: new Date().toISOString()
});

const mapCustomExerciseToCloud = (userId: string, exercise: ExerciseDefinition) => ({
  id: exercise.id,
  user_id: userId,
  name: exercise.name,
  body_part: exercise.bodyPart,
  category: exercise.category,
  primary_splits: exercise.primarySplits,
  is_custom: true,
  created_at: exercise.createdAt ?? new Date().toISOString(),
  updated_at: exercise.updatedAt ?? new Date().toISOString()
});

const mapBodyweightToCloud = (userId: string, entry: BodyweightEntry) => ({
  id: entry.id,
  user_id: userId,
  date: entry.date,
  weight: entry.weight,
  note: entry.note ?? null,
  created_at: entry.createdAt,
  updated_at: entry.updatedAt
});

const upsertWorkoutSets = async (workout: WorkoutSession) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.from('workout_sets').delete().eq('workout_id', workout.id);

  const rows = workout.exercises.flatMap((exercise) =>
    exercise.sets.map((set, setIndex) => ({
      id: set.id,
      workout_id: workout.id,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      body_part: exercise.bodyPart,
      category: exercise.category,
      set_index: setIndex,
      reps: set.reps,
      weight: set.weight,
      rpe: set.rpe,
      rest_seconds: set.restSeconds,
      notes: exercise.notes ?? null,
      updated_at: workout.updatedAt
    }))
  );

  if (rows.length > 0) {
    await (supabase.from('workout_sets' as any) as any).upsert(rows as any, { onConflict: 'id' });
  }
};

const syncOperation = async (userId: string, operation: SyncOperation) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const payload = JSON.parse(operation.payload);

  switch (operation.type) {
    case 'CREATE_WORKOUT':
    case 'UPDATE_WORKOUT': {
      const workout = payload as WorkoutSession;
      await (supabase.from('workouts' as any) as any).upsert(mapWorkoutToCloud(userId, workout) as any, { onConflict: 'id' });
      await upsertWorkoutSets(workout);
      await supabase
        .from('workout_splits' as any)
        .upsert({ user_id: userId, split: workout.split, updated_at: workout.updatedAt } as any, { onConflict: 'user_id,split' });
      break;
    }
    case 'DELETE_WORKOUT': {
      await supabase.from('workout_sets').delete().eq('workout_id', payload.id);
      await supabase.from('workouts').delete().eq('id', payload.id).eq('user_id', userId);
      break;
    }
    case 'UPDATE_SETTINGS': {
      const settings = payload as AppSettings;
      await supabase
        .from('settings' as any)
        .upsert({ user_id: userId, payload: settings, updated_at: new Date().toISOString() } as any, { onConflict: 'user_id' });
      break;
    }
    case 'UPSERT_GOAL': {
      await (supabase.from('goals' as any) as any).upsert(mapGoalToCloud(userId, payload as Goal) as any, { onConflict: 'id' });
      break;
    }
    case 'DELETE_GOAL': {
      await supabase.from('goals').delete().eq('id', payload.id).eq('user_id', userId);
      break;
    }
    case 'UPSERT_CUSTOM_EXERCISE': {
      await supabase
        .from('custom_exercises' as any)
        .upsert(mapCustomExerciseToCloud(userId, payload as ExerciseDefinition) as any, { onConflict: 'id' });
      break;
    }
    case 'DELETE_CUSTOM_EXERCISE': {
      await supabase.from('custom_exercises').delete().eq('id', payload.id).eq('user_id', userId);
      break;
    }
    case 'UPSERT_BODYWEIGHT': {
      await (supabase.from('bodyweight_history' as any) as any).upsert(mapBodyweightToCloud(userId, payload as BodyweightEntry) as any, { onConflict: 'id' });
      break;
    }
    case 'DELETE_BODYWEIGHT': {
      await supabase.from('bodyweight_history').delete().eq('id', payload.id).eq('user_id', userId);
      break;
    }
    case 'BACKUP_SNAPSHOT': {
      const snapshot = await db.backupSnapshots.get(payload.id);
      if (snapshot) {
        await (supabase.from('backup_snapshots' as any) as any).upsert({
          id: snapshot.id,
          user_id: userId,
          trigger: snapshot.trigger,
          payload: snapshot.payload,
          created_at: snapshot.createdAt,
          updated_at: snapshot.createdAt
        } as any);
      }
      break;
    }
    default:
      break;
  }
};

const replaceWorkoutSets = async (workoutId: string, sets: Array<Record<string, unknown>>) => {
  await db.transaction('rw', [db.workouts], async () => {
    const workout = await db.workouts.get(workoutId);
    if (!workout) {
      return;
    }

    const exerciseMap = new Map<string, typeof workout.exercises[number]>();
    for (const entry of sets) {
      const exerciseId = String(entry.exercise_id);
      const existing = exerciseMap.get(exerciseId);
      if (!existing) {
        exerciseMap.set(exerciseId, {
          id: exerciseId,
          name: String(entry.exercise_name),
          bodyPart: entry.body_part as WorkoutSession['exercises'][number]['bodyPart'],
          category: entry.category as WorkoutSession['exercises'][number]['category'],
          notes: (entry.notes as string | null) ?? undefined,
          sets: []
        });
      }

      exerciseMap.get(exerciseId)?.sets.push({
        id: String(entry.id),
        reps: Number(entry.reps),
        weight: Number(entry.weight),
        rpe: Number(entry.rpe),
        restSeconds: Number(entry.rest_seconds)
      });
    }

    const mergedExercises = Array.from(exerciseMap.values()).map((exercise) => ({
      ...exercise,
      sets: exercise.sets.sort((a, b) => a.id.localeCompare(b.id))
    }));

    await db.workouts.put({ ...workout, exercises: mergedExercises });
  });
};

export const pullCloudChanges = async (userId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const since = localStorage.getItem(getCloudSyncKey(userId));

  let workoutsQuery = supabase.from('workouts').select('*').eq('user_id', userId);
  let goalsQuery = supabase.from('goals').select('*').eq('user_id', userId);
  let settingsQuery = supabase.from('settings').select('*').eq('user_id', userId).limit(1);
  let customExercisesQuery = supabase.from('custom_exercises').select('*').eq('user_id', userId);
  let bodyweightQuery = supabase.from('bodyweight_history').select('*').eq('user_id', userId);
  let setsQuery = supabase.from('workout_sets').select('*');

  if (since) {
    workoutsQuery = workoutsQuery.gt('updated_at', since);
    goalsQuery = goalsQuery.gt('updated_at', since);
    settingsQuery = settingsQuery.gt('updated_at', since);
    customExercisesQuery = customExercisesQuery.gt('updated_at', since);
    bodyweightQuery = bodyweightQuery.gt('updated_at', since);
    setsQuery = setsQuery.gt('updated_at', since);
  }

  const [workoutsRes, goalsRes, settingsRes, customRes, bodyweightRes, setsRes] = await Promise.all([
    workoutsQuery,
    goalsQuery,
    settingsQuery,
    customExercisesQuery,
    bodyweightQuery,
    setsQuery
  ]);

  if (workoutsRes.error || goalsRes.error || settingsRes.error || customRes.error || bodyweightRes.error || setsRes.error) {
    throw new Error(
      workoutsRes.error?.message ||
      goalsRes.error?.message ||
      settingsRes.error?.message ||
      customRes.error?.message ||
      bodyweightRes.error?.message ||
      setsRes.error?.message ||
      'Cloud pull failed'
    );
  }

  const remoteWorkouts = (workoutsRes.data ?? []) as WorkoutRow[];
  const remoteGoals = (goalsRes.data ?? []) as GoalRow[];
  const remoteSettings = (settingsRes.data?.[0] ?? null) as SettingsRow | null;
  const remoteCustom = (customRes.data ?? []) as CustomExerciseRow[];
  const remoteBodyweight = (bodyweightRes.data ?? []) as BodyweightRow[];
  const remoteSets = (setsRes.data ?? []) as WorkoutSetRow[];

  for (const row of remoteWorkouts) {
    const local = await db.workouts.get(row.id);
    const remoteDate = parseISO(row.updated_at).getTime();
    const localDate = local ? parseISO(local.updatedAt).getTime() : 0;
    if (!local || remoteDate >= localDate) {
      await db.workouts.put({
        id: row.id,
        date: row.date,
        split: row.split,
        durationMinutes: row.duration_minutes,
        totalVolume: row.total_volume,
        completed: row.completed,
        notes: row.notes ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        exercises: local?.exercises ?? []
      });
    }
  }

  const setsByWorkout = new Map<string, Array<Record<string, unknown>>>();
  for (const row of remoteSets) {
    const workoutId = String(row.workout_id);
    if (!setsByWorkout.has(workoutId)) {
      setsByWorkout.set(workoutId, []);
    }
    setsByWorkout.get(workoutId)?.push(row as Record<string, unknown>);
  }

  for (const [workoutId, sets] of setsByWorkout.entries()) {
    await replaceWorkoutSets(workoutId, sets);
  }

  for (const row of remoteGoals) {
    await db.goals.put({
      id: row.id,
      label: row.label,
      type: row.type,
      target: row.target,
      progress: row.progress,
      unit: row.unit
    });
  }

  if (remoteSettings?.payload) {
    await db.appSettings.put({ id: 'app', value: remoteSettings.payload as AppSettings, updatedAt: remoteSettings.updated_at });
  }

  for (const row of remoteCustom) {
    await db.customExercises.put({
      id: row.id,
      name: row.name,
      bodyPart: row.body_part,
      category: row.category,
      primarySplits: row.primary_splits,
      isCustom: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  for (const row of remoteBodyweight) {
    await db.bodyweightEntries.put({
      id: row.id,
      date: row.date,
      weight: row.weight,
      note: row.note ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  localStorage.setItem(getCloudSyncKey(userId), new Date().toISOString());
};

export const pushQueuedCloudChanges = async (userId: string): Promise<number> => {
  const operations = (await db.syncQueue.toArray()).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  let synced = 0;

  for (const operation of operations) {
    try {
      await syncOperation(userId, operation);
      await db.syncQueue.delete(operation.id);
      synced += 1;
    } catch (error) {
      console.error('Cloud push failed', operation.type, error);
      break;
    }
  }

  return synced;
};

export const getPendingCloudOperations = async (): Promise<number> => db.syncQueue.count();

export const uploadAllLocalDataToCloud = async (userId: string): Promise<void> => {
  const workouts = await db.workouts.toArray();
  const goals = await db.goals.toArray();
  const customExercises = await db.customExercises.toArray();
  const bodyweightEntries = await db.bodyweightEntries.toArray();
  const settings = await db.appSettings.get('app');

  for (const workout of workouts) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      type: 'UPDATE_WORKOUT',
      payload: JSON.stringify(workout),
      createdAt: new Date().toISOString()
    });
  }

  for (const goal of goals) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      type: 'UPSERT_GOAL',
      payload: JSON.stringify(goal),
      createdAt: new Date().toISOString()
    });
  }

  for (const exercise of customExercises) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      type: 'UPSERT_CUSTOM_EXERCISE',
      payload: JSON.stringify(exercise),
      createdAt: new Date().toISOString()
    });
  }

  for (const entry of bodyweightEntries) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      type: 'UPSERT_BODYWEIGHT',
      payload: JSON.stringify(entry),
      createdAt: new Date().toISOString()
    });
  }

  if (settings) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      type: 'UPDATE_SETTINGS',
      payload: JSON.stringify(settings.value),
      createdAt: new Date().toISOString()
    });
  }
};
