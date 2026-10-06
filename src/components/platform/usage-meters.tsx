import { cn } from "@/lib/utils";
import {
  LIMIT_LABEL,
  USAGE_KEYS,
  USAGE_LEVEL_LABEL,
  usageLevel,
  type CommercialState,
} from "@/lib/platform";

const BAR: Record<string, string> = {
  normal: "bg-foreground/70",
  aviso: "bg-amber-400",
  atencao: "bg-amber-600",
  limite: "bg-destructive",
};

/** Consumo real x limite do plano (contagens feitas no banco). */
export function UsageMeters({ state, compact = false }: { state: CommercialState; compact?: boolean }) {
  return (
    <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {USAGE_KEYS.map((key) => {
        const used = Number(state.usage?.[key] ?? 0);
        const raw = state.limits?.[key];
        const limit = raw === null || raw === undefined ? null : Number(raw);
        const level = usageLevel(used, limit);
        const pct = limit === null ? 0 : limit <= 0 ? 100 : Math.min(100, (used / limit) * 100);
        const unit = key === "storage_mb" ? " MB" : "";
        return (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {LIMIT_LABEL[key]}
              </span>
              {level !== "normal" && (
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    level === "limite" ? "text-destructive" : "text-amber-600",
                  )}
                >
                  {USAGE_LEVEL_LABEL[level]}
                </span>
              )}
            </div>
            <div className="mt-2 font-display text-xl tabular-nums">
              {used.toLocaleString("pt-BR")}
              {unit}
              <span className="text-sm text-muted-foreground">
                {" / "}
                {limit === null ? "Ilimitado" : `${limit.toLocaleString("pt-BR")}${unit}`}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", BAR[level])} style={{ width: `${limit === null ? 0 : pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
