import { createClient } from '@supabase/supabase-js';
import { db } from '../database/db';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const __setSupabaseClientForTesting = (client: ReturnType<typeof createClient> | null) => {
  supabaseClient = client;
};

const buildAuthStorageAdapter = () => ({
  getItem: async (key: string): Promise<string | null> => {
    try {
      const record = await db.authStorage.get(key);
      return record?.value ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await db.authStorage.put({ key, value, updatedAt: new Date().toISOString() });
    } catch {
      // Ignore storage adapter failures and let auth continue in-memory.
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await db.authStorage.delete(key);
    } catch {
      // Ignore storage adapter failures and let auth continue in-memory.
    }
  }
});

export const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'titan-track-auth',
      storage: buildAuthStorageAdapter()
    }
  });

  return supabaseClient;
};
