import Dexie, { type Table } from 'dexie';
import type { AppSettings, ExerciseDefinition, Goal, WorkoutSession } from '../types/workout';

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
  type: SyncOperationType;
  payload: string;
  createdAt: string;
}

export interface AppSettingsRecord {
  id: 'app';
  value: AppSettings;
  updatedAt: string;
}

export interface ActiveWorkoutSnapshotRecord {
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

export interface BackupSnapshotRecord {
  id: string;
  trigger: string;
  payload: string;
  createdAt: string;
}

class TitanTrackDatabase extends Dexie {
  workouts!: Table<WorkoutSession, string>;
  // Legacy table retained for migration safety.
  settings!: Table<AppSettings, string>;
  appSettings!: Table<AppSettingsRecord, string>;
  goals!: Table<Goal, string>;
  customExercises!: Table<ExerciseDefinition, string>;
  syncQueue!: Table<SyncOperation, string>;
  activeWorkoutSnapshots!: Table<ActiveWorkoutSnapshotRecord, string>;
  bodyweightEntries!: Table<BodyweightEntry, string>;
  backupSnapshots!: Table<BackupSnapshotRecord, string>;

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
  }
}

export const db = new TitanTrackDatabase();
