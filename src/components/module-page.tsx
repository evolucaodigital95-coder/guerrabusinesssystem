import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/page-shell";
import type { ModuleDef } from "@/lib/modules";

export function ModulePage({ module }: { module: ModuleDef }) {
  const Icon = module.icon;
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={module.section}
        title={module.label}
        description={module.description}
        actions={
          <Button variant="navy" size="sm">
            <Icon className="h-4 w-4" />
            {module.primaryAction}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["Total", "Ativos", "Este mês"].map((l) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)]">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{l}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-muted-foreground/40">—</div>
          </div>
        ))}
      </div>

      <EmptyState
        icon={<FileSearch className="h-5 w-5" />}
        title="Tudo limpo por aqui"
        message={module.emptyMessage}
        actionLabel={module.primaryAction}
        onAction={() => {}}
      />
    </div>
  );
}
