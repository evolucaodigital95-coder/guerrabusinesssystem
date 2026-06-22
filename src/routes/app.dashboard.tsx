import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Building2, Users, Mic, UserCog, CalendarRange, LayoutDashboard,
  TrendingUp, TrendingDown, Wallet, Plus, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader, EmptyState } from "@/components/page-shell";
import { ENTITY_LABEL, ENTITY_ROUTE, type EntityType } from "@/lib/entities";
import { lectureStatusLabel } from "@/lib/lectures";
import { statusLabel } from "@/lib/finance";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GBS" }] }),
  component: DashboardPage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR");

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); x.setDate(x.getDate() - x.getDay()); return x; }
function startOfMonth(d = new Date()) { const x = startOfDay(d); x.setDate(1); return x; }
function startOfYear(d = new Date()) { const x = startOfDay(d); x.setMonth(0,1); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

function useDashboard(orgId: string | null) {
  return useQuery({
    queryKey: ["dashboard", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const org = orgId!;
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const weekStart = startOfWeek(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const yearStart = startOfYear(now).toISOString();
      const todayISO = isoDate(now);
      const in30 = isoDate(new Date(now.getTime() + 30 * 86400000));

      const base = (t: string) => supabase.from(t).select("*", { count: "exact", head: true })
        .eq("organization_id", org).is("archived_at", null);

      const [
        companies, contacts, lectures, agents, seasonsActive, projectsActive,
        movIn, movOut,
        lecturesDone, lecturesCancel, lecturesWeek, lecturesMonth,
        audienceHist, audienceYear, audienceMonth, audienceWeek, audienceToday,
        upcoming, recentIn, recentOut, lowStock, projDue, pendFin, timeline,
      ] = await Promise.all([
        base("companies"),
        base("contacts"),
        base("lectures"),
        base("agents"),
        base("seasons").eq("status", "ativa"),
        base("projects").in("status", ["ativo", "em_andamento", "planejamento"]),
        // financeiro
        supabase.from("financial_movements").select("amount").eq("organization_id", org).is("archived_at", null).eq("direction", "in"),
        supabase.from("financial_movements").select("amount").eq("organization_id", org).is("archived_at", null).eq("direction", "out"),
        // palestras
        base("lectures").eq("status", "realizada"),
        base("lectures").eq("status", "cancelada"),
        base("lectures").gte("scheduled_at", weekStart).lte("scheduled_at", todayEnd),
        base("lectures").gte("scheduled_at", monthStart),
        // vidas
        supabase.from("lectures").select("actual_audience, scheduled_at").eq("organization_id", org).is("archived_at", null).eq("status", "realizada"),
        supabase.from("lectures").select("actual_audience").eq("organization_id", org).is("archived_at", null).eq("status", "realizada").gte("scheduled_at", yearStart),
        supabase.from("lectures").select("actual_audience").eq("organization_id", org).is("archived_at", null).eq("status", "realizada").gte("scheduled_at", monthStart),
        supabase.from("lectures").select("actual_audience").eq("organization_id", org).is("archived_at", null).eq("status", "realizada").gte("scheduled_at", weekStart),
        supabase.from("lectures").select("actual_audience").eq("organization_id", org).is("archived_at", null).eq("status", "realizada").gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd),
        // agenda
        supabase.from("lectures").select("id, title, scheduled_at, status, city, state")
          .eq("organization_id", org).is("archived_at", null)
          .gte("scheduled_at", todayStart).order("scheduled_at", { ascending: true }).limit(6),
        supabase.from("financial_movements").select("id, description, amount, occurs_on, status")
          .eq("organization_id", org).is("archived_at", null).eq("direction", "in")
          .order("occurs_on", { ascending: false }).limit(5),
        supabase.from("financial_movements").select("id, description, amount, occurs_on, status")
          .eq("organization_id", org).is("archived_at", null).eq("direction", "out")
          .order("occurs_on", { ascending: false }).limit(5),
        supabase.from("stock_items").select("id, name, min_quantity")
          .eq("organization_id", org).is("archived_at", null).not("min_quantity", "is", null).gt("min_quantity", 0).limit(5),
        supabase.from("projects").select("id, name, ends_on, status")
          .eq("organization_id", org).is("archived_at", null)
          .not("ends_on", "is", null).gte("ends_on", todayISO).lte("ends_on", in30)
          .order("ends_on", { ascending: true }).limit(5),
        supabase.from("financial_movements").select("id, description, amount, expected_date, direction, status")
          .eq("organization_id", org).is("archived_at", null)
          .in("status", ["previsto", "prevista", "parcial"])
          .order("expected_date", { ascending: true, nullsFirst: false }).limit(5),
        supabase.from("timeline_events").select("id, entity_type, entity_id, title, kind, occurs_at, created_at")
          .eq("organization_id", org).order("created_at", { ascending: false }).limit(12),
      ]);

      const sum = (rows: { amount: number | string | null }[] | null) =>
        (rows ?? []).reduce((a, r) => a + Number(r.amount ?? 0), 0);
      const sumAud = (rows: { actual_audience: number | null }[] | null) =>
        (rows ?? []).reduce((a, r) => a + (r.actual_audience ?? 0), 0);

      return {
        counts: {
          companies: companies.count ?? 0,
          contacts: contacts.count ?? 0,
          lectures: lectures.count ?? 0,
          agents: agents.count ?? 0,
          seasonsActive: seasonsActive.count ?? 0,
          projectsActive: projectsActive.count ?? 0,
        },
        finance: {
          totalIn: sum(movIn.data),
          totalOut: sum(movOut.data),
          countIn: movIn.data?.length ?? 0,
          countOut: movOut.data?.length ?? 0,
        },
        lecturesStats: {
          done: lecturesDone.count ?? 0,
          cancelled: lecturesCancel.count ?? 0,
          week: lecturesWeek.count ?? 0,
          month: lecturesMonth.count ?? 0,
        },
        audience: {
          today: sumAud(audienceToday.data),
          week: sumAud(audienceWeek.data),
          month: sumAud(audienceMonth.data),
          year: sumAud(audienceYear.data),
          total: sumAud(audienceHist.data),
        },
        upcoming: upcoming.data ?? [],
        recentIn: recentIn.data ?? [],
        recentOut: recentOut.data ?? [],
        lowStock: lowStock.data ?? [],
        projDue: projDue.data ?? [],
        pendFin: pendFin.data ?? [],
        timeline: timeline.data ?? [],
      };
    },
  });
}

function Stat({ label, value, hint, to }: { label: string; value: React.ReactNode; hint?: string; to?: string }) {
  const inner = (
    <div className="hover-lift h-full rounded-2xl border border-border bg-card p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-5 font-display text-[1.75rem] leading-none">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
        {eyebrow}
      </div>
      <h2 className="mt-3 font-display text-2xl">{title}</h2>
    </div>
  );
}

function fmtDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  // occurs_on is YYYY-MM-DD
  const d = s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function DashboardPage() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data, isLoading } = useDashboard(organizationId);

  const shortcuts = useMemo(() => ([
    { label: "Nova Empresa", icon: Building2, to: "/app/crm" },
    { label: "Nova Palestra", icon: Mic, to: "/app/palestras" },
    { label: "Novo Lançamento", icon: Wallet, to: "/app/financeiro" },
    { label: "Novo Agendista", icon: UserCog, to: "/app/agendistas" },
    { label: "Novo Projeto", icon: LayoutDashboard, to: "/app/projetos" },
  ]), []);

  if (orgLoading || isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Central de Comando" title="Dashboard" description="Carregando indicadores reais do Grupo Guerra…" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const { counts, finance, lecturesStats, audience, upcoming, recentIn, recentOut, lowStock, projDue, pendFin, timeline } = data;
  const totalMov = finance.totalIn + finance.totalOut;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Central de Comando"
        title="Dashboard"
        description="Visão executiva consolidada com dados reais do Grupo Guerra."
      />

      {/* Shortcuts */}
      <section className="mb-12">
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="hover-lift inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium transition-colors hover:border-foreground/30"
            >
              <Plus className="h-3.5 w-3.5" />
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Resumo Executivo */}
      <section className="mb-14">
        <SectionTitle eyebrow="Resumo Executivo" title="Cadastros do sistema" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Empresas" value={NUM.format(counts.companies)} to="/app/crm" />
          <Stat label="Contatos" value={NUM.format(counts.contacts)} to="/app/crm" />
          <Stat label="Palestras" value={NUM.format(counts.lectures)} to="/app/palestras" />
          <Stat label="Agendistas" value={NUM.format(counts.agents)} to="/app/agendistas" />
          <Stat label="Temporadas ativas" value={NUM.format(counts.seasonsActive)} to="/app/temporadas" />
          <Stat label="Projetos ativos" value={NUM.format(counts.projectsActive)} to="/app/projetos" />
        </div>
      </section>

      {/* Vidas Impactadas */}
      <section className="mb-14">
        <div className="hover-lift relative overflow-hidden rounded-3xl p-10 md:p-14"
          style={{ background: "var(--navy)", color: "var(--navy-foreground)" }}>
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }} />
          <div className="relative">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[var(--navy-foreground)]/65">
              <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
              Vidas Impactadas
            </div>
            <div className="mt-8 font-display text-6xl leading-none md:text-[5.5rem]">
              {NUM.format(audience.total)}
            </div>
            <p className="mt-5 max-w-md text-sm text-[var(--navy-foreground)]/70">
              Soma de participantes confirmados em todas as palestras realizadas.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[var(--navy-foreground)]/15 sm:grid-cols-4">
              {[
                { l: "Hoje", v: audience.today },
                { l: "Semana", v: audience.week },
                { l: "Mês", v: audience.month },
                { l: "Ano", v: audience.year },
              ].map((x) => (
                <div key={x.l} className="bg-[var(--navy)] p-5">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--navy-foreground)]/65">{x.l}</div>
                  <div className="mt-3 font-display text-2xl">{NUM.format(x.v)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Financeiro + Palestras */}
      <section className="mb-14 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-8">
          <SectionTitle eyebrow="Financeiro" title="Movimentações reais" />
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
            <Stat label="Receitas" value={BRL.format(finance.totalIn)} hint={`${finance.countIn} lançamentos`} />
            <Stat label="Despesas" value={BRL.format(finance.totalOut)} hint={`${finance.countOut} lançamentos`} />
            <Stat label="Total movimentado" value={BRL.format(totalMov)} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <RecentList icon={TrendingUp} title="Entradas recentes" rows={recentIn.map((r) => ({
              id: r.id, primary: r.description ?? "Lançamento", secondary: fmtDate(r.occurs_on),
              right: BRL.format(Number(r.amount ?? 0)), badge: statusLabel("in", r.status),
            }))} empty="Nenhuma entrada registrada." />
            <RecentList icon={TrendingDown} title="Saídas recentes" rows={recentOut.map((r) => ({
              id: r.id, primary: r.description ?? "Lançamento", secondary: fmtDate(r.occurs_on),
              right: BRL.format(Number(r.amount ?? 0)), badge: statusLabel("out", r.status),
            }))} empty="Nenhuma saída registrada." />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8">
          <SectionTitle eyebrow="Palestras" title="Status operacional" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
            <Stat label="Realizadas" value={NUM.format(lecturesStats.done)} />
            <Stat label="Canceladas" value={NUM.format(lecturesStats.cancelled)} />
            <Stat label="Semana" value={NUM.format(lecturesStats.week)} />
            <Stat label="Mês" value={NUM.format(lecturesStats.month)} />
          </div>
          <div className="mt-6">
            <RecentList icon={Mic} title="Próximas palestras" rows={upcoming.map((l) => ({
              id: l.id, to: `/app/palestras/${l.id}`,
              primary: l.title ?? "Palestra",
              secondary: [fmtDateTime(l.scheduled_at), [l.city, l.state].filter(Boolean).join(" / ")].filter(Boolean).join(" · "),
              badge: lectureStatusLabel(l.status),
            }))} empty="Nenhuma palestra agendada." />
          </div>
        </div>
      </section>

      {/* Agenda Operacional */}
      <section className="mb-14">
        <SectionTitle eyebrow="Agenda Operacional" title="Próximas pendências" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <RecentList icon={Wallet} title="Pendências financeiras" rows={pendFin.map((r) => ({
            id: r.id, primary: r.description ?? "Lançamento",
            secondary: fmtDate(r.expected_date),
            right: BRL.format(Number(r.amount ?? 0)),
            badge: statusLabel(r.direction as "in" | "out", r.status),
          }))} empty="Sem pendências financeiras." />
          <RecentList icon={LayoutDashboard} title="Projetos próximos do prazo" rows={projDue.map((p) => ({
            id: p.id, to: `/app/projetos/${p.id}`,
            primary: p.name, secondary: `Prazo: ${fmtDate(p.ends_on)}`,
            badge: p.status ?? "—",
          }))} empty="Nenhum projeto próximo do prazo." />
          <RecentList icon={Sparkles} title="Estoque com mínimo definido" rows={lowStock.map((s) => ({
            id: s.id, to: `/app/estoque/${s.id}`,
            primary: s.name, secondary: `Mín.: ${NUM.format(Number(s.min_quantity ?? 0))}`,
          }))} empty="Nenhum item com estoque mínimo configurado." />
        </div>
      </section>

      {/* Timeline */}
      <section>
        <SectionTitle eyebrow="Atividade Recente" title="Timeline global" />
        <div className="rounded-2xl border border-border bg-card">
          {timeline.length === 0 ? (
            <EmptyState message="Nenhuma atividade registrada ainda." />
          ) : (
            <ul className="divide-y divide-border">
              {timeline.map((e) => {
                const type = e.entity_type as EntityType;
                const route = ENTITY_ROUTE[type]?.(e.entity_id);
                const label = ENTITY_LABEL[type] ?? e.entity_type;
                const row = (
                  <div className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
                      <div className="mt-1 truncate text-sm">{e.title ?? "Evento"}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(e.occurs_at ?? e.created_at)}</div>
                  </div>
                );
                return (
                  <li key={e.id} className="transition-colors hover:bg-muted/40">
                    {route ? <Link to={route}>{row}</Link> : row}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function RecentList({
  icon: Icon, title, rows, empty,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  rows: Array<{ id: string; primary: string; secondary?: string; right?: string; badge?: string; to?: string }>;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">{empty}</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const inner = (
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm">{r.primary}</div>
                  {r.secondary && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.secondary}</div>}
                </div>
                <div className="shrink-0 text-right">
                  {r.right && <div className="font-display text-sm">{r.right}</div>}
                  {r.badge && <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{r.badge}</div>}
                </div>
              </div>
            );
            return (
              <li key={r.id} className="transition-colors hover:bg-muted/40">
                {r.to ? <Link to={r.to}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
