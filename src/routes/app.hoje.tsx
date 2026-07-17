import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UserPlus, Building2, Handshake, FileText, Mic, Wallet, Sparkles, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/app/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — GBS" },
      { name: "description", content: "Sua visão executiva do dia no Guerra Business System." },
    ],
  }),
  component: HojePage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR");

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function startOfMonth(d = new Date()) { const x = startOfDay(d); x.setDate(1); return x; }
function endOfMonth(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23,59,59,999); return x; }

const FLOW = [
  { label: "Lead", to: "/app/crm", icon: UserPlus },
  { label: "Empresa", to: "/app/crm", icon: Building2 },
  { label: "Negociação", to: "/app/crm", icon: Handshake },
  { label: "Proposta", to: "/app/crm", icon: FileText },
  { label: "Palestra", to: "/app/palestras", icon: Mic },
  { label: "Financeiro", to: "/app/financeiro", icon: Wallet },
  { label: "Pós-venda", to: "/app/crm", icon: Sparkles },
] as const;

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
        lecturesToday, followUps, movInMonth, contractsPending,
        upcoming30, recentInMonth, lowStock, pendingReceive, audienceAll,
        seasonActive, monthlyTargetSum, lecturesMonthCount,
      ] = await Promise.all([
        // Palestras de hoje
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd),
        // Follow-ups vencendo (contatos com next_action_on <= hoje)
        orgEq(supabase.from("contacts").select("id", { count: "exact", head: true }))
          .lte("next_action_on", todayISO),
        // Recebimentos previstos no mês
        supabase.from("financial_movements").select("amount, expected_amount, status")
          .eq("organization_id", org).is("archived_at", null).eq("direction", "in")
          .gte("occurs_on", monthStart.slice(0,10)).lte("occurs_on", monthEnd.slice(0,10)),
        // Contratos pendentes — palestras confirmadas sem contrato assinado
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .in("status", ["proposta", "confirmada"]),
        // Próximas 30 dias
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", todayStart).lte("scheduled_at", in30),
        // Receita realizada no mês
        supabase.from("financial_movements").select("amount")
          .eq("organization_id", org).is("archived_at", null).eq("direction", "in")
          .eq("status", "liquidado").gte("occurs_on", monthStart.slice(0,10)).lte("occurs_on", monthEnd.slice(0,10)),
        // Estoque (usa min_quantity)
        supabase.from("stock_items").select("id, min_quantity")
          .eq("organization_id", org).is("archived_at", null),
        // A receber (não liquidado, in)
        supabase.from("financial_movements").select("expected_amount, amount, status")
          .eq("organization_id", org).is("archived_at", null).eq("direction", "in")
          .neq("status", "liquidado"),
        // Vidas impactadas
        supabase.from("lectures").select("actual_audience")
          .eq("organization_id", org).is("archived_at", null).eq("status", "realizada"),
        // Temporada ativa
        supabase.from("seasons").select("id, name, starts_on, ends_on")
          .eq("organization_id", org).is("archived_at", null).eq("status", "ativa")
          .order("starts_on", { ascending: false }).limit(1).maybeSingle(),
        // Placeholder para futuras metas — mantém compatibilidade estrutural
        supabase.from("seasons").select("starts_on, ends_on")
          .eq("organization_id", org).is("archived_at", null).eq("status", "ativa"),
        // Palestras no mês
        orgEq(supabase.from("lectures").select("id", { count: "exact", head: true }))
          .gte("scheduled_at", monthStart).lte("scheduled_at", monthEnd),
      ]);

      const receitaPrevista = (movInMonth.data ?? [])
        .reduce((s, r) => s + Number(r.expected_amount ?? r.amount ?? 0), 0);
      const receitaRealizada = (recentInMonth.data ?? [])
        .reduce((s, r) => s + Number(r.amount ?? 0), 0);

      // "Estoque baixo" = itens com min_quantity > 0 (visualização simplificada — saldo real depende de movimentos)
      const lowStockCount = (lowStock.data ?? [])
        .filter((it) => Number(it.min_quantity ?? 0) > 0)
        .length;

      const aReceber = (pendingReceive.data ?? [])
        .reduce((s, r) => s + Number(r.expected_amount ?? r.amount ?? 0), 0);

      const audienceTotal = (audienceAll.data ?? [])
        .reduce((s, r) => s + Number(r.actual_audience ?? 0), 0);

      const season = seasonActive.data as { name?: string; starts_on?: string; ends_on?: string } | null;
      const seasonLabel = season?.name ?? "—";
      const seasonRange = season && season.starts_on && season.ends_on
        ? `${new Date(season.starts_on).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(season.ends_on).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
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

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="hover-lift group rounded-2xl border border-border bg-card p-7">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-6 font-display text-[2rem] leading-none text-foreground">{value}</div>
      {hint && <div className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}

function TodayCard({ label, value, hint, to }: { label: string; value: ReactNode; hint?: string; to: string }) {
  return (
    <Link
      to={to}
      className="hover-lift block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-4 font-display text-2xl leading-none">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function HojePage() {
  const { organizationId } = useCurrentOrg();
  const q = useToday(organizationId ?? null);
  const d = q.data;

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const loading = q.isLoading || !d;

  const fmtInt = (n: number | undefined) => (n == null ? "—" : NUM.format(n));
  const fmtBRL = (n: number | undefined) => (n == null ? "—" : BRL.format(n));

  const metaHint = useMemo(() => {
    if (!d) return "";
    if (!d.mensalTarget) return "Sem meta definida";
    return `${BRL.format(d.receitaRealizada)} de ${BRL.format(d.mensalTarget)}`;
  }, [d]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <section className="mb-12">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          Hoje · {today}
        </div>
        <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-6xl">Visão Geral do Dia</h1>
        <p className="mt-3 text-sm text-muted-foreground">{greeting()}, Gustavo.</p>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Resultados extraordinários começam com pessoas extraordinárias.
        </p>
      </section>

      {/* Hoje — quick view */}
      <section className="mb-14">
        <div className="mb-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          Hoje
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <TodayCard label="Palestras de hoje" value={loading ? "—" : fmtInt(d?.lecturesTodayCount)} hint="Próximas 24h" to="/app/palestras" />
          <TodayCard label="Follow-ups pendentes" value={loading ? "—" : fmtInt(d?.followUpsPending)} hint="CRM" to="/app/crm" />
          <TodayCard label="Pagamentos previstos" value={loading ? "—" : fmtBRL(d?.pagamentosPrevistos)} hint="A receber no mês" to="/app/financeiro" />
          <TodayCard label="Contratos pendentes" value={loading ? "—" : fmtInt(d?.contractsPending)} hint="Aguardando confirmação" to="/app/palestras" />
          <TodayCard label="Meta mensal" value={loading ? "—" : `${d?.metaPct ?? 0}%`} hint={loading ? "" : metaHint} to="/app/temporadas" />
        </div>
      </section>

      {/* Fluxo Operacional */}
      <section className="mb-16">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-10">
          <div className="mb-8 flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Fluxo Operacional</div>
              <h2 className="mt-3 font-display text-2xl">A jornada de uma palestra no GBS</h2>
            </div>
          </div>
          <ol className="flex flex-wrap items-stretch gap-3">
            {FLOW.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.label} className="flex items-stretch gap-3">
                  <Link
                    to={step.to}
                    className="hover-lift group flex min-w-[140px] flex-col items-start justify-between rounded-2xl border border-border bg-background p-4 transition-colors hover:border-foreground/30"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground transition-colors group-hover:border-[var(--gold)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-6">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Etapa {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="mt-1 font-display text-base">{step.label}</div>
                    </div>
                  </Link>
                  {i < FLOW.length - 1 && (
                    <div className="flex items-center text-muted-foreground/60">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Vidas Impactadas */}
      <section className="mb-16">
        <div
          className="hover-lift relative overflow-hidden rounded-3xl p-10 md:p-14"
          style={{ background: "var(--navy)", color: "var(--navy-foreground)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[var(--navy-foreground)]/65">
              <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
              Vidas Impactadas
            </div>
            <div className="mt-8 font-display text-7xl leading-none tracking-tight md:text-[6.5rem]">
              {loading ? "—" : NUM.format(d?.audienceTotal ?? 0)}
            </div>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-[var(--navy-foreground)]/70">
              Pessoas transformadas pelas palestras, mentorias e projetos do Grupo Guerra.
            </p>
          </div>
        </div>
      </section>

      {/* Visão do dia */}
      <section>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Visão do dia</div>
            <h2 className="mt-3 font-display text-2xl">Indicadores principais</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Receita prevista" value={loading ? "—" : fmtBRL(d?.receitaPrevista)} hint="Este mês" />
          <Stat label="Receita realizada" value={loading ? "—" : fmtBRL(d?.receitaRealizada)} hint="Liquidada no mês" />
          <Stat label="Próximas palestras" value={loading ? "—" : String(d?.upcoming30Days ?? 0).padStart(2, "0")} hint="Próximos 30 dias" />
          <Stat label="Follow-ups pendentes" value={loading ? "—" : String(d?.followUpsPending ?? 0).padStart(2, "0")} hint="Para hoje" />
          <Stat label="Estoque baixo" value={loading ? "—" : String(d?.lowStockCount ?? 0).padStart(2, "0")} hint="Itens em reposição" />
          <Stat label="A receber" value={loading ? "—" : fmtBRL(d?.aReceber)} hint="Pendências financeiras" />
          <Stat label="Meta do mês" value={loading ? "—" : `${d?.metaPct ?? 0}%`} hint={metaHint} />
          <Stat label="Temporada atual" value={loading ? "—" : (d?.seasonLabel ?? "—")} hint={d?.seasonRange ?? ""} />
        </div>
      </section>
    </div>
  );
}
