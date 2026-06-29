import { useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAppStore } from '../hooks/useAppStore';
import type { Goal } from '../types/workout';

export const SettingsPage = () => {
  const settings = useAppStore((state) => state.settings);
  const goals = useAppStore((state) => state.goals);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const upsertGoal = useAppStore((state) => state.upsertGoal);
  const removeGoal = useAppStore((state) => state.removeGoal);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const importBackup = useAppStore((state) => state.importBackup);
  const clearAllData = useAppStore((state) => state.clearAllData);
  const clearDemoData = useAppStore((state) => state.clearDemoData);

  const [theme, setTheme] = useState(settings.theme);
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(settings.cloudSyncEnabled);
  const [useDemoData, setUseDemoData] = useState(settings.useDemoData);
  const [importStatus, setImportStatus] = useState('');
  const [draftGoal, setDraftGoal] = useState<Goal>({
    id: crypto.randomUUID(),
    label: 'New Goal',
    type: 'Weekly Workout Goal',
    target: 4,
    progress: 0,
    unit: 'sessions'
  });

  useEffect(() => {
    setTheme(settings.theme);
    setCloudSyncEnabled(settings.cloudSyncEnabled);
    setUseDemoData(settings.useDemoData ?? true);
  }, [settings]);

  const reminderEntries = useMemo(() => Object.entries(settings.reminders), [settings.reminders]);

  const saveThemeAndSync = async () => {
    await updateSettings({ ...settings, theme, cloudSyncEnabled, useDemoData });
  };

  const toggleReminder = async (key: keyof typeof settings.reminders) => {
    await updateSettings({
      ...settings,
      reminders: {
        ...settings.reminders,
        [key]: !settings.reminders[key]
      }
    });
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
  };

  const onImport = async (file: File) => {
    try {
      const content = await file.text();
      await importBackup(content);
      setImportStatus('Backup imported successfully.');
    } catch {
      setImportStatus('Import failed. Please verify backup file format.');
    }
  };

  const handleClearDemoData = async () => {
    if (window.confirm('Clear demo data? This will remove all demo workouts and cannot be undone.')) {
      await clearDemoData();
      await updateSettings({ ...settings, useDemoData: false });
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm('Clear ALL data? This will permanently delete all workouts and cannot be undone.')) {
      await clearAllData();
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="App Settings" subtitle="Theme, sync preferences, and reminders">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="muted">Theme</span>
            <select className="field" value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>

          <label className="card flex items-center justify-between px-3 text-sm">
            <span>Enable Cloud Sync</span>
            <input type="checkbox" checked={cloudSyncEnabled} onChange={(event) => setCloudSyncEnabled(event.target.checked)} />
          </label>

          <button className="btn-primary" type="button" onClick={() => void saveThemeAndSync()}>
            Save Preferences
          </button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {reminderEntries.map(([key, value]) => (
            <label key={key} className="card flex items-center justify-between px-3 py-2 text-sm">
              <span>{key}</span>
              <input type="checkbox" checked={value} onChange={() => void toggleReminder(key as keyof typeof settings.reminders)} />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Demo Data" subtitle="Manage demo and sample workouts">
        <div className="space-y-3">
          <label className="card flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">Use Demo Data</p>
              <p className="muted text-xs">Pre-populated workouts to explore the app</p>
            </div>
            <input
              type="checkbox"
              checked={useDemoData}
              onChange={(e) => {
                setUseDemoData(e.target.checked);
                void updateSettings({ ...settings, useDemoData: e.target.checked });
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-subtle text-sm" type="button" onClick={() => void handleClearDemoData()}>
              Clear Demo Data
            </button>
            <button className="btn-subtle text-sm text-[var(--danger)]" type="button" onClick={() => void handleClearAllData()}>
              Clear All My Data
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Goals" subtitle="Create and track performance goals">
        <div className="grid gap-2 md:grid-cols-5">
          <input className="field" value={draftGoal.label} onChange={(event) => setDraftGoal({ ...draftGoal, label: event.target.value })} placeholder="Goal label" />
          <select className="field" value={draftGoal.type} onChange={(event) => setDraftGoal({ ...draftGoal, type: event.target.value as Goal['type'] })}>
            <option>Target Bench</option>
            <option>Target Squat</option>
            <option>Target Deadlift</option>
            <option>Target Bodyweight</option>
            <option>Weekly Workout Goal</option>
            <option>Monthly Volume Goal</option>
            <option>Personal Record Goal</option>
          </select>
          <input className="field" type="number" value={draftGoal.target} onChange={(event) => setDraftGoal({ ...draftGoal, target: Number(event.target.value) })} placeholder="Target" />
          <input className="field" type="number" value={draftGoal.progress} onChange={(event) => setDraftGoal({ ...draftGoal, progress: Number(event.target.value) })} placeholder="Progress" />
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              void upsertGoal({ ...draftGoal, id: crypto.randomUUID() });
              setDraftGoal({ ...draftGoal, id: crypto.randomUUID() });
            }}
          >
            Add Goal
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {goals.map((goal) => (
            <div key={goal.id} className="card flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-semibold">{goal.label}</p>
                <p className="muted">{goal.progress}/{goal.target} {goal.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-subtle" type="button" onClick={() => void upsertGoal({ ...goal, progress: goal.progress + 1 })}>+1</button>
                <button className="btn-subtle" type="button" onClick={() => void removeGoal(goal.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Data Management" subtitle="Export, import, backup, and restore">
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="button" onClick={downloadBackup}>Export My Data</button>
          <label className="btn-subtle cursor-pointer">
            Import My Data
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
        </div>
        {importStatus && <p className="muted mt-2 text-sm">{importStatus}</p>}
      </SectionCard>
    </div>
  );
};
