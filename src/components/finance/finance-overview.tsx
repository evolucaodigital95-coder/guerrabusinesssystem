import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Landmark,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CountUp } from "@/components/count-up";
import { BRL, toLocalDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Visão geral financeira: caixa realizado, tendência de 12 meses, previsão
 * dos próximos 90 dias, contas a receber por vencimento, despesas por
 * categoria e saldo por conta. Somente leitura — nada é gravado aqui.
 */

type Mov = {
  id: string;
  direction: string | null;
  status: string | null;
  category: string | null;
  amount: number | null;
  expected_amount: number | null;
  expected_date: string | null;
  settled_at: string | null;
  occurs_on: string | null;
  account_id: string | null;
};
type Account = { id: string; name: string; kind: string | null };

const SETTLED = new Set(["recebido", "paga", "parcial"]);
const CANCELED = new Set(["cancelado", "cancelada"]);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const PALETTE = [
  "var(--clay)",
  "oklch(0.55 0.08 250)",
  "oklch(0.7 0.09 80)",
  "oklch(0.6 0.1 160)",
  "oklch(0.55 0.02 60)",
  "oklch(0.75 0.03 90)",
];

const n = (v: unknown) => Number(v ?? 0) || 0;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Data em que o dinheiro efetivamente entrou/saiu. */
const settledDay = (m: Mov) => (m.settled_at ?? m.occurs_on ?? "").slice(0, 10);
const realized = (m: Mov) => n(m.amount);
const pendingValue = (m: Mov) => Math.max(0, n(m.expected_amount) - n(m.amount));

const PERIODS = [
  { key: "month", label: "Este mês" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Ano" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

function periodBounds(p: PeriodKey, offset = 0) {
  const now = new Date();
  if (p === "month") {
    const s = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
    return { start: ymd(s), end: ymd(e) };
  }
  if (p === "quarter") {
    const q = Math.floor(now.getMonth() / 3) - offset;
    const s = new Date(now.getFullYear(), q * 3, 1);
    const e = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { start: ymd(s), end: ymd(e) };
  }
  return {
    start: `${now.getFullYear() - offset}-01-01`,
    end: `${now.getFullYear() - offset}-12-31`,
  };
}

export function FinanceOverview({ organizationId }: { organizationId: string }) {
  const [period, setPeriod] = useState<PeriodKey>("month");

  const q = useQuery({
    queryKey: ["finance-overview", organizationId],
    queryFn: async () => {
      const since = ymd(new Date(new Date().getFullYear() - 1, new Date().getMonth() - 1, 1));
      const [movs, accs] = await Promise.all([
        supabase
          .from("financial_movements")
          .select(
            "id, direction, status, category, amount, expected_amount, expected_date, settled_at, occurs_on, account_id",
          )
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .or(
            `occurs_on.gte.${since},expected_date.gte.${since},status.in.(previsto,prevista,parcial)`,
          ),
        supabase
          .from("accounts")
          .select("id, name, kind")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("name"),
      ]);
      if (movs.error) throw movs.error;
      if (accs.error) throw accs.error;
      return { movs: (movs.data ?? []) as Mov[], accounts: (accs.data ?? []) as Account[] };
    },
  });

  // Saldo por conta precisa de todo o histórico liquidado.
  const balances = useQuery({
    queryKey: ["finance-overview-balances", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("direction, status, amount, account_id")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .in("status", ["recebido", "paga", "parcial"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const m = useMemo(() => {
    const movs = (q.data?.movs ?? []).filter((x) => !CANCELED.has(x.status ?? ""));
    const today = ymd(new Date());

    const sumPeriod = (b: { start: string; end: string }) => {
      let inV = 0;
      let outV = 0;
      for (const x of movs) {
        if (!SETTLED.has(x.status ?? "")) continue;
        const d = settledDay(x);
        if (d < b.start || d > b.end) continue;
        if (x.direction === "in") inV += realized(x);
        else outV += realized(x);
      }
      return { in: inV, out: outV, result: inV - outV };
    };
    const cur = sumPeriod(periodBounds(period));
    const prev = sumPeriod(periodBounds(period, 1));
    const delta = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : null);

    // 12 meses
    const months: { key: string; label: string; in: number; out: number; result: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = ymd(d).slice(0, 7);
      months.push({ key, label: `${MONTHS[d.getMonth()]}`, in: 0, out: 0, result: 0 });
    }
    const byMonth = new Map(months.map((x) => [x.key, x]));
    for (const x of movs) {
      if (!SETTLED.has(x.status ?? "")) continue;
      const row = byMonth.get(settledDay(x).slice(0, 7));
      if (!row) continue;
      if (x.direction === "in") row.in += realized(x);
      else row.out += realized(x);
    }
    months.forEach((x) => (x.result = x.in - x.out));

    // Pendentes: a receber / a pagar
    const pendings = movs.filter((x) => !SETTLED.has(x.status ?? "") || x.status === "parcial");
    const due = (x: Mov) => (x.expected_date ?? x.occurs_on ?? today).slice(0, 10);
    const receivable = pendings.filter((x) => x.direction === "in" && pendingValue(x) > 0);
    const payable = pendings.filter((x) => x.direction === "out" && pendingValue(x) > 0);
    const aging = [
      { label: "Vencido", tone: "danger", value: 0, count: 0 },
      { label: "Até 30 dias", tone: "clay", value: 0, count: 0 },
      { label: "31 a 60 dias", tone: "muted", value: 0, count: 0 },
      { label: "Mais de 60", tone: "muted", value: 0, count: 0 },
    ];
    const daysTo = (d: string) =>
      Math.round((toLocalDate(d).getTime() - toLocalDate(today).getTime()) / 86_400_000);
    for (const x of receivable) {
      const dd = daysTo(due(x));
      const idx = dd < 0 ? 0 : dd <= 30 ? 1 : dd <= 60 ? 2 : 3;
      aging[idx].value += pendingValue(x);
      aging[idx].count += 1;
    }

    // Previsão de 90 dias (semanal)
    const balanceNow = sumBalances(balances.data ?? [], q.data?.accounts ?? []).total;
    const forecast: { label: string; saldo: number }[] = [];
    let running = balanceNow;
    for (let w = 0; w <= 12; w++) {
      const start = new Date();
      start.setDate(start.getDate() + (w - 1) * 7);
      const end = new Date();
      end.setDate(end.getDate() + w * 7);
      if (w > 0) {
        for (const x of receivable) {
          const d = due(x);
          if ((w === 1 ? true : d > ymd(start)) && d <= ymd(end)) running += pendingValue(x);
        }
        for (const x of payable) {
          const d = due(x);
          if ((w === 1 ? true : d > ymd(start)) && d <= ymd(end)) running -= pendingValue(x);
        }
      }
      forecast.push({
        label: w === 0 ? "hoje" : `${end.getDate()}/${end.getMonth() + 1}`,
        saldo: running,
      });
    }

    // Despesas por categoria (período)
    const b = periodBounds(period);
    const cats = new Map<string, number>();
    for (const x of movs) {
      if (x.direction !== "out" || !SETTLED.has(x.status ?? "")) continue;
      const d = settledDay(x);
      if (d < b.start || d > b.end) continue;
      const k = x.category || "Sem categoria";
      cats.set(k, (cats.get(k) ?? 0) + realized(x));
    }
    const catList = [...cats.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const topCats = catList.slice(0, 5);
    const others = catList.slice(5).reduce((s, c) => s + c.value, 0);
    if (others > 0) topCats.push({ name: "Outras", value: others });

    return {
      cur,
      prev,
      dIn: delta(cur.in, prev.in),
      dOut: delta(cur.out, prev.out),
      dRes: delta(cur.result, prev.result),
      margin: cur.in > 0 ? cur.result / cur.in : null,
      months,
      aging,
      receivableTotal: receivable.reduce((s, x) => s + pendingValue(x), 0),
      payableTotal: payable.reduce((s, x) => s + pendingValue(x), 0),
      overdue: aging[0],
      forecast,
      forecastEnd: forecast.at(-1)?.saldo ?? balanceNow,
      minForecast: Math.min(...forecast.map((f) => f.saldo)),
      cats: topCats,
      catsTotal: catList.reduce((s, c) => s + c.value, 0),
    };
  }, [q.data, balances.data, period]);

  const accountRows = useMemo(
    () => sumBalances(balances.data ?? [], q.data?.accounts ?? []),
    [balances.data, q.data?.accounts],
  );

  if (q.isLoading || balances.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (q.error) {
    return <p className="text-sm text-destructive">Não foi possível carregar a visão geral.</p>;
  }

  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/60 p-1 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 transition-colors",
                period === p.key
                  ? "bg-card font-medium text-foreground shadow-[var(--shadow-elegant)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {m.overdue.count > 0 && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {m.overdue.count} recebimento{m.overdue.count > 1 ? "s" : ""} vencido
            {m.overdue.count > 1 ? "s" : ""} · {BRL.format(m.overdue.value)}
          </div>
        )}
      </div>

      {/* Hero de caixa */}
      <section className="relative overflow-hidden rounded-[28px] bg-ink p-8 text-ink-foreground md:p-10">
        <div
          aria-hidden
          className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="reveal text-[12px] font-medium text-ink-foreground/70">
                Saldo em caixa (todas as contas)
              </div>
              <div
                className="reveal mt-3 font-display text-[3.2rem] leading-none md:text-[4rem]"
                style={{ "--i": 1 } as CSSProperties}
              >
                <CountUp value={accountRows.total} format={(v) => BRL.format(v)} />
              </div>
              <p
                className="reveal mt-4 max-w-sm text-sm leading-relaxed text-ink-foreground/65"
                style={{ "--i": 2 } as CSSProperties}
              >
                Em 90 dias, considerando o que está previsto para entrar e sair, o caixa deve ficar
                em{" "}
                <span
                  className={cn(
                    "font-medium",
                    m.forecastEnd >= accountRows.total ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {BRL.format(m.forecastEnd)}
                </span>
                .
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HeroPill i={3} label="A receber" value={m.receivableTotal} />
              <HeroPill i={4} label="A pagar" value={m.payableTotal} />
            </div>
          </div>
          <div
            className="reveal rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            style={{ "--i": 2 } as CSSProperties}
          >
            <div className="mb-1 flex items-center justify-between text-xs text-ink-foreground/70">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Previsão de caixa · próximas 12 semanas
              </span>
              {m.minForecast < 0 && <span className="text-rose-300">fica negativo no período</span>}
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={m.forecast} margin={{ top: 10, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="cashForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--clay)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--clay)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                  padding={{ left: 14, right: 14 }}
                  tick={{ fill: "currentColor", fontSize: 10, opacity: 0.55 }}
                />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "oklch(1 0 0 / 0.2)" }} />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  name="Saldo previsto"
                  stroke="var(--clay)"
                  strokeWidth={2}
                  fill="url(#cashForecast)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* KPIs do período */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi
          label={`Entradas · ${periodLabel}`}
          value={m.cur.in}
          delta={m.dIn}
          spark={m.months.map((x) => x.in)}
        />
        <Kpi
          label={`Saídas · ${periodLabel}`}
          value={m.cur.out}
          delta={m.dOut}
          invert
          spark={m.months.map((x) => x.out)}
        />
        <Kpi
          label={`Resultado · ${periodLabel}`}
          value={m.cur.result}
          delta={m.dRes}
          spark={m.months.map((x) => x.result)}
        />
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)]">
          <div className="text-[12px] font-medium text-muted-foreground">
            Margem · {periodLabel}
          </div>
          <div className="mt-3 font-display text-3xl leading-none">
            {m.margin === null ? "—" : `${Math.round(m.margin * 100)}%`}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-clay transition-[width] duration-700"
              style={{ width: `${Math.max(0, Math.min(100, (m.margin ?? 0) * 100))}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            quanto sobra de cada real que entra
          </div>
        </div>
      </div>

      {/* 12 meses */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[12px] font-medium text-clay">Últimos 12 meses</div>
            <h3 className="mt-1 font-display text-xl">Entradas, saídas e resultado</h3>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Legend color="oklch(0.6 0.1 160)" label="Entradas" />
            <Legend color="oklch(0.75 0.03 90)" label="Saídas" />
            <Legend color="var(--clay)" label="Resultado" line />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={m.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => COMPACT.format(v)}
            />
            <Tooltip content={<ChartTip />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
            <Bar
              dataKey="in"
              name="Entradas"
              fill="oklch(0.6 0.1 160)"
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              dataKey="out"
              name="Saídas"
              fill="oklch(0.75 0.03 90)"
              radius={[6, 6, 0, 0]}
              maxBarSize={22}
            />
            <Line
              type="monotone"
              dataKey="result"
              name="Resultado"
              stroke="var(--clay)"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* A receber por vencimento */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-2 text-[12px] font-medium text-clay">
            <CalendarClock className="h-3.5 w-3.5" /> A receber por vencimento
          </div>
          <div className="mt-2 font-display text-2xl">{BRL.format(m.receivableTotal)}</div>
          <ul className="mt-5 space-y-3">
            {m.aging.map((a) => {
              const pct = m.receivableTotal ? (a.value / m.receivableTotal) * 100 : 0;
              return (
                <li key={a.label}>
                  <div className="flex justify-between text-xs">
                    <span
                      className={cn(
                        a.tone === "danger" && a.value > 0 && "font-medium text-destructive",
                      )}
                    >
                      {a.label}
                      <span className="ml-1 text-muted-foreground">({a.count})</span>
                    </span>
                    <span className="tabular-nums">{BRL.format(a.value)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700",
                        a.tone === "danger"
                          ? "bg-destructive"
                          : a.tone === "clay"
                            ? "bg-clay"
                            : "bg-foreground/30",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Despesas por categoria */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="text-[12px] font-medium text-clay">Para onde vai o dinheiro</div>
          <div className="mt-2 font-display text-2xl">{BRL.format(m.catsTotal)}</div>
          <div className="text-[11px] text-muted-foreground">em despesas · {periodLabel}</div>
          {m.cats.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Sem despesas pagas no período.
            </p>
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={m.cats}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {m.cats.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                {m.cats.map((c, i) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: PALETTE[i % PALETTE.length] }}
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round((c.value / m.catsTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Saldo por conta */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-2 text-[12px] font-medium text-clay">
            <Landmark className="h-3.5 w-3.5" /> Saldo por conta
          </div>
          <div className="mt-2 font-display text-2xl">{BRL.format(accountRows.total)}</div>
          {accountRows.rows.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Cadastre suas contas na aba Contas.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {accountRows.rows.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    {a.kind && <span className="text-[11px] text-muted-foreground">{a.kind}</span>}
                  </span>
                  <span className={cn("tabular-nums", a.balance < 0 && "text-destructive")}>
                    {BRL.format(a.balance)}
                  </span>
                </li>
              ))}
              {accountRows.unassigned !== 0 && (
                <li className="flex items-center justify-between py-2.5 text-sm text-muted-foreground">
                  <span>Lançamentos sem conta</span>
                  <span className="tabular-nums">{BRL.format(accountRows.unassigned)}</span>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function sumBalances(
  settled: {
    direction: string | null;
    status: string | null;
    amount: number | null;
    account_id: string | null;
  }[],
  accounts: Account[],
) {
  const map = new Map<string, number>(accounts.map((a) => [a.id, 0]));
  let unassigned = 0;
  for (const x of settled) {
    const v = (x.direction === "in" ? 1 : -1) * n(x.amount);
    if (x.account_id && map.has(x.account_id)) map.set(x.account_id, map.get(x.account_id)! + v);
    else unassigned += v;
  }
  const rows = accounts
    .map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: map.get(a.id) ?? 0 }))
    .sort((a, b) => b.balance - a.balance);
  const total = rows.reduce((s, r) => s + r.balance, 0) + unassigned;
  return { rows, unassigned, total };
}

function Kpi({
  label,
  value,
  delta,
  spark,
  invert,
}: {
  label: string;
  value: number;
  delta: number | null;
  spark: number[];
  invert?: boolean;
}) {
  const good = delta === null ? null : invert ? delta <= 0 : delta >= 0;
  return (
    <div className="hover-lift rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)]">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-3xl leading-none tabular-nums">
        <CountUp value={value} format={(v) => BRL.format(v)} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        {delta === null ? (
          <span className="text-[11px] text-muted-foreground">sem período anterior</span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(Math.round(delta * 100))}% vs. anterior
          </span>
        )}
        <Sparkline values={spark} />
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 84;
  const h = 26;
  const pts = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * w},${h - (max === min ? h / 2 : ((v - min) / (max - min)) * h)}`,
    )
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="var(--clay)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeroPill({ label, value, i }: { label: string; value: number; i: number }) {
  return (
    <div
      className="reveal rounded-2xl border border-white/10 bg-white/[0.06] p-4"
      style={{ "--i": i } as CSSProperties}
    >
      <div className="text-[11px] text-ink-foreground/60">{label}</div>
      <div className="mt-2 font-display text-xl leading-none tabular-nums md:text-2xl">
        {BRL.format(value)}
      </div>
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={line ? "h-0.5 w-3 rounded" : "h-2.5 w-2.5 rounded-sm"}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-[var(--shadow-soft)]">
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{p.name ?? p.payload?.name}</span>
          <span className="tabular-nums">{BRL.format(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
