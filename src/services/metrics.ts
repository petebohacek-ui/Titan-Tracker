import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks
} from 'date-fns';
import type { Insight, PersonalRecord, WorkoutSession } from '../types/workout';
import { estimateOneRepMax, movingAverage, workoutAverageIntensity, workoutVolume } from '../utils/math';

export interface KPIData {
  totalWorkouts: number;
  currentStreak: number;
  totalWeightLifted: number;
  weeklyVolume: number;
  monthlyVolume: number;
  highestLift: { exercise: string; weight: number } | null;
  newestPr: PersonalRecord | null;
  favoriteExercise: string;
  averageWorkoutDuration: number;
  averageWeeklyWorkouts: number;
  recoveryScore: number;
  consistencyScore: number;
}

export interface AnalyticsData {
  kpis: KPIData;
  personalRecords: PersonalRecord[];
  insights: Insight[];
  weeklyVolumeSeries: Array<{ label: string; volume: number }>;
  monthlyVolumeSeries: Array<{ label: string; volume: number }>;
  volumeByExercise: Array<{ name: string; volume: number }>;
  volumeByMuscle: Array<{ name: string; volume: number }>;
  volumeBySplit: Array<{ split: string; volume: number }>;
  strengthSeries: Array<{ date: string; exercise: string; est1RM: number }>;
  workoutCalendar: Array<{ date: string; count: number }>;
  frequencySeries: Array<{ label: string; workouts: number }>;
  durationSeries: Array<{ date: string; duration: number; rolling7: number; rolling30: number }>;
  intensitySeries: Array<{ date: string; intensity: number; rolling7: number; rolling30: number }>;
  prTimeline: Array<{ date: string; count: number }>;
  topLifts: Array<{ exercise: string; weight: number }>;
}

const safeRound = (value: number) => Math.round(value * 10) / 10;

const getCurrentStreak = (sessions: WorkoutSession[]): number => {
  if (sessions.length === 0) {
    return 0;
  }

  const dates = [...new Set(sessions.map((session) => session.date))].sort((a, b) => (a > b ? -1 : 1));
  let streak = 0;
  let cursor = new Date();

  for (const dateStr of dates) {
    const date = parseISO(dateStr);
    const diff = differenceInCalendarDays(cursor, date);
    if (diff > 2 && streak > 0) {
      break;
    }
    if (diff <= 2) {
      streak += 1;
      cursor = date;
    }
  }

  return streak;
};

const collectPRs = (sessions: WorkoutSession[]): PersonalRecord[] => {
  const bestByExercise = new Map<string, number>();
  const prs: PersonalRecord[] = [];

  sessions
    .slice()
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .forEach((session) => {
      session.exercises.forEach((exercise) => {
        exercise.sets.forEach((set) => {
          const est1RM = estimateOneRepMax(set.weight, set.reps);
          const previousBest = bestByExercise.get(exercise.name) ?? 0;
          if (est1RM > previousBest) {
            bestByExercise.set(exercise.name, est1RM);
            prs.push({
              id: crypto.randomUUID(),
              exerciseName: exercise.name,
              date: session.date,
              weight: set.weight,
              reps: set.reps,
              estimated1RM: est1RM
            });
          }
        });
      });
    });

  return prs;
};

const sumVolumeInInterval = (sessions: WorkoutSession[], from: Date, to: Date): number =>
  safeRound(
    sessions
      .filter((session) => isWithinInterval(parseISO(session.date), { start: from, end: to }))
      .reduce((sum, session) => sum + workoutVolume(session), 0)
  );

const rollingSeries = (sessions: WorkoutSession[]) => {
  const sorted = sessions.slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  const durationValues = sorted.map((session) => session.durationMinutes);
  const intensityValues = sorted.map((session) => workoutAverageIntensity(session));

  const duration7 = movingAverage(durationValues, 7);
  const duration30 = movingAverage(durationValues, 30);
  const intensity7 = movingAverage(intensityValues, 7);
  const intensity30 = movingAverage(intensityValues, 30);

  return {
    duration: sorted.map((session, idx) => ({
      date: session.date,
      duration: session.durationMinutes,
      rolling7: duration7[idx],
      rolling30: duration30[idx]
    })),
    intensity: sorted.map((session, idx) => ({
      date: session.date,
      intensity: intensityValues[idx],
      rolling7: intensity7[idx],
      rolling30: intensity30[idx]
    }))
  };
};

