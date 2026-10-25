import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { isVoidMovement } from "@/lib/stock";
import { NUM } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 365, label: "12 meses" },
] as const;

type ItemInfo = { id: string; name: string; category: string | null; unit: string | null };

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Ranking do que mais sai do estoque (saídas e baixas efetivas),
 * com tendência contra o período anterior e previsão de quando acaba.
 */
export function TopMovers({
  organizationId,
  items,
  availableById,
}: {
  organizationId: string;
  items: ItemInfo[];
  availableById: Map<string, number>;
}) {
  const [days, setDays] = useState<number>(90);

  const outs = useQuery({
    queryKey: ["stock-top-movers", organizationId, days],
    queryFn: async () => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("stock_movements")
          .select("stock_item_id, kind, direction, status, quantity, occurs_on")
          .eq("organization_id", organizationId)
          .eq("direction", "out")
          .in("kind", ["saida", "baixa"])
          .gte("occurs_on", isoDaysAgo(days * 2))
          .is("archived_at", null),
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const ranking = useMemo(() => {
    const since = isoDaysAgo(days);
    const now = new Map<string, number>();
    const before = new Map<string, number>();
    for (const m of outs.data ?? []) {
      if (!m.stock_item_id || isVoidMovement(m.status, m.kind)) continue;
      const q = Number(m.quantity ?? 0);
      const bucket = (m.occurs_on ?? "") >= since ? now : before;
      bucket.set(m.stock_item_id, (bucket.get(m.stock_item_id) ?? 0) + q);
    }
    const byId = new Map(items.map((i) => [i.id, i]));
    const total = [...now.values()].reduce((s, v) => s + v, 0);
    return [...now.entries()]
      .map(([id, qty]) => {
        const prev = before.get(id) ?? 0;
        const perDay = qty / days;
        const available = availableById.get(id) ?? 0;
        return {
          id,
          item: byId.get(id),
          qty,
          share: total ? qty / total : 0,
          trend: prev ? (qty - prev) / prev : null,
          daysLeft: perDay > 0 ? Math.floor(available / perDay) : null,
        };
      })
      .filter((r) => r.item)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [outs.data, items, availableById, days]);

  const max = ranking[0]?.qty ?? 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-clay">
            <Flame className="h-3.5 w-3.5" /> Mais saem
          </div>
          <h2 className="mt-1 font-display text-xl">O que mais está saindo do estoque</h2>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                days === p.days
                  ? "bg-card text-foreground shadow-[var(--shadow-elegant)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {outs.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : ranking.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma saída registrada nos últimos {days} dias.
        </p>
      ) : (
        <ol className="space-y-4">
          {ranking.map((r, i) => (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  to="/app/estoque/$id"
                  params={{ id: r.id }}
                  className="min-w-0 truncate text-sm font-medium hover:text-clay"
                >
                  <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {r.item!.name}
                  {r.item!.category && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                      {r.item!.category}
                    </span>
                  )}
                </Link>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  {r.trend !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5",
                        r.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600",
                      )}
                      title="Comparado ao período anterior"
                    >
                      {r.trend >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(Math.round(r.trend * 100))}%
                    </span>
                  )}
                  <span className="font-medium tabular-nums">
                    {NUM.format(r.qty)} {r.item!.unit ?? "un"}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-clay transition-[width] duration-700"
                    style={{ width: `${max ? (r.qty / max) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground">
                  {r.daysLeft === null
                    ? `${Math.round(r.share * 100)}% das saídas`
                    : r.daysLeft <= 0
                      ? "sem saldo"
                      : `acaba em ~${r.daysLeft} dias`}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
