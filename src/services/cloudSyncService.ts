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

const upsertWorkoutSets = async (userId: string, workout: WorkoutSession) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const rows = workout.exercises.flatMap((exercise) =>
    exercise.sets.map((set, setIndex) => ({
      id: set.id,
      workout_id: workout.id,
      user_id: userId,
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
    const { error } = await (supabase.from('workout_sets' as any) as any).upsert(rows as any, { onConflict: 'id' });
    if (error) {
      throw new Error(error.message);
    }

    const keepIds = rows.map((row) => row.id);
    const inClause = `(${keepIds.join(',')})`;
    const { error: pruneError } = await supabase
      .from('workout_sets')
      .delete()
      .eq('workout_id', workout.id)
      .eq('user_id', userId)
      .not('id', 'in', inClause);
    if (pruneError) {
      throw new Error(pruneError.message);
    }
  } else {
    const { error: deleteError } = await supabase
      .from('workout_sets')
      .delete()
      .eq('workout_id', workout.id)
      .eq('user_id', userId);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }
};

const syncOperation = async (userId: string, operation: SyncOperation) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(operation.payload);
  } catch {
    throw new Error('Malformed sync payload');
  }

  switch (operation.type) {
    case 'CREATE_WORKOUT':
    case 'UPDATE_WORKOUT': {
      const workout = payload as WorkoutSession;
      const { error: workoutError } = await (supabase.from('workouts' as any) as any).upsert(mapWorkoutToCloud(userId, workout) as any, { onConflict: 'id' });
      if (workoutError) {
        throw new Error(workoutError.message);
      }
      await upsertWorkoutSets(userId, workout);
      const { error: splitError } = await supabase
        .from('workout_splits' as any)
        .upsert({ user_id: userId, split: workout.split, updated_at: workout.updatedAt } as any, { onConflict: 'user_id,split' });
      if (splitError) {
        throw new Error(splitError.message);
      }
      break;
    }
    case 'DELETE_WORKOUT': {
      const deletePayload = payload as { id: string };
      const { error: setsError } = await supabase.from('workout_sets').delete().eq('workout_id', deletePayload.id).eq('user_id', userId);
      if (setsError) {
        throw new Error(setsError.message);
      }
      const { error: workoutsError } = await supabase.from('workouts').delete().eq('id', deletePayload.id).eq('user_id', userId);
      if (workoutsError) {
        throw new Error(workoutsError.message);
      }
      break;
    }
    case 'UPDATE_SETTINGS': {
      const settings = payload as AppSettings;
      const { error } = await supabase
        .from('settings' as any)
        .upsert({ user_id: userId, payload: settings, updated_at: new Date().toISOString() } as any, { onConflict: 'user_id' });
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'UPSERT_GOAL': {
      const { error } = await (supabase.from('goals' as any) as any).upsert(mapGoalToCloud(userId, payload as Goal) as any, { onConflict: 'id' });
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'DELETE_GOAL': {
      const deletePayload = payload as { id: string };
      const { error } = await supabase.from('goals').delete().eq('id', deletePayload.id).eq('user_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'UPSERT_CUSTOM_EXERCISE': {
      const { error } = await supabase
        .from('custom_exercises' as any)
        .upsert(mapCustomExerciseToCloud(userId, payload as ExerciseDefinition) as any, { onConflict: 'id' });
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'DELETE_CUSTOM_EXERCISE': {
      const deletePayload = payload as { id: string };
      const { error } = await supabase.from('custom_exercises').delete().eq('id', deletePayload.id).eq('user_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'UPSERT_BODYWEIGHT': {
      const { error } = await (supabase.from('bodyweight_history' as any) as any).upsert(mapBodyweightToCloud(userId, payload as BodyweightEntry) as any, { onConflict: 'id' });
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'DELETE_BODYWEIGHT': {
      const deletePayload = payload as { id: string };
      const { error } = await supabase.from('bodyweight_history').delete().eq('id', deletePayload.id).eq('user_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case 'BACKUP_SNAPSHOT': {
      const backupPayload = payload as { id: string };
      const snapshot = await db.backupSnapshots.get([userId, backupPayload.id]);
      if (snapshot) {
        const { error } = await (supabase.from('backup_snapshots' as any) as any).upsert({
          id: snapshot.id,
          user_id: userId,
          trigger: snapshot.trigger,
          payload: snapshot.payload,
          created_at: snapshot.createdAt,
          updated_at: snapshot.createdAt
        } as any);
        if (error) {
          throw new Error(error.message);
        }
      }
      break;
    }
    default:
      break;
  }
};

const mapSetsByWorkout = (rows: WorkoutSetRow[]): Map<string, WorkoutSession['exercises']> => {
  const byWorkout = new Map<string, Array<WorkoutSetRow>>();
  for (const row of rows) {
    const workoutRows = byWorkout.get(row.workout_id) ?? [];
    workoutRows.push(row);
    byWorkout.set(row.workout_id, workoutRows);
  }

  const result = new Map<string, WorkoutSession['exercises']>();
  for (const [workoutId, workoutRows] of byWorkout.entries()) {
    const byExercise = new Map<string, WorkoutSession['exercises'][number]>();
    for (const row of workoutRows.sort((a, b) => a.set_index - b.set_index || a.id.localeCompare(b.id))) {
      const existing = byExercise.get(row.exercise_id);
      if (!existing) {
        byExercise.set(row.exercise_id, {
          id: row.exercise_id,
          name: row.exercise_name,
          bodyPart: row.body_part,
          category: row.category,
          notes: row.notes ?? undefined,
          sets: []
        });
      }

      byExercise.get(row.exercise_id)?.sets.push({
        id: row.id,
        reps: row.reps,
        weight: row.weight,
        rpe: row.rpe,
        restSeconds: row.rest_seconds
      });
    }
    result.set(workoutId, Array.from(byExercise.values()));
  }

  return result;
};

export const pullCloudChanges = async (userId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const [workoutsRes, goalsRes, settingsRes, customRes, bodyweightRes, setsRes] = await Promise.all([
    supabase.from('workouts').select('*').eq('user_id', userId),
    supabase.from('goals').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId).limit(1),
    supabase.from('custom_exercises').select('*').eq('user_id', userId),
    supabase.from('bodyweight_history').select('*').eq('user_id', userId),
    supabase.from('workout_sets').select('*').eq('user_id', userId)
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

  const setsByWorkout = mapSetsByWorkout(remoteSets);

  await db.transaction('rw', [db.workouts, db.goals, db.appSettings, db.customExercises, db.bodyweightEntries], async () => {
    const localWorkouts = await db.workouts.where('ownerId').equals(userId).toArray();
    const remoteWorkoutIds = new Set(remoteWorkouts.map((row) => row.id));
    const removeWorkoutKeys = localWorkouts
      .filter((workout) => !remoteWorkoutIds.has(workout.id))
      .map((workout) => [userId, workout.id] as [string, string]);
    if (removeWorkoutKeys.length > 0) {
      await db.workouts.bulkDelete(removeWorkoutKeys);
    }
    if (remoteWorkouts.length > 0) {
      await db.workouts.bulkPut(
        remoteWorkouts.map((row) => ({
          ownerId: userId,
          id: row.id,
          date: row.date,
          split: row.split,
          durationMinutes: row.duration_minutes,
          totalVolume: row.total_volume,
          completed: row.completed,
          notes: row.notes ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          exercises: setsByWorkout.get(row.id) ?? []
        }))
      );
    }

    const localGoals = await db.goals.where('ownerId').equals(userId).toArray();
    const remoteGoalIds = new Set(remoteGoals.map((row) => row.id));
    const removeGoalKeys = localGoals
      .filter((goal) => !remoteGoalIds.has(goal.id))
      .map((goal) => [userId, goal.id] as [string, string]);
    if (removeGoalKeys.length > 0) {
      await db.goals.bulkDelete(removeGoalKeys);
    }
    if (remoteGoals.length > 0) {
      await db.goals.bulkPut(
        remoteGoals.map((row) => ({
          ownerId: userId,
          id: row.id,
          label: row.label,
          type: row.type,
          target: row.target,
          progress: row.progress,
          unit: row.unit
        }))
      );
    }

    if (remoteSettings?.payload) {
      await db.appSettings.put({ ownerId: userId, id: 'app', value: remoteSettings.payload as AppSettings, updatedAt: remoteSettings.updated_at });
    }

    const localCustom = await db.customExercises.where('ownerId').equals(userId).toArray();
    const remoteCustomIds = new Set(remoteCustom.map((row) => row.id));
    const removeCustomKeys = localCustom
      .filter((exercise) => !remoteCustomIds.has(exercise.id))
      .map((exercise) => [userId, exercise.id] as [string, string]);
    if (removeCustomKeys.length > 0) {
      await db.customExercises.bulkDelete(removeCustomKeys);
    }
    if (remoteCustom.length > 0) {
      await db.customExercises.bulkPut(
        remoteCustom.map((row) => ({
          ownerId: userId,
          id: row.id,
          name: row.name,
          bodyPart: row.body_part,
          category: row.category,
          primarySplits: row.primary_splits,
          isCustom: true,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      );
    }

    const localBodyweight = await db.bodyweightEntries.where('ownerId').equals(userId).toArray();
    const remoteBodyweightIds = new Set(remoteBodyweight.map((row) => row.id));
    const removeBodyweightKeys = localBodyweight
      .filter((entry) => !remoteBodyweightIds.has(entry.id))
      .map((entry) => [userId, entry.id] as [string, string]);
    if (removeBodyweightKeys.length > 0) {
      await db.bodyweightEntries.bulkDelete(removeBodyweightKeys);
    }
    if (remoteBodyweight.length > 0) {
      await db.bodyweightEntries.bulkPut(
        remoteBodyweight.map((row) => ({
          ownerId: userId,
          id: row.id,
          date: row.date,
          weight: row.weight,
          note: row.note ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      );
    }
  });

  localStorage.setItem(getCloudSyncKey(userId), new Date().toISOString());
};

export const pushQueuedCloudChanges = async (userId: string): Promise<number> => {
  const operations = (await db.syncQueue.where('ownerId').equals(userId).toArray()).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  let synced = 0;

  for (const operation of operations) {
    try {
      await syncOperation(userId, operation);
      await db.syncQueue.delete([userId, operation.id]);
      synced += 1;
    } catch (error) {
      if (error instanceof Error && error.message === 'Malformed sync payload') {
        console.error('Dropping malformed queued operation', operation.id);
        await db.syncQueue.delete([userId, operation.id]);
        continue;
      }
      throw error;
    }
  }

  return synced;
};

export const getPendingCloudOperations = async (ownerId: string): Promise<number> => db.syncQueue.where('ownerId').equals(ownerId).count();

export const uploadAllLocalDataToCloud = async (userId: string): Promise<void> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const workouts = await db.workouts.where('ownerId').equals(userId).toArray();
  const goals = await db.goals.where('ownerId').equals(userId).toArray();
  const customExercises = await db.customExercises.where('ownerId').equals(userId).toArray();
  const bodyweightEntries = await db.bodyweightEntries.where('ownerId').equals(userId).toArray();
  const settings = await db.appSettings.get([userId, 'app']);

  const [remoteWorkoutsRes, remoteGoalsRes, remoteCustomRes, remoteBodyweightRes] = await Promise.all([
    supabase.from('workouts').select('id').eq('user_id', userId),
    supabase.from('goals').select('id').eq('user_id', userId),
    supabase.from('custom_exercises').select('id').eq('user_id', userId),
    supabase.from('bodyweight_history').select('id').eq('user_id', userId)
  ]);

  if (remoteWorkoutsRes.error || remoteGoalsRes.error || remoteCustomRes.error || remoteBodyweightRes.error) {
    throw new Error(
      remoteWorkoutsRes.error?.message ||
      remoteGoalsRes.error?.message ||
      remoteCustomRes.error?.message ||
      remoteBodyweightRes.error?.message ||
      'Failed to compare local and remote data before upload'
    );
  }

  const localWorkoutIds = new Set(workouts.map((entry) => entry.id));
  for (const row of (remoteWorkoutsRes.data ?? []) as Array<{ id: string }>) {
    if (!localWorkoutIds.has(row.id)) {
      await syncOperation(userId, {
        id: crypto.randomUUID(),
        ownerId: userId,
        type: 'DELETE_WORKOUT',
        payload: JSON.stringify({ id: row.id }),
        createdAt: new Date().toISOString()
      });
    }
  }

  const localGoalIds = new Set(goals.map((entry) => entry.id));
  for (const row of (remoteGoalsRes.data ?? []) as Array<{ id: string }>) {
    if (!localGoalIds.has(row.id)) {
      await syncOperation(userId, {
        id: crypto.randomUUID(),
        ownerId: userId,
        type: 'DELETE_GOAL',
        payload: JSON.stringify({ id: row.id }),
        createdAt: new Date().toISOString()
      });
    }
  }

  const localCustomIds = new Set(customExercises.map((entry) => entry.id));
  for (const row of (remoteCustomRes.data ?? []) as Array<{ id: string }>) {
    if (!localCustomIds.has(row.id)) {
      await syncOperation(userId, {
        id: crypto.randomUUID(),
        ownerId: userId,
        type: 'DELETE_CUSTOM_EXERCISE',
        payload: JSON.stringify({ id: row.id }),
        createdAt: new Date().toISOString()
      });
    }
  }

  const localBodyweightIds = new Set(bodyweightEntries.map((entry) => entry.id));
  for (const row of (remoteBodyweightRes.data ?? []) as Array<{ id: string }>) {
    if (!localBodyweightIds.has(row.id)) {
      await syncOperation(userId, {
        id: crypto.randomUUID(),
        ownerId: userId,
        type: 'DELETE_BODYWEIGHT',
        payload: JSON.stringify({ id: row.id }),
        createdAt: new Date().toISOString()
      });
    }
  }

  for (const workout of workouts) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      ownerId: userId,
      type: 'UPDATE_WORKOUT',
      payload: JSON.stringify(workout),
      createdAt: new Date().toISOString()
    });
  }

  for (const goal of goals) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      ownerId: userId,
      type: 'UPSERT_GOAL',
      payload: JSON.stringify(goal),
      createdAt: new Date().toISOString()
    });
  }

  for (const exercise of customExercises) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      ownerId: userId,
      type: 'UPSERT_CUSTOM_EXERCISE',
      payload: JSON.stringify(exercise),
      createdAt: new Date().toISOString()
    });
  }

  for (const entry of bodyweightEntries) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      ownerId: userId,
      type: 'UPSERT_BODYWEIGHT',
      payload: JSON.stringify(entry),
      createdAt: new Date().toISOString()
    });
  }

  if (settings) {
    await syncOperation(userId, {
      id: crypto.randomUUID(),
      ownerId: userId,
      type: 'UPDATE_SETTINGS',
      payload: JSON.stringify(settings.value),
      createdAt: new Date().toISOString()
    });
  }
};
