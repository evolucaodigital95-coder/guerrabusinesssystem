import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-14 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
            {eyebrow}
          </div>
        )}
        <h1 className="mt-5 font-display text-4xl leading-tight md:text-5xl">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title = "Tudo limpo por aqui",
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-8 py-24 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="mb-8 block h-px w-10"
        style={{ background: "var(--gold)" }}
      />
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-10 inline-flex h-10 items-center justify-center rounded-full bg-[var(--navy)] px-6 text-sm font-medium text-[var(--navy-foreground)] transition-all duration-300 hover:opacity-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
