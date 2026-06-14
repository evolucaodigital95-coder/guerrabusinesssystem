export function GbsMark({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold"
        style={{
          background: "var(--gold)",
          color: "var(--gold-foreground)",
          boxShadow: "var(--shadow-gold)",
        }}
      >
        GBS
      </div>
      <div className="leading-tight">
        <div className={`text-base font-semibold tracking-tight ${isLight ? "text-[var(--navy-foreground)]" : "text-foreground"}`}>
          Guerra Business System
        </div>
        <div className={`text-[10px] uppercase tracking-[0.2em] ${isLight ? "text-[var(--navy-foreground)]/60" : "text-muted-foreground"}`}>
          Grupo Guerra
        </div>
      </div>
    </div>
  );
}
