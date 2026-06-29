import { useEffect, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAuthStore } from '../hooks/useAuthStore';
import { useAppStore } from '../hooks/useAppStore';
import { getPendingCloudOperations, uploadAllLocalDataToCloud } from '../services/cloudSyncService';

export const AccountPage = () => {
  const { user, loading, error, signIn, signUp, signOut, requestPasswordReset, updatePassword, clearError } = useAuthStore();
  const attemptSync = useAppStore((state) => state.attemptSync);
  const lastSync = useAppStore((state) => state.lastSync);
  const syncing = useAppStore((state) => state.syncing);
  const isOnline = useAppStore((state) => state.isOnline);
  const settings = useAppStore((state) => state.settings);
  const workouts = useAppStore((state) => state.workouts);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [status, setStatus] = useState('');
  const [pendingOps, setPendingOps] = useState(0);

  useEffect(() => {
    const loadPending = async () => {
      setPendingOps(await getPendingCloudOperations());
    };

    void loadPending();
    const timer = window.setInterval(() => {
      void loadPending();
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  const handleSignIn = async () => {
    clearError();
    await signIn(email.trim(), password);
    setStatus('Sign in attempt complete.');
  };

  const handleSignUp = async () => {
    clearError();
    await signUp(email.trim(), password);
    setStatus('Sign up submitted. Check your email for verification if enabled.');
  };

  const handleForgotPassword = async () => {
    clearError();
    await requestPasswordReset(email.trim());
    setStatus('Password reset email sent if account exists.');
  };

  const handleResetPassword = async () => {
    clearError();
    await updatePassword(resetPassword);
    setStatus('Password update attempted.');
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
