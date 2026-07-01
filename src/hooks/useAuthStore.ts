import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';

const SENSITIVE_AUTH_KEYS = new Set([
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'type',
  'provider_token',
  'provider_refresh_token'
]);

const scrubSensitiveAuthParams = () => {
  const url = new URL(window.location.href);
  let changed = false;

  if (url.hash.startsWith('#')) {
    const hashParams = new URLSearchParams(url.hash.slice(1));
    for (const key of Array.from(hashParams.keys())) {
      if (SENSITIVE_AUTH_KEYS.has(key)) {
        hashParams.delete(key);
        changed = true;
      }
    }
    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
  }

  for (const key of Array.from(url.searchParams.keys())) {
    if (SENSITIVE_AUTH_KEYS.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  if (changed) {
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

interface AuthStore {
  initialized: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  error?: string;
  initializeAuth: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthStore>((set) => ({
  initialized: false,
  loading: false,
  user: null,
  session: null,

  initializeAuth: async () => {
    scrubSensitiveAuthParams();

    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ initialized: true });
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ initialized: true, error: error.message });
      return;
    }

    set({ initialized: true, session: data.session, user: data.session?.user ?? null, error: undefined });

    if (!authSubscription) {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null, error: undefined });
      });
      authSubscription = listener.subscription;
    }
  },

  signUp: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }

    if (password.length < 10) {
      set({ error: 'Password must be at least 10 characters.' });
      return;
    }

    set({ loading: true, error: undefined });
    const { error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
    set({ loading: false, error: error?.message });
  },

  signIn: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }

    set({ loading: true, error: undefined });
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    set({ loading: false, error: error?.message });
  },

  requestPasswordReset: async (email) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }

    set({ loading: true, error: undefined });
    const redirectTo = `${window.location.origin}/account`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
    set({ loading: false, error: error?.message });
  },

  updatePassword: async (password) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: 'Supabase is not configured.' });
      return;
    }

    if (password.length < 10) {
      set({ error: 'Password must be at least 10 characters.' });
      return;
    }

    set({ loading: true, error: undefined });
    const { error } = await supabase.auth.updateUser({ password });
    set({ loading: false, error: error?.message });
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ session: null, user: null, error: undefined });
      return;
    }

    set({ loading: true, error: undefined });
    const { error } = await supabase.auth.signOut();
    set({ loading: false, error: error?.message, session: error ? undefined : null, user: error ? undefined : null });
  },

  clearError: () => set({ error: undefined })
}));
