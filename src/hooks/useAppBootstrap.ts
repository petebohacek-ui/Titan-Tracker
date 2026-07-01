import { useEffect } from 'react';
import { useAppStore } from './useAppStore';
import { useAuthStore } from './useAuthStore';
import { LOCAL_ANON_OWNER_ID } from '../database/db';

export const useAppBootstrap = () => {
  const initialize = useAppStore((state) => state.initialize);
  const setOwnerContext = useAppStore((state) => state.setOwnerContext);
  const attemptSync = useAppStore((state) => state.attemptSync);
  const setOnline = useAppStore((state) => state.setOnline);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    void initialize();
    void initializeAuth();
  }, [initialize, initializeAuth]);

  useEffect(() => {
    const onlineHandler = () => {
      setOnline(true);
      void attemptSync();
    };
    const offlineHandler = () => setOnline(false);

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, [attemptSync, setOnline]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void attemptSync();
    }, 2 * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [attemptSync]);

  useEffect(() => {
    if (session) {
      void attemptSync();
    }
  }, [attemptSync, session]);

  useEffect(() => {
    void setOwnerContext(user?.id ?? LOCAL_ANON_OWNER_ID);
  }, [setOwnerContext, user?.id]);
};