export const buildAnalytics = (sessions: WorkoutSession[]): AnalyticsData => {
  const now = new Date();
  const weeklyVolume = sumVolumeInInterval(sessions, startOfWeek(now), endOfWeek(now));
  const monthlyVolume = sumVolumeInInterval(sessions, startOfMonth(now), endOfMonth(now));
  const allVolume = sessions.reduce((sum, session) => sum + workoutVolume(session), 0);

  const liftEntries = sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({ exercise: exercise.name, weight: set.weight }))
    )
  );

  const highestLift = liftEntries.sort((a, b) => b.weight - a.weight)[0] ?? null;

  const exerciseFrequency = sessions
    .flatMap((session) => session.exercises.map((exercise) => exercise.name))
    .reduce<Record<string, number>>((acc, exerciseName) => {
      acc[exerciseName] = (acc[exerciseName] ?? 0) + 1;
      return acc;
    }, {});

  const favoriteExercise =
    Object.entries(exerciseFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No exercise yet';

  const personalRecords = collectPRs(sessions);
  const newestPr = personalRecords[personalRecords.length - 1] ?? null;

  const weeksTracked = Math.max(1, differenceInCalendarDays(now, parseISO(sessions[0]?.date ?? now.toISOString())) / 7);
  const averageWeeklyWorkouts = safeRound(sessions.length / weeksTracked);
  const averageWorkoutDuration = safeRound(
    sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / Math.max(1, sessions.length)
  );

  const averageIntensity = safeRound(
    sessions.reduce((sum, session) => sum + workoutAverageIntensity(session), 0) / Math.max(1, sessions.length)
  );
  const recoveryScore = Math.max(40, Math.min(98, safeRound(100 - averageIntensity * 0.45 + 12)));
  const consistencyScore = Math.max(35, Math.min(100, safeRound(averageWeeklyWorkouts * 22)));

  const volumeByExerciseMap = new Map<string, number>();
  const volumeByMuscleMap = new Map<string, number>();
  const volumeBySplitMap = new Map<string, number>();

  sessions.forEach((session) => {
    const sessionVolume = workoutVolume(session);
    volumeBySplitMap.set(session.split, (volumeBySplitMap.get(session.split) ?? 0) + sessionVolume);

    session.exercises.forEach((exercise) => {
      const volume = exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
      volumeByExerciseMap.set(exercise.name, (volumeByExerciseMap.get(exercise.name) ?? 0) + volume);
      volumeByMuscleMap.set(exercise.bodyPart, (volumeByMuscleMap.get(exercise.bodyPart) ?? 0) + volume);
    });
  });

  const weeklyVolumeSeries = Array.from({ length: 12 }, (_, i) => {
    const from = startOfWeek(subWeeks(now, 11 - i));
    const to = endOfWeek(subWeeks(now, 11 - i));
    return {
      label: format(from, 'MMM d'),
      volume: sumVolumeInInterval(sessions, from, to)
    };
  });

  const monthlyVolumeSeries = Array.from({ length: 8 }, (_, i) => {
    const month = subMonths(now, 7 - i);
    return {
      label: format(month, 'MMM yy'),
      volume: sumVolumeInInterval(sessions, startOfMonth(month), endOfMonth(month))
    };
  });

  const strengthSeries = sessions.flatMap((session) =>
    session.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        date: session.date,
        exercise: exercise.name,
        est1RM: estimateOneRepMax(set.weight, set.reps)
      }))
    )
  );

  const last120Days = eachDayOfInterval({ start: subDays(now, 119), end: now });
  const workoutCalendar = last120Days.map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    count: sessions.filter((session) => session.date === format(day, 'yyyy-MM-dd')).length
  }));

  const frequencySeries = Array.from({ length: 12 }, (_, i) => {
    const from = startOfWeek(subWeeks(now, 11 - i));
    const to = endOfWeek(subWeeks(now, 11 - i));
    return {
      label: format(from, 'MMM d'),
      workouts: sessions.filter((session) => isWithinInterval(parseISO(session.date), { start: from, end: to })).length
    };
  });

  const prTimelineMap = personalRecords.reduce<Record<string, number>>((acc, pr) => {
    const key = format(parseISO(pr.date), 'MMM yy');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const prTimeline = Object.entries(prTimelineMap).map(([date, count]) => ({ date, count }));

  const topLifts = liftEntries
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map((lift) => ({ exercise: lift.exercise, weight: lift.weight }));

  const rolling = rollingSeries(sessions);

  const insights: Insight[] = [];
  if (newestPr) {
    insights.push({ id: 'pr', type: 'success', message: `New PR detected: ${newestPr.exerciseName} estimated 1RM ${newestPr.estimated1RM} lbs.` });
  }

  const pullVolume = (volumeBySplitMap.get('Pull') ?? 0) + (volumeBySplitMap.get('Upper') ?? 0);
  const pushVolume = (volumeBySplitMap.get('Push') ?? 0) + (volumeBySplitMap.get('Upper') ?? 0);
  if (pullVolume > pushVolume * 1.2) {
    insights.push({ id: 'balance', type: 'info', message: 'Your pull volume has exceeded push volume by 20%+' });
  }

  const muscleVolumes = Array.from(volumeByMuscleMap.entries());
  const underTrained = muscleVolumes.sort((a, b) => a[1] - b[1]).slice(0, 2).map((entry) => entry[0]);
  if (underTrained.length > 0) {
    insights.push({ id: 'undertrained', type: 'warning', message: `Potential under-trained areas: ${underTrained.join(', ')}.` });
  }

  const trendWindow = weeklyVolumeSeries.slice(-8);
  if (trendWindow.length >= 2) {
    const first = trendWindow[0].volume;
    const last = trendWindow[trendWindow.length - 1].volume;
    if (first > 0 && last <= first * 1.03) {
      insights.push({ id: 'plateau', type: 'warning', message: 'Weekly volume has plateaued over the last 8 weeks. Consider progressive overload or variation.' });
    }
  }

  return {
    kpis: {
      totalWorkouts: sessions.length,
      currentStreak: getCurrentStreak(sessions),
      totalWeightLifted: safeRound(allVolume),
      weeklyVolume,
      monthlyVolume,
      highestLift,
      newestPr,
      favoriteExercise,
      averageWorkoutDuration,
      averageWeeklyWorkouts,
      recoveryScore,
      consistencyScore
    },
    personalRecords,
    insights,
    weeklyVolumeSeries,
    monthlyVolumeSeries,
    volumeByExercise: Array.from(volumeByExerciseMap.entries()).map(([name, volume]) => ({ name, volume: safeRound(volume) })),
    volumeByMuscle: Array.from(volumeByMuscleMap.entries()).map(([name, volume]) => ({ name, volume: safeRound(volume) })),
    volumeBySplit: Array.from(volumeBySplitMap.entries()).map(([split, volume]) => ({ split, volume: safeRound(volume) })),
    strengthSeries,
    workoutCalendar,
    frequencySeries,
    durationSeries: rolling.duration,
    intensitySeries: rolling.intensity,
    prTimeline,
    topLifts
  };
};
