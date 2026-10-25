import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Hourglass, MapPin, Users } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { BRL, NUM, toLocalDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DashLecture = {
  id: string;
  title: string;
  status: string | null;
  scheduled_at: string | null;
  city: string | null;
  state: string | null;
  expected_audience: number | null;
  actual_audience: number | null;
  gross_revenue: number | null;
  closed_at?: string | null;
  companies: { id: string; legal_name: string } | null;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PIPELINE = [
  { key: "lead", label: "Lead" },
  { key: "agendada", label: "Agendada" },
  { key: "confirmada", label: "Confirmada" },
  { key: "realizada", label: "Realizada" },
  { key: "encerrada", label: "Encerrada" },
] as const;
const PERIODS = [
  { key: "month", label: "Este mês", months: 1 },
  { key: "quarter", label: "3 meses", months: 3 },
  { key: "year", label: "12 meses", months: 12 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const n = (v: unknown) => Number(v ?? 0) || 0;
const happened = (l: DashLecture) => l.status === "realizada" || l.status === "encerrada";
const active = (l: DashLecture) => l.status !== "cancelada";

/** Painel das palestras: ritmo, funil, faturamento, agenda e dinheiro parado. */
export function LecturesDashboard({ lectures }: { lectures: DashLecture[] }) {
  const [period, setPeriod] = useState<PeriodKey>("quarter");

  const m = useMemo(() => {
    const now = new Date();
    const months = PERIODS.find((p) => p.key === period)!.months;
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2 * months + 1, 1);
    const when = (l: DashLecture) => (l.scheduled_at ? new Date(l.scheduled_at) : null);
    const inRange = (l: DashLecture, a: Date, b: Date) => {
      const d = when(l);
      return !!d && d >= a && d < b;
    };

    const cur = lectures.filter((l) => happened(l) && inRange(l, start, now));
    const prev = lectures.filter((l) => happened(l) && inRange(l, prevStart, start));
    const revenue = cur.reduce((s, l) => s + n(l.gross_revenue), 0);
    const prevRevenue = prev.reduce((s, l) => s + n(l.gross_revenue), 0);
    const audience = cur.reduce((s, l) => s + n(l.actual_audience ?? l.expected_audience), 0);
    const delta = (a: number, b: number) => (b ? (a - b) / b : null);

    // Funil (todas as palestras ativas)
    const funnel = PIPELINE.map((p) => {
      const list = lectures.filter((l) => l.status === p.key);
      return { ...p, count: list.length, value: list.reduce((s, l) => s + n(l.gross_revenue), 0) };
    });
    const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));
    const canceled = lectures.filter((l) => l.status === "cancelada").length;
    const decided = lectures.filter(
      (l) => l.status !== "lead" && l.status !== "agendada" && l.status !== "confirmada",
    );
    const conversion = decided.length ? decided.filter(happened).length / decided.length : null;

    // Ritmo: palestras realizadas por mês (12 meses)
    const rhythm = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const list = lectures.filter((l) => happened(l) && inRange(l, d, next));
      return {
        label: MONTHS[d.getMonth()],
        count: list.length,
        revenue: list.reduce((s, l) => s + n(l.gross_revenue), 0),
        current: i === 11,
      };
    });

    // Próximos 30 dias
    const in30 = new Date(now.getTime() + 30 * 86_400_000);
    const upcoming = lectures
      .filter(
        (l) =>
          active(l) &&
          !happened(l) &&
          inRange(l, new Date(now.getFullYear(), now.getMonth(), now.getDate()), in30),
      )
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

    // Dinheiro parado: realizadas e ainda não encerradas financeiramente
    const stuck = lectures
      .filter((l) => l.status === "realizada" && !l.closed_at)
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

    // Onde mais rende (12 meses)
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const lastYear = lectures.filter((l) => happened(l) && inRange(l, yearAgo, now));
    const group = (key: (l: DashLecture) => string | null) => {
      const map = new Map<string, { count: number; revenue: number }>();
      for (const l of lastYear) {
        const k = key(l);
        if (!k) continue;
        const g = map.get(k) ?? { count: 0, revenue: 0 };
        g.count += 1;
        g.revenue += n(l.gross_revenue);
        map.set(k, g);
      }
      return [...map.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    };

    return {
      count: cur.length,
      dCount: delta(cur.length, prev.length),
      revenue,
      dRevenue: delta(revenue, prevRevenue),
      ticket: cur.length ? revenue / cur.length : 0,
      audience,
      avgAudience: cur.length ? audience / cur.length : 0,
      funnel,
      maxFunnel,
      canceled,
      conversion,
      rhythm,
      upcoming,
      upcomingValue: upcoming.reduce((s, l) => s + n(l.gross_revenue), 0),
      stuck,
      stuckValue: stuck.reduce((s, l) => s + n(l.gross_revenue), 0),
      cities: group((l) => [l.city, l.state].filter(Boolean).join(" / ") || null),
      companies: group((l) => l.companies?.legal_name ?? null),
    };
  }, [lectures, period]);

  return (
    <div className="space-y-4">
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
        {m.stuck.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-clay/30 bg-clay/5 px-3 py-1.5 text-xs text-clay">
            <Hourglass className="h-3.5 w-3.5" />
            {m.stuck.length} realizada{m.stuck.length > 1 ? "s" : ""} sem fechamento ·{" "}
            {BRL.format(m.stuckValue)}
          </span>
        )}
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-ink p-8 text-ink-foreground md:p-10">
        <div
          aria-hidden
          className="absolute -top-40 -right-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
        />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7">
            <HeroStat
              i={0}
              label="Palestras realizadas"
              value={m.count}
              format={(v) => NUM.format(Math.round(v))}
              delta={m.dCount}
              big
            />
            <HeroStat
              i={1}
              label="Faturamento"
              value={m.revenue}
              format={(v) => BRL.format(v)}
              delta={m.dRevenue}
              big
            />
            <HeroStat i={2} label="Ticket médio" value={m.ticket} format={(v) => BRL.format(v)} />
            <HeroStat
              i={3}
              label="Público médio"
              value={m.avgAudience}
              format={(v) => NUM.format(Math.round(v))}
              hint={`${NUM.format(m.audience)} pessoas no período`}
            />
          </div>
          <div
            className="reveal rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            style={{ "--i": 2 } as CSSProperties}
          >
            <div className="mb-2 flex items-center justify-between text-xs text-ink-foreground/70">
              <span>Ritmo · palestras realizadas por mês</span>
              <span>{NUM.format(m.rhythm.reduce((s, r) => s + r.count, 0))} em 12 meses</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={m.rhythm} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "currentColor", fontSize: 10, opacity: 0.55 }}
                />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 0.06)" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground shadow-[var(--shadow-soft)]">
                        <div className="font-medium">{label}</div>
                        <div>{payload[0].payload.count} palestras</div>
                        <div className="text-muted-foreground">
                          {BRL.format(payload[0].payload.revenue)}
                        </div>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={26}>
                  {m.rhythm.map((r, i) => (
                    <Cell key={i} fill={r.current ? "var(--clay)" : "oklch(1 0 0 / 0.22)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Funil */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-medium text-clay">Funil de palestras</div>
              <h3 className="mt-1 font-display text-xl">Do lead ao fechamento</h3>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {m.conversion !== null && (
                <div>
                  Conversão{" "}
                  <span className="font-display text-lg text-foreground">
                    {Math.round(m.conversion * 100)}%
                  </span>
                </div>
              )}
              {m.canceled > 0 && (
                <div>
                  {m.canceled} cancelada{m.canceled > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {m.funnel.map((f, i) => (
              <li key={f.key}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {f.count} · {BRL.format(f.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${(f.count / m.maxFunnel) * 100}%`,
                      background: `color-mix(in oklab, var(--clay) ${100 - i * 14}%, var(--muted))`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Próximos 30 dias */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-clay">
                <CalendarDays className="h-3.5 w-3.5" /> Próximos 30 dias
              </div>
              <h3 className="mt-1 font-display text-xl">
                {m.upcoming.length} {m.upcoming.length === 1 ? "palestra" : "palestras"}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {BRL.format(m.upcomingValue)} previstos
            </span>
          </div>
          {m.upcoming.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Nada agendado para os próximos 30 dias.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {m.upcoming.slice(0, 5).map((l) => {
                const d = toLocalDate(l.scheduled_at!);
                const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
                return (
                  <li key={l.id}>
                    <Link
                      to="/app/palestras/$id"
                      params={{ id: l.id }}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:border-border hover:bg-accent/40"
                    >
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-center leading-none">
                        <span className="font-display text-lg">{d.getDate()}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {MONTHS[d.getMonth()]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium group-hover:text-clay">
                          {l.title}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {[l.companies?.legal_name, [l.city, l.state].filter(Boolean).join("/")]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs tabular-nums">{BRL.format(n(l.gross_revenue))}</div>
                        <div
                          className={cn(
                            "text-[11px]",
                            days <= 3 ? "font-medium text-clay" : "text-muted-foreground",
                          )}
                        >
                          {days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-clay">
            <Hourglass className="h-3.5 w-3.5" /> Dinheiro parado
          </div>
          <div className="mt-2 font-display text-2xl">{BRL.format(m.stuckValue)}</div>
          <p className="text-[11px] text-muted-foreground">
            Palestras realizadas que ainda não foram fechadas financeiramente.
          </p>
          {m.stuck.length === 0 ? (
            <p className="mt-6 text-sm text-emerald-600 dark:text-emerald-400">Tudo fechado. 👏</p>
          ) : (
            <ul className="mt-4 space-y-1.5 text-xs">
              {m.stuck.slice(0, 5).map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <Link
                    to="/app/palestras/$id"
                    params={{ id: l.id }}
                    className="truncate hover:text-clay hover:underline"
                  >
                    {l.title}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {l.scheduled_at ? toLocalDate(l.scheduled_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <RankCard icon={MapPin} title="Cidades que mais rendem" rows={m.cities} />
        <RankCard icon={Users} title="Empresas que mais contratam" rows={m.companies} />
      </div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  format,
  delta,
  hint,
  big,
  i,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  delta?: number | null;
  hint?: string;
  big?: boolean;
  i: number;
}) {
  return (
    <div className="reveal" style={{ "--i": i } as CSSProperties}>
      <div className="text-[12px] text-ink-foreground/65">{label}</div>
      <div
        className={cn("mt-2 font-display leading-none", big ? "text-[2.6rem]" : "text-[1.8rem]")}
      >
        <CountUp value={value} format={format} />
      </div>
      {delta !== undefined && delta !== null && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-0.5 text-[11px]",
            delta >= 0 ? "text-emerald-300" : "text-rose-300",
          )}
        >
          {delta >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(Math.round(delta * 100))}% vs. período anterior
        </div>
      )}
      {hint && <div className="mt-2 text-[11px] text-ink-foreground/55">{hint}</div>}
    </div>
  );
}

function RankCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: typeof MapPin;
  title: string;
  rows: { name: string; count: number; revenue: number }[];
}) {
  const max = rows[0]?.revenue ?? 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-clay">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="text-[11px] text-muted-foreground">últimos 12 meses</div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Sem palestras realizadas no período.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex justify-between gap-2 text-xs">
                <span className="truncate font-medium">{r.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {r.count}× · {BRL.format(r.revenue)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-clay/80"
                  style={{ width: `${max ? (r.revenue / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
