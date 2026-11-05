import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { BRL, NUM } from "@/lib/format";
import { HERO_IMAGES, heroSrc, heroSrcSet } from "@/lib/hero-images";
import { CountUp } from "@/components/count-up";
import { OperationsDashboard } from "@/components/dashboard/operations-dashboard";
import { FirstSteps } from "@/components/onboarding/first-steps";

export const Route = createFileRoute("/app/hoje")({
  head: () => ({
    meta: [
      { title: "Início — GBS" },
      { name: "description", content: "Sua visão executiva do dia no Guerra Business System." },
      { property: "og:title", content: "Início — GBS" },
      { property: "og:description", content: "Agenda, prioridades e resumo operacional da sua organização no GBS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: heroSrc(HERO_IMAGES.today, 1920) },
      { name: "twitter:image", content: heroSrc(HERO_IMAGES.today, 1920) },
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
      if (!orgId) throw new Error("Organização não selecionada.");
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const monthStart = startOfMonth(now).toISOString().slice(0, 10);
      const monthEnd = endOfMonth(now).toISOString().slice(0, 10);
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString();
      const [lecturesToday, upcoming30, recentInMonth, audienceAll] = await Promise.all([
        supabase.from("lectures").select("id", { count: "exact", head: true })
          .eq("organization_id", orgId).is("archived_at", null)
          .gte("scheduled_at", todayStart).lte("scheduled_at", todayEnd),
        supabase.from("lectures").select("id", { count: "exact", head: true })
          .eq("organization_id", orgId).is("archived_at", null)
          .gte("scheduled_at", todayStart).lte("scheduled_at", in30),
        fetchAll(() => supabase.from("financial_movements").select("amount")
          .eq("organization_id", orgId).is("archived_at", null)
          .eq("direction", "in").eq("status", "liquidado")
          .gte("occurs_on", monthStart).lte("occurs_on", monthEnd)),
        fetchAll(() => supabase.from("lectures").select("actual_audience")
          .eq("organization_id", orgId).is("archived_at", null).eq("status", "realizada")),
      ]);
      for (const result of [lecturesToday, upcoming30, recentInMonth, audienceAll]) {
        if (result.error) throw result.error;
      }
      return {
        lecturesTodayCount: lecturesToday.count ?? 0,
        upcoming30Days: upcoming30.count ?? 0,
        receitaRealizada: (recentInMonth.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        audienceTotal: (audienceAll.data ?? []).reduce((sum, row) => sum + (row.actual_audience ?? 0), 0),
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

  // Resumo do dia em uma frase — o que realmente importa ao abrir o sistema.
  const brief = useMemo(() => {
    if (!d) return "Preparando o resumo do seu dia…";
    const parts: string[] = [];
    parts.push(
      d.lecturesTodayCount === 0
        ? "Nenhuma palestra hoje"
        : `${d.lecturesTodayCount} ${d.lecturesTodayCount === 1 ? "palestra" : "palestras"} hoje`,
    );
    if (d.receitaRealizada > 0)
      parts.push(`${BRL.format(d.receitaRealizada)} recebidos no mês`);
    return parts.join(" · ") + ".";
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

      {/* Operação: prioridades, temporada, agenda e o mês em números */}
      <OperationsDashboard view="overview" />
    </div>
  );
}
