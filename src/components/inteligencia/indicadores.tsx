import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { BRL, NUM } from "@/lib/format";

const PCT = (v: number) => `${(v * 100).toFixed(1)}%`;

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function useKpis(org: string | null) {
  return useQuery({
    queryKey: ["indicadores", org],
    enabled: !!org,
    staleTime: 30_000,
    queryFn: async () => {
      const orgId = org!;
      const monthStart = startOfMonth().toISOString();
      const orgIs = (q: any) => q.eq("organization_id", orgId).is("archived_at", null);

      const [
        companiesActive,
        companiesNew,
        lecturesAll,
        lecturesDone,
        agents,
        snapshots,
        stockItems,
        stockMovIn,
        stockMovOut,
        supplierSettlements,
      ] = await Promise.all([
        orgIs(supabase.from("companies").select("id", { count: "exact", head: true })).eq(
          "status",
          "ativa",
        ),
        orgIs(supabase.from("companies").select("id", { count: "exact", head: true })).gte(
          "created_at",
          monthStart,
        ),
        orgIs(supabase.from("lectures").select("id", { count: "exact", head: true })),
        fetchAll(() =>
          supabase
            .from("lectures")
            .select("id, actual_audience, status")
            .eq("organization_id", orgId)
            .is("archived_at", null)
            .eq("status", "realizada"),
        ),
        orgIs(supabase.from("agents").select("id", { count: "exact", head: true })),
        fetchAll(() =>
          supabase
            .from("lecture_financial_snapshots")
            .select("gross_revenue, net_profit, total_stock_cost")
            .eq("organization_id", orgId)
            .is("archived_at", null),
        ),
        supabase
          .from("stock_items")
          .select("id")
          .eq("organization_id", orgId)
          .is("archived_at", null),
        fetchAll(() =>
          supabase
            .from("stock_movements")
            .select("total_cost, kind, direction")
            .eq("organization_id", orgId)
            .is("archived_at", null),
        ),
        fetchAll(() =>
          supabase
            .from("stock_movements")
            .select("total_cost")
            .eq("organization_id", orgId)
            .is("archived_at", null),
        ),
        supabase.from("supplier_settlements").select("amount_paid").eq("organization_id", orgId),
      ]);

      const sumN = (rows: any[] | null, key: string) =>
        (rows ?? []).reduce((a, r) => a + Number(r?.[key] ?? 0), 0);
      const totalRevenue = sumN(snapshots.data as any, "gross_revenue");
      const totalProfit = sumN(snapshots.data as any, "net_profit");
      const totalStockCost = sumN(snapshots.data as any, "total_stock_cost");
      const doneCount = lecturesDone.data?.length ?? 0;
      const totalAudience = (lecturesDone.data ?? []).reduce(
        (a, r: any) => a + (r.actual_audience ?? 0),
        0,
      );
      const ticket = doneCount > 0 ? totalRevenue / doneCount : 0;

      const stockIn = (stockMovIn.data ?? [])
        .filter((m: any) => m.direction === "in")
        .reduce((a, r: any) => a + Number(r.total_cost ?? 0), 0);
      const stockOut = (stockMovIn.data ?? [])
        .filter((m: any) => m.direction === "out")
        .reduce((a, r: any) => a + Number(r.total_cost ?? 0), 0);
      const paidSuppliers = sumN(supplierSettlements.data as any, "amount_paid");
      const supplierBalance = stockIn - paidSuppliers;
      const conversion = (lecturesAll.count ?? 0) > 0 ? doneCount / (lecturesAll.count ?? 1) : 0;

      return {
        companiesActive: companiesActive.count ?? 0,
        companiesNew: companiesNew.count ?? 0,
        lecturesAll: lecturesAll.count ?? 0,
        lecturesDone: doneCount,
        agents: agents.count ?? 0,
        totalRevenue,
        totalProfit,
        ticket,
        totalAudience,
        stockIn,
        stockOut,
        stockValue: stockIn - stockOut,
        supplierBalance,
        conversion,
      };
    },
  });
}

function Kpi({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <div className="hover-lift h-full rounded-2xl border border-border bg-card p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-5 font-display text-[1.6rem] leading-none">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export function IndicadoresPage() {
  const { organizationId } = useCurrentOrg();
  const { data, isLoading } = useKpis(organizationId);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Gestão"
          title="Indicadores"
          description="Carregando KPIs consolidados…"
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Gestão"
        title="Indicadores"
        description="Painel executivo com os KPIs reais da organização."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Empresas Ativas" value={NUM.format(data.companiesActive)} to="/app/crm" />
        <Kpi label="Novas Empresas (mês)" value={NUM.format(data.companiesNew)} to="/app/crm" />
        <Kpi
          label="Palestras (total)"
          value={NUM.format(data.lecturesAll)}
          hint={`${data.lecturesDone} realizadas`}
          to="/app/palestras"
        />
        <Kpi label="Agendistas" value={NUM.format(data.agents)} to="/app/agendistas" />
        <Kpi
          label="Receita Consolidada"
          value={BRL.format(data.totalRevenue)}
          to="/app/financeiro"
        />
        <Kpi
          label="Lucro Consolidado"
          value={BRL.format(data.totalProfit)}
          to="/app/inteligencia"
        />
        <Kpi label="Ticket Médio" value={BRL.format(data.ticket)} />
        <Kpi label="Pessoas Impactadas" value={NUM.format(data.totalAudience)} />
        <Kpi label="Valor em Estoque" value={BRL.format(data.stockValue)} to="/app/estoque" />
        <Kpi label="Estoque Utilizado" value={BRL.format(data.stockOut)} />
        <Kpi
          label="Saldo com Fornecedor"
          value={BRL.format(data.supplierBalance)}
          hint="A acertar"
          to="/app/estoque"
        />
        <Kpi
          label="Taxa de Conversão"
          value={PCT(data.conversion)}
          hint="Palestras realizadas / total"
        />
      </div>
    </div>
  );
}
