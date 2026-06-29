import { db } from '../database/db';
import type { SyncOperation, SyncOperationType } from '../database/db';

const NETWORK_KEY = 'titan-track-last-sync';

const syncOperationToCloud = async (operation: SyncOperation): Promise<void> => {
  const endpoint = import.meta.env.VITE_SYNC_ENDPOINT;
  // Local-only mode: queue acts as durable operation journal.
  if (!endpoint) {
    return;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation)
  });

  if (!response.ok) {
    throw new Error(`Sync request failed (${response.status})`);
  }
};

export const enqueueSync = async (type: SyncOperationType, payload: unknown) => {
  await db.syncQueue.put({
    id: crypto.randomUUID(),
    type,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString()
  });
};

export const flushSyncQueue = async (): Promise<number> => {
  if (!navigator.onLine) {
    return 0;
  }

  const operations = (await db.syncQueue.toArray()).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  if (operations.length === 0) {
    return 0;
  }

  let synced = 0;
  for (const operation of operations) {
    try {
      await syncOperationToCloud(operation);
      await db.syncQueue.delete(operation.id);
      synced += 1;
    } catch (error) {
      console.error('Failed to sync operation', operation.type, error);
      // Keep remaining operations queued for future retries.
      break;
    }
  }

  if (synced > 0) {
    localStorage.setItem(NETWORK_KEY, new Date().toISOString());
  }
  return synced;
};

export const getLastSyncTimestamp = (): string | null => localStorage.getItem(NETWORK_KEY);
