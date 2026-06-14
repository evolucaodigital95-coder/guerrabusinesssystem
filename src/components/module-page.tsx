import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/page-shell";
import type { ModuleDef } from "@/lib/modules";

export function ModulePage({ module }: { module: ModuleDef }) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={module.section}
        title={module.label}
        description={module.description}
        actions={
          <Button variant="navy" size="sm" className="rounded-full px-5">
            {module.primaryAction}
          </Button>
        }
      />

      <div className="mb-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
        {["Total", "Ativos", "Este mês"].map((l) => (
          <div key={l} className="bg-card p-7">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{l}</div>
            <div className="mt-6 font-display text-[2rem] leading-none text-muted-foreground/40">—</div>
          </div>
        ))}
      </div>

      <EmptyState
        message={module.emptyMessage}
        actionLabel={module.primaryAction}
        onAction={() => {}}
      />
    </div>
  );
}
