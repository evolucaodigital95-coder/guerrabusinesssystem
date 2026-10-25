import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  Wallet,
  Mic,
  Building2,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { BRL, NUM } from "@/lib/format";

const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;

const NAVY = "hsl(var(--primary))";
const GOLD = "#C9A961";
const RED = "hsl(var(--destructive))";

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d);
}

function useDirector(orgId: string | null) {
  return useQuery({
    queryKey: ["painel-diretor", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
      const org = orgId!;
      const orgIs = (q: any) => q.eq("organization_id", org).is("archived_at", null);

      const [snapshots, lectures, movements, companies, agents, seasons, lowStock, pendFin] =
        await Promise.all([
          supabase
            .from("lecture_financial_snapshots")
            .select(
              "gross_revenue, net_profit, gustavo_amount, agent_amount, total_expenses, total_stock_cost, total_card_fees, total_advances, closed_at, agent_id, lecture_id",
            )
            .eq("organization_id", org)
            .is("archived_at", null),
          supabase
            .from("lectures")
            .select(
              "id, title, status, scheduled_at, actual_audience, expected_audience, gross_revenue, city, state, company_id, agent_id, companies:company_id(legal_name), agents:agent_id(full_name)",
            )
            .eq("organization_id", org)
            .is("archived_at", null),
          supabase
            .from("financial_movements")
            .select("direction, amount, occurs_on, status, category")
            .eq("organization_id", org)
            .is("archived_at", null),
          orgIs(supabase.from("companies").select("id", { count: "exact", head: true })),
          orgIs(supabase.from("agents").select("id, full_name")),
          orgIs(supabase.from("seasons").select("id, name, status")),
          supabase
            .from("stock_items")
            .select("id, name, min_quantity")
            .eq("organization_id", org)
            .is("archived_at", null)
            .not("min_quantity", "is", null)
            .gt("min_quantity", 0),
          supabase
            .from("financial_movements")
            .select("id, description, amount, expected_date, direction, status")
            .eq("organization_id", org)
            .is("archived_at", null)
            .in("status", ["previsto", "prevista", "parcial"])
            .order("expected_date", { ascending: true, nullsFirst: false })
            .limit(8),
        ]);

      const snaps = snapshots.data ?? [];
      const totals = snaps.reduce(
        (acc, s: any) => {
          acc.gross += Number(s.gross_revenue ?? 0);
          acc.profit += Number(s.net_profit ?? 0);
          acc.gustavo += Number(s.gustavo_amount ?? 0);
          acc.agent += Number(s.agent_amount ?? 0);
          acc.expenses += Number(s.total_expenses ?? 0);
          acc.stock += Number(s.total_stock_cost ?? 0);
          acc.fees += Number(s.total_card_fees ?? 0);
          return acc;
        },
        { gross: 0, profit: 0, gustavo: 0, agent: 0, expenses: 0, stock: 0, fees: 0 },
      );

      const margin = totals.gross > 0 ? totals.profit / totals.gross : 0;

      // série mensal (últimos 12 meses)
      const now = new Date();
      const months: { key: string; label: string; receita: number; lucro: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({ key: monthKey(d), label: monthLabel(d), receita: 0, lucro: 0 });
      }
      const midx = new Map(months.map((m, i) => [m.key, i]));
      for (const s of snaps as any[]) {
        if (!s.closed_at) continue;
        const d = new Date(s.closed_at);
        const k = monthKey(d);
        const i = midx.get(k);
        if (i === undefined) continue;
        months[i].receita += Number(s.gross_revenue ?? 0);
        months[i].lucro += Number(s.net_profit ?? 0);
      }

      // cashflow real (movements liquidados)
      const cashByMonth = new Map<
        string,
        { key: string; label: string; entradas: number; saidas: number }
      >();
      for (const m of months)
        cashByMonth.set(m.key, { key: m.key, label: m.label, entradas: 0, saidas: 0 });
      for (const m of movements.data ?? []) {
        if (!m.occurs_on) continue;
        const d = new Date(m.occurs_on + "T00:00:00");
        const k = monthKey(d);
        const row = cashByMonth.get(k);
        if (!row) continue;
        const isPaid = m.direction === "in" ? m.status === "recebido" : m.status === "pago";
        if (!isPaid) continue;
        if (m.direction === "in") row.entradas += Number(m.amount ?? 0);
        else row.saidas += Number(m.amount ?? 0);
      }
      const cashflow = Array.from(cashByMonth.values()).map((r) => ({
        ...r,
        saldo: r.entradas - r.saidas,
      }));

      // rankings por empresa (receita snapshot ↔ palestra)
      const lectureById = new Map((lectures.data ?? []).map((l: any) => [l.id, l]));
      const companyRev = new Map<string, number>();
      const agentRev = new Map<string, { name: string; value: number }>();
      const agentNames = new Map<string, string>(
        (agents.data ?? []).map((a: any) => [a.id, a.full_name]),
      );
      for (const s of snaps as any[]) {
        const l: any = lectureById.get(s.lecture_id);
        const cName = l?.companies?.legal_name ?? "Sem empresa";
        companyRev.set(cName, (companyRev.get(cName) ?? 0) + Number(s.gross_revenue ?? 0));
        const aName = agentNames.get(s.agent_id) ?? "Sem agendista";
        const cur = agentRev.get(s.agent_id ?? "none") ?? { name: aName, value: 0 };
        cur.value += Number(s.agent_amount ?? 0);
        agentRev.set(s.agent_id ?? "none", cur);
      }
      const topCompanies: { name: string; value: number }[] = Array.from(companyRev.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
      const topAgents = Array.from(agentRev.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // status mix palestras
      const statusMix = new Map<string, number>();
      for (const l of lectures.data ?? []) {
        const k = l.status ?? "sem_status";
        statusMix.set(k, (statusMix.get(k) ?? 0) + 1);
      }
      const statusPie = Array.from(statusMix.entries()).map(([name, value]) => ({ name, value }));

      // KPIs operacionais
      const doneCount = (lectures.data ?? []).filter(
        (l: any) => l.status === "realizada" || l.status === "encerrada",
      ).length;
      const audience = (lectures.data ?? []).reduce((a, l: any) => a + (l.actual_audience ?? 0), 0);
      const ticket = doneCount > 0 ? totals.gross / doneCount : 0;
      const activeSeasons = (seasons.data ?? []).filter((s: any) => s.status === "ativa").length;

      return {
        totals,
        margin,
        months,
        cashflow,
        topCompanies,
        topAgents,
        statusPie,
        companies: companies.count ?? 0,
        agents: (agents.data ?? []).length,
        activeSeasons,
        doneCount,
        audience,
        ticket,
        lowStock: lowStock.data ?? [],
        pendFin: pendFin.data ?? [],
      };
    },
  });
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "gold" | "navy" | "danger";
}) {
  const toneClass =
    tone === "gold"
      ? "border-[color:var(--gold)]/40"
      : tone === "danger"
        ? "border-destructive/40"
        : tone === "navy"
          ? "border-primary/40"
          : "border-border";
  return (
    <div className={`hover-lift h-full rounded-2xl border ${toneClass} bg-card p-6`}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-5 font-display text-[1.75rem] leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 260,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-serif text-lg">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PainelDiretorPage() {
  const { organizationId, loading } = useCurrentOrg();
  const { data, isLoading } = useDirector(organizationId);

  const pieColors = useMemo(() => [NAVY, GOLD, "#6b7280", "#94a3b8", RED, "#0ea5e9"], []);

  if (loading || isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Executivo"
          title="Painel do Diretor"
          description="Consolidando indicadores…"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const {
    totals,
    margin,
    months,
    cashflow,
    topCompanies,
    topAgents,
    statusPie,
    ticket,
    doneCount,
    audience,
    activeSeasons,
    lowStock,
    pendFin,
  } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        eyebrow="Executivo"
        title="Painel do Diretor"
        description="Visão consolidada de rentabilidade, ranking, fluxo de caixa e alertas estratégicos."
        actions={
          <Link
            to="/app/inteligencia"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium hover:border-foreground/30"
          >
            <Sparkles className="h-3.5 w-3.5" /> Centro de Inteligência
          </Link>
        }
      />

      {/* Hero — Rentabilidade */}
      <section
        className="relative overflow-hidden rounded-3xl p-10 md:p-14"
        style={{ background: "var(--ink)", color: "var(--ink-foreground)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
        />
        <div className="relative grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">
              Lucro Líquido Consolidado
            </div>
            <div className="mt-5 font-display text-5xl leading-none md:text-6xl">
              {BRL.format(totals.profit)}
            </div>
            <p className="mt-4 text-sm opacity-70">
              de {BRL.format(totals.gross)} em receita bruta apurada.
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">
              Margem Operacional
            </div>
            <div
              className="mt-5 font-display text-5xl leading-none md:text-6xl"
              style={{ color: GOLD }}
            >
              {PCT(margin)}
            </div>
            <p className="mt-4 text-sm opacity-70">após taxas, materiais e despesas.</p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">
              Divisão do resultado
            </div>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Palestrante</span>
                <span className="font-display text-xl">{BRL.format(totals.gustavo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">Agendistas</span>
                <span className="font-display text-xl">{BRL.format(totals.agent)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="opacity-70">Dízimo (10%)</span>
                <span style={{ color: GOLD }}>{BRL.format(totals.profit * 0.1)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Palestras encerradas" value={NUM.format(doneCount)} tone="navy" />
        <Kpi label="Ticket médio" value={BRL.format(ticket)} tone="gold" />
        <Kpi label="Vidas impactadas" value={NUM.format(audience)} />
        <Kpi label="Temporadas ativas" value={NUM.format(activeSeasons)} />
        <Kpi label="Taxas cartão" value={BRL.format(totals.fees)} hint="deduzido do bruto" />
        <Kpi label="Materiais aplicados" value={BRL.format(totals.stock)} hint="custo médio" />
      </section>

      {/* Gráficos */}
      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Receita × Lucro" subtitle="Últimos 12 meses (snapshots)">
          <AreaChart data={months}>
            <defs>
              <linearGradient id="gr-rec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NAVY} stopOpacity={0.35} />
                <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gr-luc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis
              fontSize={11}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip formatter={(v: any) => BRL.format(Number(v))} />
            <Legend />
            <Area
              type="monotone"
              dataKey="receita"
              stroke={NAVY}
              fill="url(#gr-rec)"
              name="Receita"
            />
            <Area type="monotone" dataKey="lucro" stroke={GOLD} fill="url(#gr-luc)" name="Lucro" />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Fluxo de caixa" subtitle="Entradas × saídas liquidadas (12m)">
          <BarChart data={cashflow}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis
              fontSize={11}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <Tooltip formatter={(v: any) => BRL.format(Number(v))} />
            <Legend />
            <Bar dataKey="entradas" fill={NAVY} name="Entradas" radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" fill={RED} name="Saídas" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top empresas" subtitle="Receita bruta apurada">
          <BarChart data={topCompanies} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              type="number"
              fontSize={11}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <YAxis type="category" dataKey="name" width={140} fontSize={11} />
            <Tooltip formatter={(v: any) => BRL.format(Number(v))} />
            <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top agendistas" subtitle="Comissão apurada">
          <BarChart data={topAgents} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis
              type="number"
              fontSize={11}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            />
            <YAxis type="category" dataKey="name" width={140} fontSize={11} />
            <Tooltip formatter={(v: any) => BRL.format(Number(v))} />
            <Bar dataKey="value" fill={GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Mix de palestras" subtitle="Status atual do funil" height={260}>
          <PieChart>
            <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={90} label>
              {statusPie.map((_, i) => (
                <Cell key={i} fill={pieColors[i % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-serif text-lg">Alertas estratégicos</h3>
          <p className="text-xs text-muted-foreground">Prioridades da diretoria</p>
          <div className="mt-4 space-y-3 text-sm">
            {pendFin.length === 0 && lowStock.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum alerta ativo. Operação em dia.</p>
            )}
            {pendFin.slice(0, 4).map((p: any) => (
              <Link
                key={p.id}
                to="/app/financeiro"
                search={{ lancamento: undefined }}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 p-3 hover:border-foreground/30"
              >
                <div className="flex items-start gap-2">
                  <Wallet className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{p.description ?? "Lançamento previsto"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.expected_date ?? "sem data"} ·{" "}
                      {p.direction === "in" ? "a receber" : "a pagar"}
                    </div>
                  </div>
                </div>
                <span className="font-display tabular-nums">
                  {BRL.format(Number(p.amount ?? 0))}
                </span>
              </Link>
            ))}
            {lowStock.slice(0, 3).map((s: any) => (
              <Link
                key={s.id}
                to="/app/estoque"
                className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 hover:border-destructive/60"
              >
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">Mínimo: {s.min_quantity}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Atalhos executivos */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/app/financeiro", icon: TrendingUp, label: "Financeiro" },
          { to: "/app/centro-palestrante", icon: Trophy, label: "Área do palestrante" },
          { to: "/app/palestras", icon: Mic, label: "Palestras" },
          { to: "/app/crm", icon: Building2, label: "Empresas" },
        ].map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="hover-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-5 hover:border-foreground/30"
          >
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{s.label}</span>
            <TrendingDown className="ml-auto h-4 w-4 rotate-[135deg] text-muted-foreground" />
          </Link>
        ))}
      </section>
    </div>
  );
}
