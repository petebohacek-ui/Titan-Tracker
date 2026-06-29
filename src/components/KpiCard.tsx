interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
}

export const KpiCard = ({ label, value, hint }: KpiCardProps) => (
  <article className="card p-4">
    <p className="muted text-xs uppercase tracking-wider">{label}</p>
    <p className="metric-value mt-2">{value}</p>
    {hint && <p className="muted mt-1 text-xs">{hint}</p>}
  </article>
);
