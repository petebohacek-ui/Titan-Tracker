import Dexie, { type Table } from 'dexie';
import type { AppSettings, ExerciseDefinition, Goal, WorkoutSession } from '../types/workout';

export const LOCAL_ANON_OWNER_ID = 'local-anonymous';

export type SyncOperationType =
  | 'CREATE_WORKOUT'
  | 'UPDATE_WORKOUT'
  | 'DELETE_WORKOUT'
  | 'UPDATE_SETTINGS'
  | 'UPSERT_GOAL'
  | 'DELETE_GOAL'
  | 'UPSERT_CUSTOM_EXERCISE'
  | 'DELETE_CUSTOM_EXERCISE'
  | 'UPSERT_BODYWEIGHT'
  | 'DELETE_BODYWEIGHT'
  | 'BACKUP_SNAPSHOT';

export interface SyncOperation {
  id: string;
  ownerId: string;
  type: SyncOperationType;
  payload: string;
  createdAt: string;
}

export interface OwnedWorkoutSession extends WorkoutSession {
  ownerId: string;
}

export interface OwnedGoal extends Goal {
  ownerId: string;
}

export interface OwnedExerciseDefinition extends ExerciseDefinition {
  ownerId: string;
}

export interface AppSettingsRecord {
  ownerId: string;
  id: 'app';
  value: AppSettings;
  updatedAt: string;
}

export interface ActiveWorkoutSnapshotRecord {
  ownerId: string;
  id: 'current';
  payload: string;
  updatedAt: string;
}

export interface BodyweightEntry {
  id: string;
  date: string;
  weight: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnedBodyweightEntry extends BodyweightEntry {
  ownerId: string;
}

export interface BackupSnapshotRecord {
  id: string;
  ownerId: string;
  trigger: string;
  payload: string;
  createdAt: string;
}

export interface SyncLockRecord {
  ownerId: string;
  token: string;
  lockedAt: string;
  expiresAt: string;
}

export interface AuthStorageRecord {
  key: string;
  value: string;
  updatedAt: string;
}

class TitanTrackDatabase extends Dexie {
  workouts!: Table<OwnedWorkoutSession, [string, string]>;
  // Legacy table retained for migration safety.
  settings!: Table<AppSettings, string>;
  appSettings!: Table<AppSettingsRecord, [string, string]>;
  goals!: Table<OwnedGoal, [string, string]>;
  customExercises!: Table<OwnedExerciseDefinition, [string, string]>;
  syncQueue!: Table<SyncOperation, [string, string]>;
  activeWorkoutSnapshots!: Table<ActiveWorkoutSnapshotRecord, [string, string]>;
  bodyweightEntries!: Table<OwnedBodyweightEntry, [string, string]>;
  backupSnapshots!: Table<BackupSnapshotRecord, [string, string]>;
  syncLocks!: Table<SyncLockRecord, string>;
  authStorage!: Table<AuthStorageRecord, string>;

  constructor() {
    super('TitanTrackDB');
    this.version(1).stores({
      workouts: 'id,date,split,updatedAt',
      settings: '&theme',
      goals: 'id,type',
      syncQueue: 'id,type,createdAt'
    });

    this.version(2)
      .stores({
        workouts: 'id,date,split,updatedAt',
        settings: '&theme',
        goals: 'id,type',
        customExercises: 'id,name,bodyPart,category,updatedAt',
        syncQueue: 'id,type,createdAt'
      });

    this.version(3).stores({
      workouts: 'id,date,split,updatedAt',
      settings: '&theme',
      appSettings: '&id,updatedAt',
      goals: 'id,type',
      customExercises: 'id,name,bodyPart,category,updatedAt',
      syncQueue: 'id,type,createdAt',
      activeWorkoutSnapshots: '&id,updatedAt',
      bodyweightEntries: 'id,date,updatedAt',
      backupSnapshots: 'id,createdAt,trigger'
    });

    this.version(4)
      .stores({
        workouts: '[ownerId+id],id,ownerId,date,split,updatedAt',
        settings: '&theme',
        appSettings: '[ownerId+id],ownerId,updatedAt',
        goals: '[ownerId+id],id,ownerId,type',
        customExercises: '[ownerId+id],id,ownerId,name,bodyPart,category,updatedAt',
        syncQueue: '[ownerId+id],id,ownerId,type,createdAt',
        activeWorkoutSnapshots: '[ownerId+id],ownerId,updatedAt',
        bodyweightEntries: '[ownerId+id],id,ownerId,date,updatedAt',
        backupSnapshots: '[ownerId+id],id,ownerId,createdAt,trigger'
      })
      .upgrade(async (tx) => {
        await tx.table('workouts').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('appSettings').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('goals').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('customExercises').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('syncQueue').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('activeWorkoutSnapshots').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('bodyweightEntries').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
        await tx.table('backupSnapshots').toCollection().modify((row) => {
          row.ownerId = row.ownerId ?? LOCAL_ANON_OWNER_ID;
        });
      });

    this.version(5).stores({
      workouts: '[ownerId+id],id,ownerId,date,split,updatedAt',
      settings: '&theme',
      appSettings: '[ownerId+id],ownerId,updatedAt',
      goals: '[ownerId+id],id,ownerId,type',
      customExercises: '[ownerId+id],id,ownerId,name,bodyPart,category,updatedAt',
      syncQueue: '[ownerId+id],id,ownerId,type,createdAt',
      activeWorkoutSnapshots: '[ownerId+id],ownerId,updatedAt',
      bodyweightEntries: '[ownerId+id],id,ownerId,date,updatedAt',
      backupSnapshots: '[ownerId+id],id,ownerId,createdAt,trigger',
      syncLocks: '&ownerId,expiresAt'
    });

    this.version(6).stores({
      workouts: '[ownerId+id],id,ownerId,date,split,updatedAt',
      settings: '&theme',
      appSettings: '[ownerId+id],ownerId,updatedAt',
      goals: '[ownerId+id],id,ownerId,type',
      customExercises: '[ownerId+id],id,ownerId,name,bodyPart,category,updatedAt',
      syncQueue: '[ownerId+id],id,ownerId,type,createdAt',
      activeWorkoutSnapshots: '[ownerId+id],ownerId,updatedAt',
      bodyweightEntries: '[ownerId+id],id,ownerId,date,updatedAt',
      backupSnapshots: '[ownerId+id],id,ownerId,createdAt,trigger',
      syncLocks: '&ownerId,expiresAt',
      authStorage: '&key,updatedAt'
    });
  }
}

export const db = new TitanTrackDatabase();
