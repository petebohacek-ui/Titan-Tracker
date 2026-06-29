import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppStore } from './hooks/useAppStore';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkoutSplitPage } from './pages/WorkoutSplitPage';
import { HomePage } from './pages/HomePage';
import { ActiveWorkoutPage } from './pages/ActiveWorkoutPage';
import { WorkoutSummaryPage } from './pages/WorkoutSummaryPage';
import { HistoryPage } from './pages/HistoryPage';
import { GoalsPage } from './pages/GoalsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { OverTimePage } from './pages/OverTimePage';
import { ExerciseDetailPage } from './pages/ExerciseDetailPage';
import { AccountPage } from './pages/AccountPage';

const App = () => {
  useAppBootstrap();
  const initialized = useAppStore((state) => state.initialized);
  const theme = useAppStore((state) => state.settings.theme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('theme-dark');
    } else {
      root.classList.remove('theme-dark');
    }
  }, [theme]);

  if (!initialized) {
    return (
      <div className="app-shell">
        <div className="card p-6 text-center">Preparing your training database...</div>
      </div>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/workout/active" element={<ActiveWorkoutPage />} />
        <Route path="/workout/summary" element={<WorkoutSummaryPage />} />
        <Route path="/history/:split" element={<WorkoutSplitPage />} />
        <Route path="/library" element={<ExerciseLibraryPage />} />
        <Route path="/exercise/:exerciseName" element={<ExerciseDetailPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/over-time" element={<OverTimePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/account" element={<AccountPage />} />
        {/* Legacy redirect */}
        <Route path="/workouts/:split" element={<Navigate to="/history" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
