import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileSignature,
  Mic,
  PackageX,
  PhoneCall,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { BRL, NUM, toLocalDate } from "@/lib/format";
import { HERO_IMAGES, heroSrc, heroSrcSet } from "@/lib/hero-images";
import { CountUp } from "@/components/count-up";
import { OperationsDashboard } from "@/components/dashboard/operations-dashboard";
import { FirstSteps } from "@/components/onboarding/first-steps";

export const Route = createFileRoute("/app/hoje")({
  head: () => ({
    meta: [
      { title: "Início — GBS" },
      { name: "description", content: "Sua visão executiva do dia no Guerra Business System." },
    ],
  }),
  component: HojePage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function endOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return x;
}

function useToday(orgId: string | null) {
  return useQuery({
    queryKey: ["hoje-overview", orgId],
    enabled: !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const org = orgId!;
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();
      const todayISO = now.toISOString().slice(0, 10);

      const orgEq = <T extends { eq: any; is: any }>(q: T): T =>
        q.eq("organization_id", org).is("archived_at", null);

      const [
        lecturesToday,
        followUps,
        movInMonth,
        contractsPending,
        upcoming30,
        recentInMonth,
        lowStock,
        pendingReceive,
        audienceAll,
        seasonActive,
        monthlyTargetSum,
        lecturesMonthCount,
      ] = await Promise.all([
        // Palestras de hoje
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", todayStart)
          .lte("scheduled_at", todayEnd),
        // Follow-ups vencendo (contatos com next_action_on <= hoje)
        orgEq(supabase.from("contacts").select("id", { count: "exact", head: true })).lte(
          "next_action_on",
          todayISO,
        ),
        // Recebimentos previstos no mês
        fetchAll(() =>
          supabase
            .from("financial_movements")
            .select("amount, expected_amount, status")
            .eq("organization_id", org)
            .is("archived_at", null)
            .eq("direction", "in")
            .gte("occurs_on", monthStart.slice(0, 10))
            .lte("occurs_on", monthEnd.slice(0, 10)),
        ),
        // Contratos pendentes — palestras confirmadas sem contrato assinado
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true })).in("status", [
          "proposta",
          "confirmada",
        ]),
        // Próximas 30 dias
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", todayStart)
          .lte("scheduled_at", in30),
        // Receita realizada no mês
        fetchAll(() =>
          supabase
            .from("financial_movements")
            .select("amount")
            .eq("organization_id", org)
            .is("archived_at", null)
            .eq("direction", "in")
            .eq("status", "liquidado")
            .gte("occurs_on", monthStart.slice(0, 10))
            .lte("occurs_on", monthEnd.slice(0, 10)),
        ),
        // Estoque (usa min_quantity)
        supabase
          .from("stock_items")
          .select("id, min_quantity")
          .eq("organization_id", org)
          .is("archived_at", null),
        // A receber (não liquidado, in)
        fetchAll(() =>
          supabase
            .from("financial_movements")
            .select("expected_amount, amount, status")
            .eq("organization_id", org)
            .is("archived_at", null)
            .eq("direction", "in")
            .neq("status", "liquidado"),
        ),
        // Vidas impactadas
        fetchAll(() =>
          supabase
            .from("lectures")
            .select("actual_audience")
            .eq("organization_id", org)
            .is("archived_at", null)
            .eq("status", "realizada"),
        ),
        // Temporada ativa
        supabase
          .from("seasons")
          .select("id, name, starts_on, ends_on")
          .eq("organization_id", org)
          .is("archived_at", null)
          .eq("status", "ativa")
          .order("starts_on", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Placeholder para futuras metas — mantém compatibilidade estrutural
        supabase
          .from("seasons")
          .select("starts_on, ends_on")
          .eq("organization_id", org)
          .is("archived_at", null)
          .eq("status", "ativa"),
        // Palestras no mês
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", monthStart)
          .lte("scheduled_at", monthEnd),
      ]);

      const receitaPrevista = (movInMonth.data ?? []).reduce(
        (s, r) => s + Number(r.expected_amount ?? r.amount ?? 0),
        0,
      );
      const receitaRealizada = (recentInMonth.data ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      );

      // "Estoque baixo" = itens com min_quantity > 0 (visualização simplificada — saldo real depende de movimentos)
      const lowStockCount = (lowStock.data ?? []).filter(
        (it) => Number(it.min_quantity ?? 0) > 0,
      ).length;

      const aReceber = (pendingReceive.data ?? []).reduce(
        (s, r) => s + Number(r.expected_amount ?? r.amount ?? 0),
        0,
      );

      const audienceTotal = (audienceAll.data ?? []).reduce(
        (s, r) => s + Number(r.actual_audience ?? 0),
        0,
      );

      const season = seasonActive.data as {
        name?: string;
        starts_on?: string;
        ends_on?: string;
      } | null;
      const seasonLabel = season?.name ?? "—";
      const seasonRange =
        season && season.starts_on && season.ends_on
          ? `${toLocalDate(season.starts_on).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${toLocalDate(season.ends_on).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
          : "";

      // Sem coluna de meta configurada — meta mensal indisponível
      const mensalTarget = 0;
      const metaPct = 0;

      return {
        lecturesTodayCount: lecturesToday.count ?? 0,
        followUpsPending: followUps.count ?? 0,
        pagamentosPrevistos: receitaPrevista,
        contractsPending: contractsPending.count ?? 0,
        upcoming30Days: upcoming30.count ?? 0,
        lecturesMonth: lecturesMonthCount.count ?? 0,
        receitaPrevista,
        receitaRealizada,
        lowStockCount,
        aReceber,
        audienceTotal,
        seasonLabel,
        seasonRange,
        mensalTarget,
        metaPct,
      };
    },
  });
}

function HeroStat({
  label,
  value,
  format,
  accent,
  i,
}: {
  label: string;
  value: number | null;
  format: (n: number) => string;
  accent?: boolean;
  i: number;
}) {
  return (
    <div
      className="reveal rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-md transition-colors hover:bg-white/[0.11]"
      style={{ "--i": i } as CSSProperties}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-foreground/60">
        {label}
      </div>
      <div
        className={`mt-3 font-display text-[2rem] leading-none ${accent ? "text-gold" : "text-ink-foreground"}`}
      >
        {value == null ? "—" : <CountUp value={value} format={format} />}
      </div>
    </div>
  );
}

function TodayCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  attention,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  to: string;
  attention?: boolean;
  progress?: number;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "hover-lift group relative flex flex-col rounded-2xl border bg-card p-5 shadow-[var(--shadow-elegant)] transition-colors",
        attention ? "border-clay/40" : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "grid h-9 w-9 place-items-center rounded-xl transition-colors",
            attention
              ? "bg-clay text-clay-foreground"
              : "bg-muted text-muted-foreground group-hover:bg-clay/10 group-hover:text-clay",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-4 text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl leading-none">{value}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-clay transition-[width] duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <div className="mt-2 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function HojePage() {
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();
  const firstName =
    ((user?.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";
  const q = useToday(organizationId ?? null);
  const d = q.data;

  const todayRaw = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);
  const loading = q.isLoading || !d;

  const fmtInt = (n: number | undefined) => (n == null ? "—" : NUM.format(n));

  // Resumo do dia em uma frase — o que realmente importa ao abrir o sistema.
  const brief = useMemo(() => {
    if (!d) return "Preparando o resumo do seu dia…";
    const parts: string[] = [];
    parts.push(
      d.lecturesTodayCount === 0
        ? "Nenhuma palestra hoje"
        : `${d.lecturesTodayCount} ${d.lecturesTodayCount === 1 ? "palestra" : "palestras"} hoje`,
    );
    if (d.pagamentosPrevistos > 0)
      parts.push(`${BRL.format(d.pagamentosPrevistos)} previstos para entrar no mês`);
    const attention = d.followUpsPending + d.contractsPending + d.lowStockCount;
    parts.push(
      attention === 0
        ? "nada pendente pedindo sua atenção"
        : `${attention} ${attention === 1 ? "ponto pede" : "pontos pedem"} sua atenção`,
    );
    return parts.join(" · ") + ".";
  }, [d]);
  const fmtBRL = (n: number | undefined) => (n == null ? "—" : BRL.format(n));

  const metaHint = useMemo(() => {
    if (!d) return "";
    if (!d.mensalTarget) return "Sem meta definida";
    return `${BRL.format(d.receitaRealizada)} de ${BRL.format(d.mensalTarget)}`;
  }, [d]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <section className="relative mb-12 overflow-hidden rounded-[28px] bg-ink text-ink-foreground shadow-[0_30px_80px_-40px_oklch(0.2_0.02_60/0.6)]">
        <div aria-hidden className="absolute inset-0">
          <img
            src={heroSrc(HERO_IMAGES.today, 1920)}
            srcSet={heroSrcSet(HERO_IMAGES.today)}
            sizes="(min-width: 1280px) 1200px, 100vw"
            alt=""
            className="ken-burns h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,oklch(0.17_0.01_60/0.95)_0%,oklch(0.17_0.01_60/0.75)_50%,oklch(0.17_0.01_60/0.25)_100%)]" />
          <div
            className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
          />
        </div>

        <div className="relative flex min-h-[380px] flex-col justify-between gap-10 p-8 md:p-12">
          <div>
            <div
              className="reveal inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-medium text-ink-foreground/90 backdrop-blur"
              style={{ "--i": 0 } as CSSProperties}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-clay" />
              {today}
            </div>
            <h1
              className="reveal mt-5 max-w-2xl font-display text-[2.6rem] leading-[1.05] md:text-[3.6rem]"
              style={{ "--i": 1 } as CSSProperties}
            >
              {greeting()}
              {firstName ? `, ${firstName}` : ""}.
            </h1>
            <p
              className="reveal mt-4 max-w-lg text-[15px] leading-relaxed text-ink-foreground/70"
              style={{ "--i": 2 } as CSSProperties}
            >
              {brief}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <HeroStat
              i={3}
              label="Vidas impactadas"
              value={loading ? null : (d?.audienceTotal ?? 0)}
              format={(n) => NUM.format(Math.round(n))}
              accent
            />
            <HeroStat
              i={4}
              label="Receita realizada no mês"
              value={loading ? null : (d?.receitaRealizada ?? 0)}
              format={(n) => BRL.format(n)}
            />
            <HeroStat
              i={5}
              label="Palestras nos próximos 30 dias"
              value={loading ? null : (d?.upcoming30Days ?? 0)}
              format={(n) => NUM.format(Math.round(n))}
            />
          </div>
        </div>
      </section>

      <FirstSteps />

      {/* Seu dia */}
      <section className="mb-14">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-2xl">Seu dia</h2>
          <span className="text-xs text-muted-foreground">toque em um cartão para abrir</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <TodayCard
            icon={Mic}
            label="Palestras hoje"
            value={loading ? "—" : fmtInt(d?.lecturesTodayCount)}
            hint={loading ? "" : `${fmtInt(d?.upcoming30Days)} nos próximos 30 dias`}
            to="/app/agenda"
          />
          <TodayCard
            icon={Wallet}
            label="A receber no mês"
            value={loading ? "—" : fmtBRL(d?.pagamentosPrevistos)}
            hint={loading ? "" : `${fmtBRL(d?.receitaRealizada)} já recebidos`}
            to="/app/financeiro"
          />
          <TodayCard
            icon={PhoneCall}
            label="Follow-ups"
            value={loading ? "—" : fmtInt(d?.followUpsPending)}
            hint="contatos para retomar"
            to="/app/crm"
            attention={!loading && (d?.followUpsPending ?? 0) > 0}
          />
          <TodayCard
            icon={FileSignature}
            label="Contratos pendentes"
            value={loading ? "—" : fmtInt(d?.contractsPending)}
            hint="aguardando confirmação"
            to="/app/palestras"
            attention={!loading && (d?.contractsPending ?? 0) > 0}
          />
          <TodayCard
            icon={PackageX}
            label="Estoque baixo"
            value={loading ? "—" : fmtInt(d?.lowStockCount)}
            hint="materiais para repor"
            to="/app/estoque"
            attention={!loading && (d?.lowStockCount ?? 0) > 0}
          />
          <TodayCard
            icon={Target}
            label="Meta do mês"
            value={loading ? "—" : `${d?.metaPct ?? 0}%`}
            hint={loading ? "" : metaHint}
            to="/app/metas"
            progress={loading ? undefined : (d?.metaPct ?? 0)}
          />
        </div>
      </section>

      {/* Operação: prioridades, temporada, agenda e o mês em números */}
      <OperationsDashboard view="overview" />
    </div>
  );
}
