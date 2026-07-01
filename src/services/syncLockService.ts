import { db } from '../database/db';

const SYNC_LOCK_TTL_MS = 60_000;

const nowIso = () => new Date().toISOString();

export const acquireSyncLease = async (ownerId: string, token: string): Promise<boolean> => {
  const nowMs = Date.now();
  const expiresAt = new Date(nowMs + SYNC_LOCK_TTL_MS).toISOString();
  let acquired = false;

  await db.transaction('rw', [db.syncLocks], async () => {
    const current = await db.syncLocks.get(ownerId);
    const currentExpiryMs = current ? Date.parse(current.expiresAt) : 0;

    if (current && current.token !== token && currentExpiryMs > nowMs) {
      acquired = false;
      return;
    }

    await db.syncLocks.put({
      ownerId,
      token,
      lockedAt: nowIso(),
      expiresAt
    });
    acquired = true;
  });

  return acquired;
};

export const releaseSyncLease = async (ownerId: string, token: string): Promise<void> => {
  await db.transaction('rw', [db.syncLocks], async () => {
    const current = await db.syncLocks.get(ownerId);
    if (!current || current.token !== token) {
      return;
    }
    await db.syncLocks.delete(ownerId);
  });
};
