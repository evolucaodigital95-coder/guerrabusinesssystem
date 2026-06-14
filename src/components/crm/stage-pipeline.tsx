import { LIFECYCLE_STAGES, stageIndex } from "@/lib/crm";
import { cn } from "@/lib/utils";

export function StagePipeline({ stage }: { stage: string | null | undefined }) {
  const current = stageIndex(stage);
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Etapa do relacionamento
      </p>
      <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3">
        {LIFECYCLE_STAGES.map((s, i) => {
          const reached = i <= current;
          const isCurrent = i === current;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold transition-colors",
                    reached
                      ? "border-transparent bg-[var(--navy)] text-[var(--navy-foreground)]"
                      : "border-border bg-background text-muted-foreground",
                    isCurrent && "ring-2 ring-offset-2 ring-offset-background",
                  )}
                  style={isCurrent ? { boxShadow: "0 0 0 2px var(--gold)" } : undefined}
                >
                  {i + 1}
                </span>
                <span className={cn("text-xs", reached ? "text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </div>
              {i < LIFECYCLE_STAGES.length - 1 && (
                <span className={cn("h-px w-6", reached ? "bg-[var(--navy)]/40" : "bg-border")} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
