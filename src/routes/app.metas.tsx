import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { BRL, NUM } from "@/lib/format";

export const Route = createFileRoute("/app/metas")({
  head: () => ({
    meta: [
      { title: "Metas — GBS" },
      {
        name: "description",
        content: "Metas anuais: Receita, Lucro, Palestras, Empresas, Pessoas e Livros.",
      },
    ],
  }),
  component: MetasPage,
});

type Goals = {
  revenue: number;
  profit: number;
  lectures: number;
  companies: number;
  audience: number;
  books: number;
};

const DEFAULT_GOALS: Goals = {
  revenue: 0,
  profit: 0,
  lectures: 0,
  companies: 0,
  audience: 0,
  books: 0,
};

function storageKey(org: string, year: number) {
  return `gbs.goals.${org}.${year}`;
}

function loadGoals(org: string, year: number): Goals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(storageKey(org, year));
    if (!raw) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GOALS;
  }
}

function useRealized(org: string | null, year: number) {
  return useQuery({
    queryKey: ["metas-realizado", org, year],
    enabled: !!org,
    queryFn: async () => {
      const orgId = org!;
      const start = new Date(year, 0, 1).toISOString();
      const end = new Date(year + 1, 0, 1).toISOString();
      const [snapshots, lectures, companies, stockOut] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("lecture_financial_snapshots")
            .select("gross_revenue, net_profit, closed_at")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .gte("closed_at", start)
            .lt("closed_at", end),
        ),
        fetchAll(() =>
          supabase
            .from("lectures")
            .select("id, actual_audience, scheduled_at")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .eq("status", "realizada")
            .gte("scheduled_at", start)
            .lt("scheduled_at", end),
        ),
        supabase
          .from("companies")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("archived_at", null)
          .gte("created_at", start)
          .lt("created_at", end),
        fetchAll(() =>
          supabase
            .from("stock_movements")
            .select("quantity")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .eq("direction", "out")
            .gte("occurs_at", start)
            .lt("occurs_at", end),
        ),
      ]);
      const sumN = (rows: any[] | null, key: string) =>
        (rows ?? []).reduce((a, r) => a + Number(r?.[key] ?? 0), 0);
      return {
        revenue: sumN(snapshots.data as any, "gross_revenue"),
        profit: sumN(snapshots.data as any, "net_profit"),
        lectures: (lectures.data ?? []).length,
        companies: companies.count ?? 0,
        audience: (lectures.data ?? []).reduce(
          (a: number, r: any) => a + (r.actual_audience ?? 0),
          0,
        ),
        books: sumN(stockOut.data as any, "quantity"),
      };
    },
  });
}

function GoalCard({
  label,
  unit,
  meta,
  realized,
  onChange,
}: {
  label: string;
  unit: "brl" | "num";
  meta: number;
  realized: number;
  onChange: (n: number) => void;
}) {
  const fmt = (v: number) => (unit === "brl" ? BRL.format(v) : NUM.format(v));
  const pct = meta > 0 ? Math.min(100, (realized / meta) * 100) : 0;
  const missing = Math.max(0, meta - realized);
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Meta</Label>
          <Input
            type="number"
            value={meta || ""}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="mt-1 h-9"
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Realizado</Label>
          <div className="mt-1 font-display text-lg leading-none">{fmt(realized)}</div>
        </div>
      </div>
      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--gold)" }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{pct.toFixed(1)}%</span>
          <span>Falta: {fmt(missing)}</span>
        </div>
      </div>
    </div>
  );
}

function MetasPage() {
  const { organizationId } = useCurrentOrg();
  const [year, setYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const { data: realized } = useRealized(organizationId, year);

  useEffect(() => {
    if (!organizationId) return;
    setGoals(loadGoals(organizationId, year));
  }, [organizationId, year]);

  function save() {
    if (!organizationId) return;
    window.localStorage.setItem(storageKey(organizationId, year), JSON.stringify(goals));
  }

  const items = useMemo(
    () => [
      { key: "revenue" as const, label: "Receita", unit: "brl" as const },
      { key: "profit" as const, label: "Lucro", unit: "brl" as const },
      { key: "lectures" as const, label: "Palestras", unit: "num" as const },
      { key: "companies" as const, label: "Empresas", unit: "num" as const },
      { key: "audience" as const, label: "Pessoas Impactadas", unit: "num" as const },
      { key: "books" as const, label: "Livros Utilizados", unit: "num" as const },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Gestão"
        title="Metas"
        description={`Defina objetivos anuais e acompanhe o progresso em tempo real (${year}).`}
        actions={
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || year)}
              className="h-9 w-24"
            />
            <Button variant="brand" size="sm" onClick={save}>
              <Save className="mr-2 h-3.5 w-3.5" />
              Salvar metas
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <GoalCard
            key={it.key}
            label={it.label}
            unit={it.unit}
            meta={goals[it.key]}
            realized={(realized as any)?.[it.key] ?? 0}
            onChange={(n) => setGoals((g) => ({ ...g, [it.key]: n }))}
          />
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Metas ficam armazenadas neste navegador por organização/ano. O realizado é calculado com
        dados reais do GBS.
      </p>
    </div>
  );
}
