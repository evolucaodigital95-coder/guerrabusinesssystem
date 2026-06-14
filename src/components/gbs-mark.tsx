export function GbsMark({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--gold)" }}
      />
      <div className="leading-none">
        <div
          className={`font-display text-xl ${isLight ? "text-[var(--navy-foreground)]" : "text-foreground"}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          GBS
        </div>
        <div
          className={`mt-1.5 text-[9px] uppercase tracking-[0.28em] ${
            isLight ? "text-[var(--navy-foreground)]/55" : "text-muted-foreground"
          }`}
        >
          Guerra Business System
        </div>
      </div>
    </div>
  );
}
