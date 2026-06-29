import type { PropsWithChildren } from 'react';
import { SectionCard } from './SectionCard';

interface ChartCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export const ChartCard = ({ title, subtitle, children }: ChartCardProps) => (
  <SectionCard title={title} subtitle={subtitle}>
    <div style={{ width: '100%', height: 260 }}>{children}</div>
  </SectionCard>
);
