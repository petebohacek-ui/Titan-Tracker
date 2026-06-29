import type { WorkoutSplit } from '../types/workout';

const mapping: Record<string, WorkoutSplit> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
  'full-body': 'Full Body',
  cardio: 'Cardio'
};

export const splitFromSlug = (slug: string | undefined): WorkoutSplit => {
  if (!slug) return 'Push';
  return mapping[slug] ?? 'Push';
};

export const splitToSlug = (split: WorkoutSplit) => split.toLowerCase().replace(' ', '-');
