import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";


type Tab = "agendistas" | "empresas" | "cidades" | "campanhas" | "temporadas" | "palestras";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR");

function useRankings(org: string | null) {
  return useQuery({
    queryKey: ["performance", org],
    enabled: !!org,
    queryFn: async () => {
      const orgId = org!;
      const { data: snaps } = await supabase
        .from("lecture_financial_snapshots")
        .select(`
          gross_revenue, net_profit, total_stock_cost, lecture_id, agent_id,
          lectures:lecture_id (
            id, title, city, actual_audience, campaign_id, season_id, company_id,
            companies:company_id ( id, trade_name, legal_name ),
            campaigns:campaign_id ( id, name ),
            seasons:season_id ( id, name )
          ),
          agents:agent_id ( id, full_name )
        `)
        .eq("organization_id", orgId)
        .is("archived_at", null);

      type Row = { key: string; label: string; revenue: number; profit: number; people: number; count: number; materials: number; ticket: number; linkTo?: string; linkId?: string };
      const buckets: Record<Tab, Map<string, Row>> = {
        agendistas: new Map(), empresas: new Map(), cidades: new Map(), campanhas: new Map(), temporadas: new Map(), palestras: new Map(),
      };
      const bump = (tab: Tab, key: string, label: string, s: any, linkTo?: string, linkId?: string) => {
        if (!key) return;
        const r = buckets[tab].get(key) ?? { key, label, revenue: 0, profit: 0, people: 0, count: 0, materials: 0, ticket: 0, linkTo, linkId };
        r.revenue += Number(s.gross_revenue ?? 0);
        r.profit += Number(s.net_profit ?? 0);
        r.materials += Number(s.total_stock_cost ?? 0);
        r.people += Number(s.lectures?.actual_audience ?? 0);
        r.count += 1;
        r.ticket = r.count > 0 ? r.revenue / r.count : 0;
        buckets[tab].set(key, r);
      };
      for (const s of (snaps ?? []) as any[]) {
        const l = s.lectures;
        if (s.agent_id) bump("agendistas", s.agent_id, s.agents?.full_name ?? "—", s, "/app/agendistas/$id", s.agent_id);
        if (l?.company_id) bump("empresas", l.company_id, l.companies?.trade_name ?? l.companies?.legal_name ?? "—", s, "/app/crm/$id", l.company_id);
        if (l?.city) bump("cidades", l.city, l.city, s);
        if (l?.campaign_id) bump("campanhas", l.campaign_id, l.campaigns?.name ?? "—", s, "/app/campanhas/$id", l.campaign_id);
        if (l?.season_id) bump("temporadas", l.season_id, l.seasons?.name ?? "—", s, "/app/temporadas/$id", l.season_id);
        if (l?.id) bump("palestras", l.id, l.title ?? "Palestra", s, "/app/palestras/$id", l.id);
      }
      const sorted: Record<Tab, Row[]> = {} as any;
      (Object.keys(buckets) as Tab[]).forEach((k) => {
        sorted[k] = Array.from(buckets[k].values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20);
      });
      return sorted;
    },
  });
}

export function PerformancePage() {
  const { organizationId } = useCurrentOrg();
  const [tab, setTab] = useState<Tab>("agendistas");
  const { data, isLoading } = useRankings(organizationId);

  const tabs: { key: Tab; label: string }[] = useMemo(() => ([
    { key: "agendistas", label: "Agendistas" },
    { key: "empresas", label: "Empresas" },
    { key: "cidades", label: "Cidades" },
    { key: "campanhas", label: "Campanhas" },
    { key: "temporadas", label: "Temporadas" },
    { key: "palestras", label: "Palestras" },
  ]), []);

  const rows = data?.[tab] ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Gestão" title="Performance" description="Rankings automáticos com base nos fechamentos de palestras." />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
              tab === t.key ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-card" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Sem palestras fechadas para gerar este ranking.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-[40px_minmax(0,1fr)_repeat(5,minmax(0,110px))] gap-4 border-b border-border px-5 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <div>#</div><div>Nome</div><div className="text-right">Receita</div><div className="text-right">Lucro</div><div className="text-right">Pessoas</div><div className="text-right">Materiais</div><div className="text-right">Ticket</div>
          </div>
          {rows.map((r, i) => {
            const Row = (
              <>
                <div className="flex items-center gap-1 text-sm font-medium">{i < 3 && <Trophy className="h-3.5 w-3.5" style={{ color: "var(--gold)" }} />}{i + 1}</div>
                <div className="truncate text-sm">{r.label}</div>
                <div className="text-right text-sm">{BRL.format(r.revenue)}</div>
                <div className="text-right text-sm">{BRL.format(r.profit)}</div>
                <div className="text-right text-sm">{NUM.format(r.people)}</div>
                <div className="text-right text-sm">{BRL.format(r.materials)}</div>
                <div className="text-right text-sm">{BRL.format(r.ticket)}</div>
              </>
            );
            const inner = r.linkTo && r.linkId
              ? <Link to={r.linkTo as any} params={{ id: r.linkId } as any} className="contents">{Row}</Link>
              : <>{Row}</>;
            return (
              <div key={r.key} className="grid grid-cols-[40px_minmax(0,1fr)_repeat(5,minmax(0,110px))] items-center gap-4 border-b border-border/60 px-5 py-3 last:border-b-0 hover:bg-muted/30">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
