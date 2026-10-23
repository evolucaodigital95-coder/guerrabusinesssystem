import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-[12px] font-medium capitalize text-clay">{eyebrow}</div>}
        <h1
          className={cn(
            "font-display text-[2rem] leading-[1.1] md:text-[2.5rem]",
            eyebrow && "mt-2",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
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
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-8 py-20 text-center",
        className,
      )}
    >
      <span aria-hidden className="mb-6 grid h-10 w-10 place-items-center rounded-full bg-clay/10">
        <span className="h-2 w-2 rounded-full bg-clay" />
      </span>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button variant="brand" className="mt-8" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
