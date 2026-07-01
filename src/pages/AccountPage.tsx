import { useEffect, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppStore } from '../hooks/useAppStore';
import { getPendingCloudOperations, uploadAllLocalDataToCloud } from '../services/cloudSyncService';
import { getSupabaseClient } from '../lib/supabase';

export const AccountPage = () => {
  const { user, loading, error, signIn, signUp, signOut, requestPasswordReset, updatePassword, clearError } = useAuthStore();
  const attemptSync = useAppStore((state) => state.attemptSync);
  const lastSync = useAppStore((state) => state.lastSync);
  const syncing = useAppStore((state) => state.syncing);
  const isOnline = useAppStore((state) => state.isOnline);
  const settings = useAppStore((state) => state.settings);
  const workouts = useAppStore((state) => state.workouts);
  const ownerId = useAppStore((state) => state.ownerId);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [status, setStatus] = useState('');
  const [pendingOps, setPendingOps] = useState(0);
  const authAvailable = Boolean(getSupabaseClient());

  useEffect(() => {
    const loadPending = async () => {
      setPendingOps(await getPendingCloudOperations(ownerId));
    };

    void loadPending();
    const timer = window.setInterval(() => {
      void loadPending();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [ownerId]);

  const handleSignIn = async () => {
    clearError();
    setStatus('');
    if (!authAvailable) {
      setStatus('Authentication is unavailable. Configure Supabase keys and reload the app.');
      return;
    }
    if (!email.trim() || !password) {
      setStatus('Enter your email and password to sign in.');
      return;
    }
    await signIn(email.trim(), password);
    const authError = useAuthStore.getState().error;
    setStatus(authError ? 'Sign in failed. Check your credentials and try again.' : 'Sign in successful.');
  };

  const handleSignUp = async () => {
    clearError();
    setStatus('');
    if (!authAvailable) {
      setStatus('Authentication is unavailable. Configure Supabase keys and reload the app.');
      return;
    }
    if (!email.trim() || !password) {
      setStatus('Enter your email and password to create an account.');
      return;
    }
    await signUp(email.trim(), password);
    const authError = useAuthStore.getState().error;
    setStatus(authError ? 'Sign up failed. Review the error and try again.' : 'Sign up submitted. Check your email for verification if enabled.');
  };

  const handleForgotPassword = async () => {
    clearError();
    setStatus('');
    if (!authAvailable) {
      setStatus('Authentication is unavailable. Configure Supabase keys and reload the app.');
      return;
    }
    if (!email.trim()) {
      setStatus('Enter your account email to request a reset link.');
      return;
    }
    await requestPasswordReset(email.trim());
    const authError = useAuthStore.getState().error;
    setStatus(authError ? 'Password reset request failed. Please try again.' : 'Password reset email sent if account exists.');
  };

  const handleResetPassword = async () => {
    clearError();
    setStatus('');
    if (!authAvailable) {
      setStatus('Authentication is unavailable. Configure Supabase keys and reload the app.');
      return;
    }
    if (!resetPassword) {
      setStatus('Enter a new password before resetting.');
      return;
    }
    await updatePassword(resetPassword);
    const authError = useAuthStore.getState().error;
    setStatus(authError ? 'Password reset failed. Review the error and try again.' : 'Password updated successfully.');
  };

  const handleUploadLocalData = async () => {
    if (!user) {
      return;
    }

    await uploadAllLocalDataToCloud(user.id);
    await attemptSync();
    setStatus('Local data upload triggered.');
  };

  const syncStatusLabel = (() => {
    if (!isOnline) return 'Offline';
    if (syncing) return 'Syncing...';
    if (pendingOps > 0) return 'Pending Upload';
    if (lastSync) return 'Synced';
    return 'Idle';
  })();

  return (
    <div className="space-y-4">
      <SectionCard title="Account" subtitle="Authenticate to sync workouts across devices">
        {!user ? (
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="muted">Email</span>
              <input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="muted">Password</span>
              <input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void handleSignIn()} disabled={loading}>Sign In</button>
              <button type="button" className="btn-subtle" onClick={() => void handleSignUp()} disabled={loading}>Sign Up</button>
              <button type="button" className="btn-subtle" onClick={() => void handleForgotPassword()} disabled={loading}>Forgot Password</button>
            </div>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="muted">New Password (after reset link)</span>
              <div className="flex gap-2">
                <input className="field" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                <button type="button" className="btn-subtle" onClick={() => void handleResetPassword()} disabled={loading}>Reset</button>
              </div>
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm"><span className="muted">Signed in as:</span> {user.email}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void attemptSync()} disabled={!isOnline || syncing}>Sync Now</button>
              <button type="button" className="btn-subtle" onClick={() => void handleUploadLocalData()} disabled={syncing || workouts.length === 0}>Upload Local History</button>
              <button type="button" className="btn-subtle" onClick={() => void signOut()} disabled={loading}>Log Out</button>
            </div>
          </div>
        )}

        {(error || status) && <p className="muted mt-2 text-sm">{error || status}</p>}
      </SectionCard>

      <SectionCard title="Sync Status" subtitle="Cloud synchronization health">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="card p-3">
            <p className="muted text-xs">Status</p>
            <p className="font-semibold">{syncStatusLabel}</p>
          </div>
          <div className="card p-3">
            <p className="muted text-xs">Last Sync Time</p>
            <p className="font-semibold">{lastSync ? new Date(lastSync).toLocaleString() : 'Never'}</p>
          </div>
          <div className="card p-3">
            <p className="muted text-xs">Pending Sync Operations</p>
            <p className="font-semibold">{pendingOps}</p>
          </div>
          <div className="card p-3">
            <p className="muted text-xs">Cloud Backup Status</p>
            <p className="font-semibold">{settings.cloudSyncEnabled ? 'Automatic backup enabled' : 'Disabled'}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
