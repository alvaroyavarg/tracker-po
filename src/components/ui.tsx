import clsx from "clsx";
import { STATUS_COLORS } from "@/lib/types";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "bg-zinc-100 text-zinc-600 ring-zinc-500/20";
  return <span className={clsx("badge", cls)}>{status}</span>;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-12 flex flex-col items-center text-center gap-3">
      {icon && <div className="text-zinc-300">{icon}</div>}
      <div>
        <p className="font-medium text-ink">{title}</p>
        {hint && <p className="text-sm text-ink-muted mt-1 max-w-sm">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-accent animate-spin" />
      {label}
    </div>
  );
}
