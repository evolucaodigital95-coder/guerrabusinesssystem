import { cn } from "@/lib/utils";

/** Símbolo GBS: monograma em argila, usado no menu lateral, login e favicon visual. */
export function GbsGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-clay font-display text-[19px] leading-none text-clay-foreground shadow-[inset_0_-1px_0_oklch(0_0_0/0.12)]",
        className,
      )}
    >
      G
    </span>
  );
}

export function GbsMark({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";
  return (
    <div className="flex items-center gap-3">
      <GbsGlyph />
      <div className="leading-none">
        <div
          className={cn(
            "font-display text-[19px] tracking-[-0.02em]",
            isLight ? "text-ink-foreground" : "text-foreground",
          )}
        >
          GBS
        </div>
        <div
          className={cn(
            "mt-1 text-[11px]",
            isLight ? "text-ink-foreground/55" : "text-muted-foreground",
          )}
        >
          Guerra Business System
        </div>
      </div>
    </div>
  );
}
