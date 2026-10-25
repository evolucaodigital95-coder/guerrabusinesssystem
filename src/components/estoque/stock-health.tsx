import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  CheckCircle2,
  ClipboardCheck,
  PackageX,
  ShoppingCart,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { balancesByItem, isVoidMovement } from "@/lib/stock";
import { NUM } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string; unit: string | null; min_quantity: number | null };
type Issue = {
  id: string;
  severity: "critico" | "atencao" | "info";
  icon: LucideIcon;
  title: string;
  detail: string;
  items?: { id: string; label: string; to?: "item" | "lecture" }[];
};

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Saúde do estoque: procura furos e riscos automaticamente —
 * saldo negativo, reserva maior que o saldo, saída sem palestra,
 * palestra sem baixa de material, falta iminente e inventário atrasado.
 */
export function StockHealth({
  organizationId,
  items,
  onStartCount,
}: {
  organizationId: string;
  items: Item[];
  onStartCount: () => void;
}) {
  const data = useQuery({
    queryKey: ["stock-health", organizationId],
    queryFn: async () => {
      const [movs, lectures] = await Promise.all([
        fetchAll(() =>
          supabase
            .from("stock_movements")
            .select(
              "id, stock_item_id, kind, direction, status, quantity, occurs_on, lecture_id, reason",
            )
            .eq("organization_id", organizationId)
            .is("archived_at", null),
        ),
        fetchAll(() =>
          supabase
            .from("lectures")
            .select("id, title, scheduled_at, status")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .gte("scheduled_at", isoDaysAgo(60))
            .lte("scheduled_at", new Date().toISOString()),
        ),
      ]);
      if (movs.error) throw movs.error;
      if (lectures.error) throw lectures.error;
      return { movs: movs.data, lectures: lectures.data };
    },
  });

  const issues = useMemo<Issue[]>(() => {
    if (!data.data) return [];
    const { movs, lectures } = data.data;
    const byId = new Map(items.map((i) => [i.id, i]));
    const balances = balancesByItem(movs);
    const list: Issue[] = [];
    const unit = (id: string) => byId.get(id)?.unit ?? "un";

    const negative = [...balances.entries()].filter(([id, b]) => b.onHand < 0 && byId.has(id));
    if (negative.length)
      list.push({
        id: "negative",
        severity: "critico",
        icon: AlertOctagon,
        title: `${negative.length} ${negative.length === 1 ? "material com saldo negativo" : "materiais com saldo negativo"}`,
        detail:
          "Saiu mais do que entrou. Falta registrar uma entrada ou houve saída em duplicidade.",
        items: negative.map(([id, b]) => ({
          id,
          label: `${byId.get(id)!.name} · ${NUM.format(b.onHand)} ${unit(id)}`,
          to: "item",
        })),
      });

    const overReserved = [...balances.entries()].filter(
      ([id, b]) => b.onHand >= 0 && b.available < 0 && byId.has(id),
    );
    if (overReserved.length)
      list.push({
        id: "reserved",
        severity: "critico",
        icon: PackageX,
        title: "Reservas maiores que o saldo",
        detail: "Há palestras com material reservado que não existe em estoque.",
        items: overReserved.map(([id, b]) => ({
          id,
          label: `${byId.get(id)!.name} · faltam ${NUM.format(-b.available)} ${unit(id)}`,
          to: "item",
        })),
      });

    // Consumo dos últimos 90 dias → previsão de falta e sugestão de compra (60 dias).
    const since90 = isoDaysAgo(90);
    const used = new Map<string, number>();
    for (const m of movs) {
      if (!m.stock_item_id || isVoidMovement(m.status, m.kind)) continue;
      if ((m.kind === "saida" || m.kind === "baixa") && (m.occurs_on ?? "") >= since90)
        used.set(m.stock_item_id, (used.get(m.stock_item_id) ?? 0) + Number(m.quantity ?? 0));
    }
    const ending: { id: string; label: string; to: "item" }[] = [];
    for (const [id, qty] of used) {
      const it = byId.get(id);
      const b = balances.get(id);
      if (!it || !b) continue;
      const perDay = qty / 90;
      const days = perDay > 0 ? b.available / perDay : Infinity;
      const min = Number(it.min_quantity ?? 0);
      if (days <= 30 || (min > 0 && b.onHand <= min)) {
        const buy = Math.max(0, Math.ceil(perDay * 60 + min - b.available));
        ending.push({
          id,
          label: `${it.name} · ${Number.isFinite(days) ? `acaba em ~${Math.max(0, Math.floor(days))} dias` : "abaixo do mínimo"} · comprar ~${NUM.format(buy)} ${unit(id)}`,
          to: "item",
        });
      }
    }
    for (const it of items) {
      const min = Number(it.min_quantity ?? 0);
      const b = balances.get(it.id);
      if (!used.has(it.id) && min > 0 && (b?.onHand ?? 0) <= min)
        ending.push({
          id: it.id,
          label: `${it.name} · abaixo do mínimo (${NUM.format(min)})`,
          to: "item",
        });
    }
    if (ending.length)
      list.push({
        id: "ending",
        severity: "atencao",
        icon: ShoppingCart,
        title: `Comprar em breve: ${ending.length} ${ending.length === 1 ? "material" : "materiais"}`,
        detail: "Pelo ritmo de saída dos últimos 90 dias, com sugestão para cobrir os próximos 60.",
        items: ending,
      });

    const orphan = movs.filter(
      (m) =>
        m.kind === "saida" &&
        !m.lecture_id &&
        !isVoidMovement(m.status, m.kind) &&
        (m.occurs_on ?? "") >= since90,
    );
    if (orphan.length)
      list.push({
        id: "orphan",
        severity: "atencao",
        icon: Unlink,
        title: `${orphan.length} ${orphan.length === 1 ? "saída sem palestra vinculada" : "saídas sem palestra vinculada"}`,
        detail: "Nos últimos 90 dias. Sem o vínculo, o custo não entra no resultado da palestra.",
        items: orphan.map((m) => ({
          id: m.stock_item_id ?? m.id,
          label: `${byId.get(m.stock_item_id ?? "")?.name ?? "Material"} · ${NUM.format(Number(m.quantity ?? 0))} em ${(m.occurs_on ?? "").split("-").reverse().join("/")}`,
          to: "item",
        })),
      });

    // Palestras já realizadas sem nenhuma saída de material (só se a organização costuma dar baixa).
    const usesMaterial = movs.some((m) => m.lecture_id && m.kind === "saida");
    if (usesMaterial) {
      const withOut = new Set(
        movs
          .filter((m) => m.lecture_id && (m.kind === "saida" || m.kind === "reserva"))
          .map((m) => m.lecture_id),
      );
      const missing = lectures.filter(
        (l) => !withOut.has(l.id) && l.status !== "cancelada" && l.status !== "lead",
      );
      if (missing.length)
        list.push({
          id: "no-out",
          severity: "info",
          icon: PackageX,
          title: `${missing.length} ${missing.length === 1 ? "palestra realizada sem baixa de material" : "palestras realizadas sem baixa de material"}`,
          detail: "Últimos 60 dias. Confira se o material usado foi registrado.",
          items: missing.map((l) => ({ id: l.id, label: l.title ?? "Palestra", to: "lecture" })),
        });
    }

    return list;
  }, [data.data, items]);

  const lastCount = useMemo(() => {
    const dates = (data.data?.movs ?? [])
      .filter((m) => m.kind === "ajuste" && (m.reason ?? "").startsWith("Inventário"))
      .map((m) => m.occurs_on ?? "")
      .sort();
    return dates.at(-1) ?? null;
  }, [data.data]);
  const daysSinceCount = lastCount
    ? Math.floor((Date.now() - new Date(`${lastCount}T12:00:00`).getTime()) / 86_400_000)
    : null;

  const critical = issues.filter((i) => i.severity === "critico").length;
  const score = Math.max(
    0,
    100 -
      critical * 25 -
      issues.filter((i) => i.severity === "atencao").length * 10 -
      issues.filter((i) => i.severity === "info").length * 5 -
      (daysSinceCount === null || daysSinceCount > 30 ? 10 : 0),
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={data.isLoading ? null : score} />
          <div>
            <div className="text-[12px] font-medium text-clay">Saúde do estoque</div>
            <h2 className="mt-1 font-display text-xl">
              {data.isLoading
                ? "Analisando movimentações…"
                : issues.length === 0
                  ? "Nenhum furo encontrado"
                  : `${issues.length} ${issues.length === 1 ? "ponto para conferir" : "pontos para conferir"}`}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {daysSinceCount === null
                ? "Nenhum inventário registrado ainda."
                : daysSinceCount === 0
                  ? "Último inventário: hoje."
                  : `Último inventário há ${daysSinceCount} ${daysSinceCount === 1 ? "dia" : "dias"}${daysSinceCount > 30 ? " — recomendado todo mês." : "."}`}
            </p>
          </div>
        </div>
        <button
          onClick={onStartCount}
          className="shine inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ink-foreground transition-transform hover:-translate-y-px"
        >
          <ClipboardCheck className="h-4 w-4" /> Fazer inventário
        </button>
      </div>

      {!data.isLoading && issues.length === 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Saldos coerentes, sem reservas a descoberto e sem
          saídas soltas nos últimos 90 dias.
        </div>
      )}

      {issues.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {issues.map((i) => {
            const Icon = i.icon;
            return (
              <div
                key={i.id}
                className={cn(
                  "rounded-xl border p-4",
                  i.severity === "critico"
                    ? "border-destructive/30 bg-destructive/5"
                    : i.severity === "atencao"
                      ? "border-clay/30 bg-clay/5"
                      : "border-border bg-muted/40",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      i.severity === "critico"
                        ? "text-destructive"
                        : i.severity === "atencao"
                          ? "text-clay"
                          : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{i.detail}</div>
                    {i.items && (
                      <ul className="mt-2 space-y-1">
                        {i.items.slice(0, 5).map((x, k) => (
                          <li key={`${x.id}-${k}`} className="truncate text-xs">
                            {x.to === "lecture" ? (
                              <Link
                                to="/app/palestras/$id"
                                params={{ id: x.id }}
                                className="hover:text-clay hover:underline"
                              >
                                {x.label}
                              </Link>
                            ) : (
                              <Link
                                to="/app/estoque/$id"
                                params={{ id: x.id }}
                                className="hover:text-clay hover:underline"
                              >
                                {x.label}
                              </Link>
                            )}
                          </li>
                        ))}
                        {i.items.length > 5 && (
                          <li className="text-[11px] text-muted-foreground">
                            e mais {i.items.length - 5}…
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  const color =
    pct >= 85 ? "oklch(0.6 0.12 160)" : pct >= 60 ? "var(--clay)" : "var(--destructive)";
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-out-soft)" }}
        />
      </svg>
      <span className="font-display text-lg">{score === null ? "…" : score}</span>
    </div>
  );
}
