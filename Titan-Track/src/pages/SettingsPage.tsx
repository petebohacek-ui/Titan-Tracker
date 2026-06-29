import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';

export const SettingsPage = () => {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const exportBackupCsv = useAppStore((state) => state.exportBackupCsv);
  const importBackup = useAppStore((state) => state.importBackup);
  const clearAllData = useAppStore((state) => state.clearAllData);
  const clearDemoData = useAppStore((state) => state.clearDemoData);

  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const reminderEntries = useMemo(() => Object.entries(draft.reminders), [draft.reminders]);

  const saveSettings = async () => {
    await updateSettings(draft);
    setStatus('Settings saved.');
  };

  const toggleReminder = (key: keyof typeof draft.reminders) => {
    setDraft((current) => ({
      ...current,
      reminders: {
        ...current.reminders,
        [key]: !current.reminders[key]
      }
    }));
  };

  const downloadBackup = () => {
    const content = exportBackup();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `titan-track-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('Backup exported.');
  };

  const onImport = async (file: File) => {
    try {
      const content = await file.text();
      await importBackup(content);
      setStatus('Import complete. Data restored.');
    } catch {
      setStatus('Import failed. Backup file format is invalid.');
    }
  };

  const downloadCsvBackup = () => {
    const content = exportBackupCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `titan-track-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus('CSV export complete.');
  };

  const onClearDemo = async () => {
    if (!window.confirm('Clear demo data?')) return;
    await clearDemoData();
    await updateSettings({ ...draft, useDemoData: false });
    setStatus('Demo data cleared.');
  };

  const onClearUserData = async () => {
    if (!window.confirm('Clear all user data? This action cannot be undone.')) return;
    await clearAllData();
    setStatus('All user data cleared.');
  };

  return (
    <div className="space-y-4">
      <SectionCard title="General" subtitle="Theme, display mode, units, and app behavior">
        <div className="grid gap-2 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="muted">Theme</span>
            <select className="field" value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as typeof draft.theme })}>
              <option value="system">System</option>
              <option value="dark">Dark Mode</option>
              <option value="light">Light Mode</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="muted">Units</span>
            <select className="field" value={draft.weightUnit} onChange={(event) => setDraft({ ...draft, weightUnit: event.target.value as typeof draft.weightUnit })}>
              <option value="lbs">lb</option>
              <option value="kg">kg</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="muted">Rest Timer Default (seconds)</span>
            <input
              className="field"
              type="number"
              min={15}
              max={900}
              value={draft.restTimerDefaultSeconds}
              onChange={(event) => setDraft({ ...draft, restTimerDefaultSeconds: Math.max(15, Number(event.target.value) || 15) })}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <label className="card flex items-center justify-between px-3 py-2 text-sm"><span>Notifications</span><input type="checkbox" checked={draft.notificationsEnabled} onChange={(event) => setDraft({ ...draft, notificationsEnabled: event.target.checked })} /></label>
          <label className="card flex items-center justify-between px-3 py-2 text-sm"><span>Demo Data</span><input type="checkbox" checked={draft.useDemoData} onChange={(event) => setDraft({ ...draft, useDemoData: event.target.checked })} /></label>
          <label className="card flex items-center justify-between px-3 py-2 text-sm"><span>Bodyweight Tracking</span><input type="checkbox" checked={draft.bodyweightTrackingEnabled} onChange={(event) => setDraft({ ...draft, bodyweightTrackingEnabled: event.target.checked })} /></label>
          <label className="card flex items-center justify-between px-3 py-2 text-sm"><span>Developer Tools</span><input type="checkbox" checked={draft.developerToolsEnabled} onChange={(event) => setDraft({ ...draft, developerToolsEnabled: event.target.checked })} /></label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void saveSettings()}>Save Preferences</button>
        </div>
      </SectionCard>

      <SectionCard title="Notifications" subtitle="Workout reminders and coaching alerts">
        <div className="grid gap-2 md:grid-cols-2">
          {reminderEntries.map(([key, value]) => (
            <label key={key} className="card flex items-center justify-between px-3 py-2 text-sm">
              <span>{key}</span>
              <input type="checkbox" checked={value} onChange={() => toggleReminder(key as keyof typeof draft.reminders)} />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Data" subtitle="Export, import, backup, restore, and cleanup">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={downloadBackup}>Export Data</button>
          <button type="button" className="btn-subtle" onClick={downloadCsvBackup}>Export CSV</button>
          <label className="btn-subtle cursor-pointer">
            Import Data
            <input
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onImport(file);
                }
              }}
            />
          </label>
          <button type="button" className="btn-subtle" onClick={downloadBackup}>Backup</button>
          <label className="btn-subtle cursor-pointer">
            Restore
            <input
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onImport(file);
                }
              }}
            />
          </label>
          <button type="button" className="btn-subtle" onClick={() => void onClearDemo()}>Clear Demo Data</button>
          <button type="button" className="btn-subtle text-[var(--danger)]" onClick={() => void onClearUserData()}>Clear User Data</button>
        </div>
      </SectionCard>

      <SectionCard title="Cloud Sync" subtitle="Future-ready cloud integration controls">
        <label className="card flex items-center justify-between px-3 py-2 text-sm">
          <span>Cloud Sync Enabled</span>
          <input type="checkbox" checked={draft.cloudSyncEnabled} onChange={(event) => setDraft({ ...draft, cloudSyncEnabled: event.target.checked })} />
        </label>
        <p className="muted mt-2 text-xs">Cloud sync queueing is active locally. Remote endpoint wiring can be connected without schema changes.</p>
      </SectionCard>

      <SectionCard title="App" subtitle="Version and runtime info">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="card p-3">
            <p className="muted text-xs">App Version</p>
            <p className="font-semibold">{draft.appVersion}</p>
          </div>
          <div className="card p-3">
            <p className="muted text-xs">Theme Mode</p>
            <p className="font-semibold">{draft.theme}</p>
          </div>
        </div>
      </SectionCard>

      {status && <p className="muted text-sm">{status}</p>}
    </div>
  );
};
