import type { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

interface SectionCardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export const SectionCard = ({ title, subtitle, action, className, children }: SectionCardProps) => (
  <section className={clsx('card p-4', className)}>
    {(title || subtitle || action) && (
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="muted text-sm">{subtitle}</p>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
);
