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

const getEntityId = (type: SyncOperationType, payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  switch (type) {
    case 'CREATE_WORKOUT':
    case 'UPDATE_WORKOUT':
    case 'DELETE_WORKOUT':
    case 'UPSERT_GOAL':
    case 'DELETE_GOAL':
    case 'UPSERT_CUSTOM_EXERCISE':
    case 'DELETE_CUSTOM_EXERCISE':
    case 'UPSERT_BODYWEIGHT':
    case 'DELETE_BODYWEIGHT':
    case 'BACKUP_SNAPSHOT':
      return String((payload as { id?: string }).id ?? '');
    case 'UPDATE_SETTINGS':
      return 'app-settings';
    default:
      return null;
  }
};

export const enqueueSync = async (ownerId: string, type: SyncOperationType, payload: unknown) => {
  const entityId = getEntityId(type, payload);
  if (entityId) {
    const pending = await db.syncQueue.where('ownerId').equals(ownerId).toArray();
    const malformed: string[] = [];
    const redundant = pending
      .filter((op) => {
        try {
          const currentPayload = JSON.parse(op.payload);
          const currentEntityId = getEntityId(op.type, currentPayload);
          return currentEntityId === entityId;
        } catch {
          malformed.push(op.id);
          return false;
        }
      })
      .map((op) => op.id);

    if (malformed.length > 0) {
      await db.syncQueue.bulkDelete(malformed.map((id) => [ownerId, id]));
    }

    if (redundant.length > 0) {
      await db.syncQueue.bulkDelete(redundant.map((id) => [ownerId, id]));
    }
  }

  await db.syncQueue.put({
    id: crypto.randomUUID(),
    ownerId,
    type,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString()
  });
};

export const flushSyncQueue = async (ownerId: string): Promise<number> => {
  if (!navigator.onLine) {
    return 0;
  }

  const operations = (await db.syncQueue.where('ownerId').equals(ownerId).toArray()).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  if (operations.length === 0) {
    return 0;
  }

  let synced = 0;
  for (const operation of operations) {
    try {
      await syncOperationToCloud(operation);
      await db.syncQueue.delete([ownerId, operation.id]);
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
