// @ts-nocheck
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';

import { db } from '../src/database/db';
import { enqueueSync } from '../src/services/syncService';
import { pullCloudChanges, pushQueuedCloudChanges } from '../src/services/cloudSyncService';
import { __setSupabaseClientForTesting } from '../src/lib/supabase';

type Phase = 'initial' | 'reconnect';

type Metric = {
  phase: Phase;
  action: 'select' | 'upsert' | 'delete';
  table: string;
  latencyMs: number;
  requestBytes: number;
  responseBytes: number;
  rows: number;
};

const WORKLOADS = [100, 500, 1000];
const OWNER_ID = 'bench-user';

const byteLen = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseInFilter = (value: string): Set<string> => {
  const ids = new Set<string>();
  const matches = value.match(/"([^"]+)"/g) ?? [];
  for (const token of matches) {
    ids.add(token.slice(1, -1));
  }
  return ids;
};

class MockSupabaseQuery {
  private filters: Array<{ type: 'eq'; field: string; value: unknown } | { type: 'not-in'; field: string; values: Set<string> }> = [];
  private limitValue: number | null = null;
  private mode: 'select' | 'delete' | null = null;

  constructor(private parent: MockSupabase, private table: string) {}

  select(_columns = '*') {
    this.mode = 'select';
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  upsert(payload: unknown, _options?: unknown) {
    return this.parent.execute('upsert', this.table, this.filters, this.limitValue, payload);
  }

  eq(field: string, value: unknown) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  not(field: string, operator: string, value: string) {
    if (operator === 'in') {
      this.filters.push({ type: 'not-in', field, values: parseInFilter(value) });
    }
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  then(resolve: (value: unknown) => void, reject: (reason?: unknown) => void) {
    const action = this.mode === 'delete' ? 'delete' : 'select';
    return this.parent.execute(action, this.table, this.filters, this.limitValue).then(resolve, reject);
  }
}

class MockSupabase {
  private phase: Phase = 'initial';
  private readonly tables = new Map<string, any[]>();
  readonly metrics: Metric[] = [];

  setPhase(phase: Phase) {
    this.phase = phase;
  }

  resetMetrics() {
    this.metrics.length = 0;
  }

  seed(table: string, rows: any[]) {
    this.tables.set(table, rows.map((row) => ({ ...row })));
  }

  from(table: string) {
    return new MockSupabaseQuery(this, table);
  }

  private keyForRow(table: string, row: any): string {
    if (row.id) {
      return String(row.id);
    }

    if (table === 'settings') {
      return String(row.user_id);
    }

    if (table === 'workout_splits') {
      return `${row.user_id}:${row.split}`;
    }

    if (table === 'backup_snapshots') {
      return String(row.id);
    }

    return JSON.stringify(row);
  }

  private applyFilters(rows: any[], filters: Array<{ type: 'eq'; field: string; value: unknown } | { type: 'not-in'; field: string; values: Set<string> }>): any[] {
    return rows.filter((row) => {
      for (const filter of filters) {
        if (filter.type === 'eq') {
          if (row[filter.field] !== filter.value) {
            return false;
          }
        }

        if (filter.type === 'not-in') {
          const value = String(row[filter.field] ?? '');
          if (filter.values.has(value)) {
            return false;
          }
        }
      }
      return true;
    });
  }

  async execute(
    action: 'select' | 'upsert' | 'delete',
    table: string,
    filters: Array<{ type: 'eq'; field: string; value: unknown } | { type: 'not-in'; field: string; values: Set<string> }>,
    limitValue: number | null,
    payload?: unknown
  ) {
    const start = performance.now();
    const tableRows = this.tables.get(table) ?? [];

    const requestBytes = byteLen({ table, action, filters, payload, limit: limitValue });
    let responseBytes = 0;
    let rows = 0;
    let result: any = null;

    if (action === 'select') {
      const filtered = this.applyFilters(tableRows, filters);
      const selected = typeof limitValue === 'number' ? filtered.slice(0, limitValue) : filtered;
      rows = selected.length;
      responseBytes = byteLen(selected);
      result = { data: selected, error: null };
    }

    if (action === 'upsert') {
      const incoming = Array.isArray(payload) ? payload : [payload];
      rows = incoming.length;
      const indexByKey = new Map(tableRows.map((row, index) => [this.keyForRow(table, row), index]));
      for (const row of incoming) {
        const key = this.keyForRow(table, row);
        const existingIndex = indexByKey.get(key);
        if (typeof existingIndex === 'number') {
          tableRows[existingIndex] = { ...tableRows[existingIndex], ...row };
        } else {
          tableRows.push({ ...row });
        }
      }
      this.tables.set(table, tableRows);
      result = { data: null, error: null };
    }

    if (action === 'delete') {
      const toDelete = this.applyFilters(tableRows, filters);
      rows = toDelete.length;
      const deleteKeys = new Set(toDelete.map((row) => this.keyForRow(table, row)));
      const retained = tableRows.filter((row) => !deleteKeys.has(this.keyForRow(table, row)));
      this.tables.set(table, retained);
      result = { data: null, error: null };
    }

    // Latency model: RTT + transfer time + light server processing.
    const baseRttMs = action === 'select' ? 35 : 30;
    const transferMs = ((requestBytes + responseBytes) / 15_000_000) * 1000;
    const serverMs = Math.min(800, rows * (action === 'select' ? 0.004 : 0.007));
    const latencyMs = baseRttMs + transferMs + serverMs;

    await sleep(latencyMs);

    const elapsed = performance.now() - start;
    this.metrics.push({
      phase: this.phase,
      action,
      table,
      latencyMs: elapsed,
      requestBytes,
      responseBytes,
      rows
    });

    return result;
  }
}

const generateData = (workoutCount: number, ownerId: string) => {
  const workouts: any[] = [];
  const workoutSets: any[] = [];

  const baseDate = new Date('2024-01-01T08:00:00.000Z').getTime();

  for (let i = 0; i < workoutCount; i += 1) {
    const id = `w-${i}`;
    const date = new Date(baseDate + i * 86_400_000);
    const updatedAt = new Date(baseDate + i * 86_400_000 + 45 * 60_000).toISOString();

    workouts.push({
      id,
      user_id: ownerId,
      date: date.toISOString().slice(0, 10),
      split: i % 2 === 0 ? 'Push' : 'Pull',
      duration_minutes: 60,
      total_volume: 12000 + (i % 500),
      completed: true,
      notes: i % 7 === 0 ? 'Felt strong' : null,
      created_at: date.toISOString(),
      updated_at: updatedAt
    });

    for (let ex = 0; ex < 3; ex += 1) {
      const exerciseId = `ex-${ex}`;
      const exerciseName = `Exercise ${ex + 1}`;
      for (let s = 0; s < 3; s += 1) {
        workoutSets.push({
          id: `${id}-e${ex}-s${s}`,
          workout_id: id,
          user_id: ownerId,
          exercise_id: exerciseId,
          exercise_name: exerciseName,
          body_part: ex % 2 === 0 ? 'Chest' : 'Back',
          category: ex % 2 === 0 ? 'Compound' : 'Isolation',
          set_index: s,
          reps: 6 + s,
          weight: 135 + ex * 10 + s * 5,
          rpe: 8,
          rest_seconds: 120,
          notes: null,
          updated_at: updatedAt
        });
      }
    }
  }

  const goals = Array.from({ length: 12 }, (_, i) => ({
    id: `goal-${i}`,
    user_id: ownerId,
    label: `Goal ${i + 1}`,
    type: 'Weekly Workout Goal',
    target: 4,
    progress: i % 4,
    unit: 'sessions',
    updated_at: nowIso()
  }));

  const customExercises = Array.from({ length: 120 }, (_, i) => ({
    id: `custom-${i}`,
    user_id: ownerId,
    name: `Custom Exercise ${i + 1}`,
    body_part: 'Arms',
    category: 'Isolation',
    primary_splits: ['Push'],
    is_custom: true,
    created_at: nowIso(),
    updated_at: nowIso()
  }));

  const bodyweightRows = Array.from({ length: Math.min(1500, Math.max(90, Math.floor(workoutCount * 0.2))) }, (_, i) => ({
    id: `bw-${i}`,
    user_id: ownerId,
    date: new Date(baseDate + i * 86_400_000).toISOString().slice(0, 10),
    weight: 180 - i * 0.01,
    note: i % 30 === 0 ? 'weekly check' : null,
    created_at: nowIso(),
    updated_at: nowIso()
  }));

  return {
    workouts,
    workoutSets,
    goals,
    customExercises,
    bodyweightRows,
    settings: [
      {
        user_id: ownerId,
        payload: {
          theme: 'system',
          weightUnit: 'lbs',
          reminders: {
            workoutReminders: true,
            prCelebrations: true,
            streakReminders: true,
            recoverySuggestions: true,
            missedWorkoutNotifications: true,
            goalProgressUpdates: true
          },
          cloudSyncEnabled: true,
          useDemoData: false,
          notificationsEnabled: true,
          restTimerDefaultSeconds: 120,
          bodyweightTrackingEnabled: true,
          appVersion: '1.0.0',
          developerToolsEnabled: false
        },
        updated_at: nowIso()
      }
    ]
  };
};

const clearOwnerData = async (ownerId: string) => {
  await db.transaction(
    'rw',
    [
      db.workouts,
      db.appSettings,
      db.goals,
      db.customExercises,
      db.bodyweightEntries,
      db.syncQueue,
      db.activeWorkoutSnapshots,
      db.backupSnapshots,
      db.syncLocks
    ],
    async () => {
      const workoutKeys = (await db.workouts.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];
      const goalKeys = (await db.goals.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];
      const customKeys = (await db.customExercises.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];
      const bodyweightKeys = (await db.bodyweightEntries.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];
      const queueKeys = (await db.syncQueue.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];
      const backupKeys = (await db.backupSnapshots.where('ownerId').equals(ownerId).primaryKeys()) as [string, string][];

      if (workoutKeys.length) await db.workouts.bulkDelete(workoutKeys);
      if (goalKeys.length) await db.goals.bulkDelete(goalKeys);
      if (customKeys.length) await db.customExercises.bulkDelete(customKeys);
      if (bodyweightKeys.length) await db.bodyweightEntries.bulkDelete(bodyweightKeys);
      if (queueKeys.length) await db.syncQueue.bulkDelete(queueKeys);
      if (backupKeys.length) await db.backupSnapshots.bulkDelete(backupKeys);
      await db.appSettings.delete([ownerId, 'app']);
      await db.activeWorkoutSnapshots.delete([ownerId, 'current']);
      await db.syncLocks.delete(ownerId);
    }
  );
};

const summarizeQueryLatency = (metrics: Metric[], phase: Phase) => {
  const selected = metrics.filter((entry) => entry.phase === phase);
  const grouped = new Map<string, Metric[]>();

  for (const metric of selected) {
    const key = `${metric.action}:${metric.table}`;
    const list = grouped.get(key) ?? [];
    list.push(metric);
    grouped.set(key, list);
  }

  return Array.from(grouped.entries()).map(([key, values]) => {
    const sorted = values.map((entry) => entry.latencyMs).sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0;
    const avg = sorted.reduce((sum, n) => sum + n, 0) / Math.max(1, sorted.length);
    return { key, avgMs: avg, p95Ms: p95, calls: values.length };
  });
};

const measureIndexedDbQueries = async (ownerId: string) => {
  const timings: Record<string, number[]> = {
    workoutsReadMs: [],
    goalsReadMs: [],
    customReadMs: [],
    bodyweightReadMs: [],
    settingsGetMs: []
  };

  for (let i = 0; i < 5; i += 1) {
    let start = performance.now();
    await db.workouts.where('ownerId').equals(ownerId).toArray();
    timings.workoutsReadMs.push(performance.now() - start);

    start = performance.now();
    await db.goals.where('ownerId').equals(ownerId).toArray();
    timings.goalsReadMs.push(performance.now() - start);

    start = performance.now();
    await db.customExercises.where('ownerId').equals(ownerId).toArray();
    timings.customReadMs.push(performance.now() - start);

    start = performance.now();
    await db.bodyweightEntries.where('ownerId').equals(ownerId).toArray();
    timings.bodyweightReadMs.push(performance.now() - start);

    start = performance.now();
    await db.appSettings.get([ownerId, 'app']);
    timings.settingsGetMs.push(performance.now() - start);
  }

  const average = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / Math.max(1, arr.length);

  return {
    workoutsReadMs: average(timings.workoutsReadMs),
    goalsReadMs: average(timings.goalsReadMs),
    customReadMs: average(timings.customReadMs),
    bodyweightReadMs: average(timings.bodyweightReadMs),
    settingsGetMs: average(timings.settingsGetMs)
  };
};

const estimateBatteryImpact = (cpuMs: number, networkMB: number) => {
  // Conservative proxy model for mobile impact; not a hardware measurement.
  const estimatedMilliWattHours = cpuMs * 0.0012 + networkMB * 1.9;
  let band = 'Low';
  if (estimatedMilliWattHours > 18) {
    band = 'High';
  } else if (estimatedMilliWattHours > 7) {
    band = 'Medium';
  }
  return {
    estimatedMilliWattHours,
    band
  };
};

const runScenario = async (workoutCount: number, supabase: MockSupabase) => {
  console.log(`\n[${workoutCount}] Preparing dataset...`);
  await clearOwnerData(OWNER_ID);

  const remote = generateData(workoutCount, OWNER_ID);
  supabase.seed('workouts', remote.workouts);
  supabase.seed('workout_sets', remote.workoutSets);
  supabase.seed('goals', remote.goals);
  supabase.seed('settings', remote.settings);
  supabase.seed('custom_exercises', remote.customExercises);
  supabase.seed('bodyweight_history', remote.bodyweightRows);
  supabase.seed('workout_splits', []);
  supabase.seed('backup_snapshots', []);

  const heapStartInitial = process.memoryUsage().heapUsed;
  const cpuStartInitial = process.cpuUsage();
  const wallStartInitial = performance.now();
  supabase.setPhase('initial');
  console.log(`[${workoutCount}] Running initial pull...`);
  await pullCloudChanges(OWNER_ID);
  const initialMs = performance.now() - wallStartInitial;
  const cpuInitial = process.cpuUsage(cpuStartInitial);
  const heapAfterInitial = process.memoryUsage().heapUsed;

  console.log(`[${workoutCount}] Measuring IndexedDB read performance...`);
  const queryPerf = await measureIndexedDbQueries(OWNER_ID);

  const localWorkouts = await db.workouts.where('ownerId').equals(OWNER_ID).toArray();
  const mutationCount = Math.min(200, Math.max(10, Math.floor(workoutCount * 0.01)));
  const deleteCount = Math.floor(mutationCount * 0.2);
  const updateCount = mutationCount - deleteCount;

  for (let i = 0; i < updateCount; i += 1) {
    const item = localWorkouts[i];
    if (!item) {
      continue;
    }
    const updated = {
      ...item,
      totalVolume: (item.totalVolume ?? 0) + 150,
      updatedAt: nowIso(),
      notes: 'offline update'
    };
    await db.workouts.put(updated);
    await enqueueSync(OWNER_ID, 'UPDATE_WORKOUT', updated);
  }

  for (let i = 0; i < deleteCount; i += 1) {
    const item = localWorkouts[updateCount + i];
    if (!item) {
      continue;
    }
    await db.workouts.delete([OWNER_ID, item.id]);
    await enqueueSync(OWNER_ID, 'DELETE_WORKOUT', { id: item.id });
  }

  for (let i = 0; i < deleteCount; i += 1) {
    const source = localWorkouts[i];
    if (!source) {
      continue;
    }
    const id = `new-${workoutCount}-${i}`;
    const created = {
      ...source,
      id,
      ownerId: OWNER_ID,
      date: nowIso().slice(0, 10),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      notes: 'offline created'
    };
    await db.workouts.put(created);
    await enqueueSync(OWNER_ID, 'CREATE_WORKOUT', created);
  }

  console.log(`[${workoutCount}] Simulating offline mutations and reconnect sync...`);
  const heapStartReconnect = process.memoryUsage().heapUsed;
  const cpuStartReconnect = process.cpuUsage();
  const wallStartReconnect = performance.now();
  supabase.setPhase('reconnect');
  await pushQueuedCloudChanges(OWNER_ID);
  await pullCloudChanges(OWNER_ID);
  const reconnectMs = performance.now() - wallStartReconnect;
  const cpuReconnect = process.cpuUsage(cpuStartReconnect);
  const heapAfterReconnect = process.memoryUsage().heapUsed;

  const initialMetrics = supabase.metrics.filter((entry) => entry.phase === 'initial');
  const reconnectMetrics = supabase.metrics.filter((entry) => entry.phase === 'reconnect');

  const bytesInitial = initialMetrics.reduce((sum, entry) => sum + entry.requestBytes + entry.responseBytes, 0);
  const bytesReconnect = reconnectMetrics.reduce((sum, entry) => sum + entry.requestBytes + entry.responseBytes, 0);

  const batteryInitial = estimateBatteryImpact((cpuInitial.user + cpuInitial.system) / 1000, bytesInitial / 1024 / 1024);
  const batteryReconnect = estimateBatteryImpact((cpuReconnect.user + cpuReconnect.system) / 1000, bytesReconnect / 1024 / 1024);

  console.log(`[${workoutCount}] Complete. initial=${initialMs.toFixed(0)}ms reconnect=${reconnectMs.toFixed(0)}ms`);

  return {
    workoutCount,
    initial: {
      wallMs: initialMs,
      cpuMs: (cpuInitial.user + cpuInitial.system) / 1000,
      heapDeltaMB: (heapAfterInitial - heapStartInitial) / (1024 * 1024),
      networkMB: bytesInitial / 1024 / 1024,
      battery: batteryInitial
    },
    reconnect: {
      wallMs: reconnectMs,
      cpuMs: (cpuReconnect.user + cpuReconnect.system) / 1000,
      heapDeltaMB: (heapAfterReconnect - heapStartReconnect) / (1024 * 1024),
      networkMB: bytesReconnect / 1024 / 1024,
      battery: batteryReconnect
    },
    indexedDb: queryPerf,
    supabaseLatency: {
      initial: summarizeQueryLatency(supabase.metrics, 'initial'),
      reconnect: summarizeQueryLatency(supabase.metrics, 'reconnect')
    }
  };
};

const printSummary = (results: any[]) => {
  const header = [
    'workouts',
    'initial_sync_ms',
    'reconnect_ms',
    'idb_workouts_read_ms',
    'initial_network_mb',
    'reconnect_network_mb',
    'initial_cpu_ms',
    'reconnect_cpu_ms',
    'battery_initial',
    'battery_reconnect'
  ];

  console.log('\nSync profiling summary');
  console.log(header.join('\t'));

  for (const result of results) {
    console.log(
      [
        result.workoutCount,
        result.initial.wallMs.toFixed(0),
        result.reconnect.wallMs.toFixed(0),
        result.indexedDb.workoutsReadMs.toFixed(1),
        result.initial.networkMB.toFixed(2),
        result.reconnect.networkMB.toFixed(2),
        result.initial.cpuMs.toFixed(0),
        result.reconnect.cpuMs.toFixed(0),
        `${result.initial.battery.estimatedMilliWattHours.toFixed(1)}mWh (${result.initial.battery.band})`,
        `${result.reconnect.battery.estimatedMilliWattHours.toFixed(1)}mWh (${result.reconnect.battery.band})`
      ].join('\t')
    );
  }
};

const main = async () => {
  const supabase = new MockSupabase();
  __setSupabaseClientForTesting(supabase as any);

  const results: any[] = [];

  for (const workload of WORKLOADS) {
    supabase.resetMetrics();
    const workloadStart = performance.now();
    const result = await runScenario(workload, supabase);
    results.push(result);
    console.log(`[${workload}] Total scenario wall time ${(performance.now() - workloadStart).toFixed(0)}ms`);
  }

  const outDir = path.resolve('profile-results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sync-profile.json'), JSON.stringify({ generatedAt: nowIso(), results }, null, 2), 'utf8');

  printSummary(results);
  console.log(`\nDetailed results written to ${path.join('profile-results', 'sync-profile.json')}`);

  __setSupabaseClientForTesting(null as any);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
