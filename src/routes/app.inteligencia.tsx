import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Download, Printer, FileSpreadsheet, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader, EmptyState, NestedPageHeaders } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSettled } from "@/lib/finance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PainelDiretorPage } from "@/components/inteligencia/painel-diretor";
import { IndicadoresPage } from "@/components/inteligencia/indicadores";
import { PerformancePage } from "@/components/inteligencia/performance";
import { RelatoriosPage } from "@/components/inteligencia/relatorios";
import { NUM } from "@/lib/format";

export const Route = createFileRoute("/app/inteligencia")({
  head: () => ({
    meta: [
      { title: "Inteligência — GBS" },
      {
        name: "description",
        content:
          "Painel do diretor, indicadores, análises, rankings e relatórios em uma única central.",
      },
      { property: "og:title", content: "Inteligência — GBS" },
      { property: "og:description", content: "Central única de inteligência do Grupo Guerra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InteligenciaHub,
});

function InteligenciaHub() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Inteligência"
        title="Central de Inteligência"
        description="Visão do diretor, indicadores, análises, rankings e relatórios — tudo reunido em um só lugar."
      />
      <NestedPageHeaders value={true}>
        <Tabs defaultValue="diretor" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start bg-card/40">
            <TabsTrigger value="diretor">Painel do Diretor</TabsTrigger>
            <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
            <TabsTrigger value="analises">Análises</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>
          <TabsContent value="diretor">
            <PainelDiretorPage />
          </TabsContent>
          <TabsContent value="indicadores">
            <IndicadoresPage />
          </TabsContent>
          <TabsContent value="analises">
            <IntelligencePage />
          </TabsContent>
          <TabsContent value="performance">
            <PerformancePage />
          </TabsContent>
          <TabsContent value="relatorios">
            <RelatoriosPage />
          </TabsContent>
        </Tabs>
      </NestedPageHeaders>
    </div>
  );
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const BRL2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Period = "today" | "7d" | "30d" | "month" | "year" | "all";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function startOfYear(d = new Date()) {
  const x = startOfDay(d);
  x.setMonth(0, 1);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function periodRange(p: Period): { start: Date | null; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (p) {
    case "today":
      return { start: startOfDay(now), end };
    case "7d":
      return { start: addDays(startOfDay(now), -6), end };
    case "30d":
      return { start: addDays(startOfDay(now), -29), end };
    case "month":
      return { start: startOfMonth(now), end };
    case "year":
      return { start: startOfYear(now), end };
    case "all":
      return { start: null, end };
  }
}

function parseLocalDate(s: string | null): Date | null {
  if (!s) return null;
  return s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
}

type Filters = {
  period: Period;
  seasonId: string | "all";
  campaignId: string | "all";
  projectId: string | "all";
  companyId: string | "all";
  agentId: string | "all";
};

function useIntelData(orgId: string | null) {
  return useQuery({
    queryKey: ["intel-data", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const org = orgId!;
      const [
        movements,
        lectures,
        companies,
        agents,
        seasons,
        campaigns,
        projects,
        stockItems,
        stockMov,
        snapshots,
      ] = await Promise.all([
        supabase
          .from("financial_movements")
          .select(
            "id, amount, direction, status, occurs_on, season_id, project_id, company_id, agent_id, lecture_id, category, description",
          )
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("lectures")
          .select(
            "id, status, scheduled_at, actual_audience, expected_audience, gross_revenue, season_id, company_id, agent_id, campaign_id, project_id, title",
          )
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("companies")
          .select("id, trade_name, legal_name, status, created_at")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("agents")
          .select("id, full_name, status")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("seasons")
          .select("id, name, status, starts_on, ends_on")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("campaigns")
          .select("id, name, season_id")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("projects")
          .select("id, name, season_id, campaign_id")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("stock_items")
          .select("id, name, min_quantity, average_cost")
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("stock_movements")
          .select(
            "id, stock_item_id, direction, quantity, occurs_on, lecture_id, total_cost, unit_cost",
          )
          .eq("organization_id", org)
          .is("archived_at", null),
        supabase
          .from("lecture_financial_snapshots")
          .select("id, lecture_id, gross_revenue, total_expenses, net_profit, closed_at")
          .eq("organization_id", org)
          .is("archived_at", null),
      ]);

      return {
        movements: movements.data ?? [],
        lectures: lectures.data ?? [],
        companies: companies.data ?? [],
        agents: agents.data ?? [],
        seasons: seasons.data ?? [],
        campaigns: campaigns.data ?? [],
        projects: projects.data ?? [],
        stockItems: stockItems.data ?? [],
        stockMov: stockMov.data ?? [],
        snapshots: snapshots.data ?? [],
      };
    },
  });
}

function IntelligencePage() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data, isLoading, refetch, isFetching } = useIntelData(organizationId);

  const [filters, setFilters] = useState<Filters>({
    period: "year",
    seasonId: "all",
    campaignId: "all",
    projectId: "all",
    companyId: "all",
    agentId: "all",
  });

  const filtered = useMemo(() => {
    if (!data) return null;
    const { start, end } = periodRange(filters.period);

    const inDate = (d: Date | null) => {
      if (!d) return false;
      if (start && d < start) return false;
      return d <= end;
    };

    const movs = data.movements.filter((m) => {
      const d = parseLocalDate(m.occurs_on);
      if (!inDate(d)) return false;
      if (filters.seasonId !== "all" && m.season_id !== filters.seasonId) return false;
      if (filters.projectId !== "all" && m.project_id !== filters.projectId) return false;
      if (filters.companyId !== "all" && m.company_id !== filters.companyId) return false;
      if (filters.agentId !== "all" && m.agent_id !== filters.agentId) return false;
      return true;
    });

    const lectures = data.lectures.filter((l) => {
      const d = l.scheduled_at ? new Date(l.scheduled_at) : null;
      if (!inDate(d)) return false;
      if (filters.seasonId !== "all" && l.season_id !== filters.seasonId) return false;
      if (filters.campaignId !== "all" && l.campaign_id !== filters.campaignId) return false;
      if (filters.projectId !== "all" && l.project_id !== filters.projectId) return false;
      if (filters.companyId !== "all" && l.company_id !== filters.companyId) return false;
      if (filters.agentId !== "all" && l.agent_id !== filters.agentId) return false;
      return true;
    });

    return { movs, lectures };
  }, [data, filters]);

  if (orgLoading || isLoading || !data || !filtered) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader eyebrow="BI" title="Análises" description="Carregando dados…" />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const { movs, lectures } = filtered;

  // ===== Financeiro =====
  const settled = movs.filter((m) => isSettled(m.direction as "in" | "out", m.status));
  const revenue = settled
    .filter((m) => m.direction === "in")
    .reduce((a, m) => a + Number(m.amount ?? 0), 0);
  const expenses = settled
    .filter((m) => m.direction === "out")
    .reduce((a, m) => a + Number(m.amount ?? 0), 0);
  const profit = revenue - expenses;

  // KPIs por janela (independem de "period" — sempre Hoje/Semana/Mês/Ano)
  const now = new Date();
  const dToday = startOfDay(now);
  const d7 = addDays(dToday, -6);
  const dMonth = startOfMonth(now);
  const dYear = startOfYear(now);
  const sumByWindow = (dir: "in" | "out", from: Date) =>
    data.movements
      .filter((m) => isSettled(m.direction as "in" | "out", m.status) && m.direction === dir)
      .filter((m) => {
        const d = parseLocalDate(m.occurs_on);
        return d && d >= from;
      })
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);

  const revWin = {
    today: sumByWindow("in", dToday),
    week: sumByWindow("in", d7),
    month: sumByWindow("in", dMonth),
    year: sumByWindow("in", dYear),
  };
  const expWin = {
    today: sumByWindow("out", dToday),
    week: sumByWindow("out", d7),
    month: sumByWindow("out", dMonth),
    year: sumByWindow("out", dYear),
  };

  // ===== Palestras =====
  const totalLec = lectures.length;
  const confirmadas = lectures.filter((l) => l.status === "confirmada").length;
  const realizadas = lectures.filter(
    (l) => l.status === "realizada" || l.status === "encerrada",
  ).length;
  const canceladas = lectures.filter((l) => l.status === "cancelada").length;
  const audMean = realizadas
    ? lectures
        .filter((l) => l.status === "realizada" || l.status === "encerrada")
        .reduce((a, l) => a + (l.actual_audience ?? 0), 0) / realizadas
    : 0;
  const lectureIds = new Set(lectures.map((l) => l.id));
  const revPorPalestra = settled.filter(
    (m) => m.direction === "in" && m.lecture_id && lectureIds.has(m.lecture_id),
  );
  const ticketMedio = realizadas
    ? revPorPalestra.reduce((a, m) => a + Number(m.amount ?? 0), 0) / realizadas
    : 0;

  // Snapshot-based lucro médio
  const snapsInScope = data.snapshots.filter((s) => s.lecture_id && lectureIds.has(s.lecture_id));
  const lucroMedio = snapsInScope.length
    ? snapsInScope.reduce((a, s) => a + Number(s.net_profit ?? 0), 0) / snapsInScope.length
    : 0;
  const fatMedio = snapsInScope.length
    ? snapsInScope.reduce((a, s) => a + Number(s.gross_revenue ?? 0), 0) / snapsInScope.length
    : ticketMedio;

  // ===== Empresas =====
  const empAtivas = data.companies.filter((c) => (c.status ?? "ativa") !== "inativa").length;
  const empInativas = data.companies.filter((c) => c.status === "inativa").length;
  const novasMes = data.companies.filter(
    (c) => c.created_at && new Date(c.created_at) >= dMonth,
  ).length;

  // Ranking empresas
  const compMap = new Map(data.companies.map((c) => [c.id, c.trade_name || c.legal_name || "—"]));
  const compStats = new Map<string, { lectures: number; revenue: number }>();
  for (const l of lectures) {
    if (!l.company_id) continue;
    const s = compStats.get(l.company_id) ?? { lectures: 0, revenue: 0 };
    s.lectures++;
    compStats.set(l.company_id, s);
  }
  for (const m of settled.filter((m) => m.direction === "in" && m.company_id)) {
    const s = compStats.get(m.company_id!) ?? { lectures: 0, revenue: 0 };
    s.revenue += Number(m.amount ?? 0);
    compStats.set(m.company_id!, s);
  }
  const topCompByContratos = [...compStats.entries()]
    .map(([id, s]) => ({ id, name: compMap.get(id) ?? "—", ...s }))
    .sort((a, b) => b.lectures - a.lectures)
    .slice(0, 10);
  const topCompByRevenue = [...compStats.entries()]
    .map(([id, s]) => ({ id, name: compMap.get(id) ?? "—", ...s }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ===== Agendistas =====
  const agentMap = new Map(data.agents.map((a) => [a.id, a.full_name]));
  type AgentStat = { lectures: number; revenue: number; profit: number; companies: Set<string> };
  const agentStats = new Map<string, AgentStat>();
  for (const l of lectures) {
    if (!l.agent_id) continue;
    const s = agentStats.get(l.agent_id) ?? {
      lectures: 0,
      revenue: 0,
      profit: 0,
      companies: new Set(),
    };
    s.lectures++;
    if (l.company_id) s.companies.add(l.company_id);
    agentStats.set(l.agent_id, s);
  }
  for (const m of settled.filter((m) => m.direction === "in" && m.agent_id)) {
    const s = agentStats.get(m.agent_id!) ?? {
      lectures: 0,
      revenue: 0,
      profit: 0,
      companies: new Set(),
    };
    s.revenue += Number(m.amount ?? 0);
    agentStats.set(m.agent_id!, s);
  }
  for (const snap of snapsInScope) {
    const lec = lectures.find((l) => l.id === snap.lecture_id);
    if (!lec?.agent_id) continue;
    const s = agentStats.get(lec.agent_id) ?? {
      lectures: 0,
      revenue: 0,
      profit: 0,
      companies: new Set(),
    };
    s.profit += Number(snap.net_profit ?? 0);
    agentStats.set(lec.agent_id, s);
  }
  const agentRanking = [...agentStats.entries()].map(([id, s]) => ({
    id,
    name: agentMap.get(id) ?? "—",
    lectures: s.lectures,
    revenue: s.revenue,
    profit: s.profit,
    companies: s.companies.size,
  }));

  const recPorEmpresa = compStats.size
    ? revenue / Math.max(1, [...compStats.values()].filter((s) => s.revenue > 0).length)
    : 0;
  const recPorAgendista = agentStats.size
    ? revenue / Math.max(1, [...agentStats.values()].filter((s) => s.revenue > 0).length)
    : 0;

  // ===== Vidas impactadas (sempre por janela, sobre realizadas) =====
  const audWin = (from: Date | null) =>
    data.lectures
      .filter((l) => l.status === "realizada" || l.status === "encerrada")
      .filter((l) => {
        const d = l.scheduled_at ? new Date(l.scheduled_at) : null;
        return d && (!from || d >= from);
      })
      .reduce((a, l) => a + (l.actual_audience ?? 0), 0);
  const vidas = {
    today: audWin(dToday),
    week: audWin(d7),
    month: audWin(dMonth),
    year: audWin(dYear),
    total: audWin(null),
  };

  // ===== Estoque =====
  const stockItemMap = new Map(data.stockItems.map((i) => [i.id, i]));
  const stockUsage = new Map<string, { qty: number; cost: number }>();
  for (const m of data.stockMov.filter((m) => m.direction === "out")) {
    if (!m.stock_item_id) continue;
    const s = stockUsage.get(m.stock_item_id) ?? { qty: 0, cost: 0 };
    s.qty += Number(m.quantity ?? 0);
    s.cost += Number(m.total_cost ?? Number(m.unit_cost ?? 0) * Number(m.quantity ?? 0));
    stockUsage.set(m.stock_item_id, s);
  }
  const usedIds = new Set(stockUsage.keys());
  const itensMaisUsados = [...stockUsage.entries()]
    .map(([id, s]) => ({ id, name: stockItemMap.get(id)?.name ?? "—", qty: s.qty, cost: s.cost }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);
  const itensParados = data.stockItems.filter((i) => !usedIds.has(i.id)).slice(0, 10);
  const itensBaixo = data.stockItems.filter((i) => (i.min_quantity ?? 0) > 0).slice(0, 10);
  const lecturesWithStock = new Set(
    data.stockMov.filter((m) => m.lecture_id).map((m) => m.lecture_id!),
  );
  const stockCostTotal = data.stockMov.reduce((a, m) => a + Number(m.total_cost ?? 0), 0);
  const custoPorPalestra = lecturesWithStock.size ? stockCostTotal / lecturesWithStock.size : 0;

  // ===== Séries mensais (12 meses) =====
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(dToday);
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(ymKey(d));
  }
  const monthly: Record<
    string,
    {
      receita: number;
      despesa: number;
      lucro: number;
      palestras: number;
      empresas: number;
      vidas: number;
    }
  > = {};
  for (const m of months)
    monthly[m] = { receita: 0, despesa: 0, lucro: 0, palestras: 0, empresas: 0, vidas: 0 };

  for (const m of data.movements) {
    if (!isSettled(m.direction as "in" | "out", m.status)) continue;
    const d = parseLocalDate(m.occurs_on);
    if (!d) continue;
    const k = ymKey(d);
    if (!(k in monthly)) continue;
    if (m.direction === "in") monthly[k].receita += Number(m.amount ?? 0);
    else monthly[k].despesa += Number(m.amount ?? 0);
  }
  const companiesByMonth = new Map<string, Set<string>>();
  for (const l of data.lectures) {
    const d = l.scheduled_at ? new Date(l.scheduled_at) : null;
    if (!d) continue;
    const k = ymKey(d);
    if (!(k in monthly)) continue;
    monthly[k].palestras++;
    if (l.status === "realizada" || l.status === "encerrada")
      monthly[k].vidas += l.actual_audience ?? 0;
    if (l.company_id) {
      const set = companiesByMonth.get(k) ?? new Set();
      set.add(l.company_id);
      companiesByMonth.set(k, set);
    }
  }
  for (const k of months) {
    monthly[k].lucro = monthly[k].receita - monthly[k].despesa;
    monthly[k].empresas = companiesByMonth.get(k)?.size ?? 0;
  }
  const monthlySeries = months.map((k) => ({ mes: ymLabel(k), ...monthly[k] }));

  // ===== Temporadas (comparativo) =====
  const seasonStats = data.seasons.map((s) => {
    const inSeason = (sid: string | null) => sid === s.id;
    const lecs = data.lectures.filter((l) => inSeason(l.season_id));
    const mvs = data.movements.filter(
      (m) => inSeason(m.season_id) && isSettled(m.direction as "in" | "out", m.status),
    );
    const rev = mvs
      .filter((m) => m.direction === "in")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const exp = mvs
      .filter((m) => m.direction === "out")
      .reduce((a, m) => a + Number(m.amount ?? 0), 0);
    const comps = new Set(lecs.map((l) => l.company_id).filter(Boolean) as string[]);
    const vidas = lecs
      .filter((l) => l.status === "realizada" || l.status === "encerrada")
      .reduce((a, l) => a + (l.actual_audience ?? 0), 0);
    return {
      id: s.id,
      name: s.name,
      receita: rev,
      despesa: exp,
      lucro: rev - exp,
      palestras: lecs.length,
      empresas: comps.size,
      vidas,
    };
  });

  // ===== Filtros UI =====
  const campaignsFiltered =
    filters.seasonId === "all"
      ? data.campaigns
      : data.campaigns.filter((c) => c.season_id === filters.seasonId);
  const projectsFiltered = data.projects.filter((p) => {
    if (filters.seasonId !== "all" && p.season_id !== filters.seasonId) return false;
    if (filters.campaignId !== "all" && p.campaign_id !== filters.campaignId) return false;
    return true;
  });

  // ===== Export =====
  function exportCSV(filename: string, rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(";"),
      ...rows.map((r) => headers.map((h) => esc(r[h])).join(";")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAll(kind: "csv" | "xls") {
    const ext = kind === "xls" ? "xls" : "csv";
    // Excel reads CSV; .xls extension forces Excel to open it.
    exportCSV(`inteligencia-mensal.${ext}`, monthlySeries);
    exportCSV(`inteligencia-agendistas.${ext}`, agentRanking);
    exportCSV(`inteligencia-empresas.${ext}`, topCompByRevenue);
    exportCSV(`inteligencia-temporadas.${ext}`, seasonStats);
  }

  return (
    <div className="mx-auto max-w-7xl" id="intel-root">
      <PageHeader
        eyebrow="Business Intelligence"
        title="Análises"
        description="Indicadores estratégicos consolidados em tempo real, com base nos dados operacionais do Grupo Guerra."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={"mr-1.5 h-3.5 w-3.5 " + (isFetching ? "animate-spin" : "")} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportAll("csv")}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportAll("xls")}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <section className="mb-10 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-6 print:hidden">
        <FilterSelect
          label="Período"
          value={filters.period}
          onChange={(v) => setFilters((f) => ({ ...f, period: v as Period }))}
          options={[
            { v: "today", l: "Hoje" },
            { v: "7d", l: "Últimos 7 dias" },
            { v: "30d", l: "Últimos 30 dias" },
            { v: "month", l: "Mês atual" },
            { v: "year", l: "Ano atual" },
            { v: "all", l: "Tudo" },
          ]}
        />
        <FilterSelect
          label="Temporada"
          value={filters.seasonId}
          onChange={(v) =>
            setFilters((f) => ({ ...f, seasonId: v, campaignId: "all", projectId: "all" }))
          }
          options={[{ v: "all", l: "Todas" }, ...data.seasons.map((s) => ({ v: s.id, l: s.name }))]}
        />
        <FilterSelect
          label="Campanha"
          value={filters.campaignId}
          onChange={(v) => setFilters((f) => ({ ...f, campaignId: v, projectId: "all" }))}
          options={[
            { v: "all", l: "Todas" },
            ...campaignsFiltered.map((c) => ({ v: c.id, l: c.name })),
          ]}
        />
        <FilterSelect
          label="Projeto"
          value={filters.projectId}
          onChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
          options={[
            { v: "all", l: "Todos" },
            ...projectsFiltered.map((p) => ({ v: p.id, l: p.name })),
          ]}
        />
        <FilterSelect
          label="Empresa"
          value={filters.companyId}
          onChange={(v) => setFilters((f) => ({ ...f, companyId: v }))}
          options={[
            { v: "all", l: "Todas" },
            ...data.companies.map((c) => ({ v: c.id, l: c.trade_name || c.legal_name || "—" })),
          ]}
        />
        <FilterSelect
          label="Agendista"
          value={filters.agentId}
          onChange={(v) => setFilters((f) => ({ ...f, agentId: v }))}
          options={[
            { v: "all", l: "Todos" },
            ...data.agents.map((a) => ({ v: a.id, l: a.full_name })),
          ]}
        />
      </section>

      {/* Financeiro */}
      <Section eyebrow="Financeiro" title="Receita, despesa e resultado">
        <KpiGrid>
          <Kpi label="Receita (hoje)" value={BRL.format(revWin.today)} />
          <Kpi label="Receita (semana)" value={BRL.format(revWin.week)} />
          <Kpi label="Receita (mês)" value={BRL.format(revWin.month)} />
          <Kpi label="Receita (ano)" value={BRL.format(revWin.year)} />
          <Kpi label="Despesa (hoje)" value={BRL.format(expWin.today)} />
          <Kpi label="Despesa (semana)" value={BRL.format(expWin.week)} />
          <Kpi label="Despesa (mês)" value={BRL.format(expWin.month)} />
          <Kpi label="Despesa (ano)" value={BRL.format(expWin.year)} />
        </KpiGrid>
        <KpiGrid className="mt-px">
          <Kpi
            label="Lucro líquido (filtro)"
            value={BRL.format(profit)}
            hint={`Receita ${BRL.format(revenue)} − Despesa ${BRL.format(expenses)}`}
          />
          <Kpi label="Ticket médio palestra" value={BRL.format(ticketMedio)} />
          <Kpi label="Receita média / empresa" value={BRL.format(recPorEmpresa)} />
          <Kpi label="Receita média / agendista" value={BRL.format(recPorAgendista)} />
        </KpiGrid>
      </Section>

      {/* Palestras */}
      <Section eyebrow="Palestras" title="Operação de palco">
        <KpiGrid>
          <Kpi label="Total" value={NUM.format(totalLec)} />
          <Kpi label="Confirmadas" value={NUM.format(confirmadas)} />
          <Kpi label="Realizadas" value={NUM.format(realizadas)} />
          <Kpi label="Canceladas" value={NUM.format(canceladas)} />
          <Kpi label="Média de participantes" value={NUM.format(Math.round(audMean))} />
          <Kpi label="Faturamento médio" value={BRL.format(fatMedio)} />
          <Kpi
            label="Lucro médio"
            value={BRL.format(lucroMedio)}
            hint={
              snapsInScope.length
                ? `${snapsInScope.length} fechamentos`
                : "Sem fechamentos no recorte"
            }
          />
        </KpiGrid>
      </Section>

      {/* Empresas */}
      <Section eyebrow="Empresas" title="Carteira e desempenho">
        <KpiGrid>
          <Kpi label="Ativas" value={NUM.format(empAtivas)} />
          <Kpi label="Inativas" value={NUM.format(empInativas)} />
          <Kpi label="Novas no mês" value={NUM.format(novasMes)} />
          <Kpi label="Total na base" value={NUM.format(data.companies.length)} />
        </KpiGrid>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RankingTable
            title="Mais contrataram"
            rows={topCompByContratos.map((c) => ({
              left: c.name,
              right: `${NUM.format(c.lectures)} palestras`,
            }))}
          />
          <RankingTable
            title="Maior faturamento"
            rows={topCompByRevenue.map((c) => ({ left: c.name, right: BRL.format(c.revenue) }))}
          />
        </div>
      </Section>

      {/* Agendistas */}
      <Section eyebrow="Agendistas" title="Ranking de performance">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Agendista</th>
                <th className="px-4 py-3 text-right">Palestras</th>
                <th className="px-4 py-3 text-right">Empresas</th>
                <th className="px-4 py-3 text-right">Faturamento</th>
                <th className="px-4 py-3 text-right">Lucro gerado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentRanking.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="Sem dados de agendistas no recorte." />
                  </td>
                </tr>
              ) : (
                agentRanking
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">{a.name}</td>
                      <td className="px-4 py-3 text-right">{NUM.format(a.lectures)}</td>
                      <td className="px-4 py-3 text-right">{NUM.format(a.companies)}</td>
                      <td className="px-4 py-3 text-right">{BRL.format(a.revenue)}</td>
                      <td className="px-4 py-3 text-right">{BRL.format(a.profit)}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Vidas */}
      <Section eyebrow="Vidas Impactadas" title="Alcance acumulado">
        <KpiGrid>
          <Kpi label="Hoje" value={NUM.format(vidas.today)} />
          <Kpi label="Semana" value={NUM.format(vidas.week)} />
          <Kpi label="Mês" value={NUM.format(vidas.month)} />
          <Kpi label="Ano" value={NUM.format(vidas.year)} />
          <Kpi label="Histórico" value={NUM.format(vidas.total)} />
        </KpiGrid>
      </Section>

      {/* Temporadas */}
      <Section eyebrow="Temporadas" title="Comparativo entre ciclos">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Temporada</th>
                <th className="px-4 py-3 text-right">Receita</th>
                <th className="px-4 py-3 text-right">Lucro</th>
                <th className="px-4 py-3 text-right">Empresas</th>
                <th className="px-4 py-3 text-right">Palestras</th>
                <th className="px-4 py-3 text-right">Vidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {seasonStats.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="Nenhuma temporada cadastrada." />
                  </td>
                </tr>
              ) : (
                seasonStats.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3 text-right">{BRL.format(s.receita)}</td>
                    <td className="px-4 py-3 text-right">{BRL.format(s.lucro)}</td>
                    <td className="px-4 py-3 text-right">{NUM.format(s.empresas)}</td>
                    <td className="px-4 py-3 text-right">{NUM.format(s.palestras)}</td>
                    <td className="px-4 py-3 text-right">{NUM.format(s.vidas)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Estoque */}
      <Section eyebrow="Estoque" title="Materiais e custo operacional">
        <KpiGrid>
          <Kpi label="Itens cadastrados" value={NUM.format(data.stockItems.length)} />
          <Kpi label="Itens parados" value={NUM.format(itensParados.length)} />
          <Kpi label="Com mínimo definido" value={NUM.format(itensBaixo.length)} />
          <Kpi label="Custo médio / palestra" value={BRL2.format(custoPorPalestra)} />
        </KpiGrid>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <RankingTable
            title="Mais utilizados"
            rows={itensMaisUsados.map((i) => ({ left: i.name, right: `${NUM.format(i.qty)} un.` }))}
          />
          <RankingTable
            title="Parados (sem saída)"
            rows={itensParados.map((i) => ({ left: i.name, right: "—" }))}
          />
          <RankingTable
            title="Com estoque mínimo"
            rows={itensBaixo.map((i) => ({
              left: i.name,
              right: `mín ${NUM.format(Number(i.min_quantity ?? 0))}`,
            }))}
          />
        </div>
      </Section>

      {/* Gráficos */}
      <Section eyebrow="Gráficos" title="Tendências mensais (12 meses)">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard title="Receita × Despesa">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => BRL.format(Number(v))}
                  width={80}
                />
                <Tooltip formatter={(v: number) => BRL2.format(v)} />
                <Legend />
                <Bar
                  dataKey="receita"
                  name="Receita"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="despesa"
                  name="Despesa"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Lucro mensal">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => BRL.format(Number(v))}
                  width={80}
                />
                <Tooltip formatter={(v: number) => BRL2.format(v)} />
                <Line
                  type="monotone"
                  dataKey="lucro"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Palestras por mês">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Bar
                  dataKey="palestras"
                  name="Palestras"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Empresas atendidas por mês">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Bar
                  dataKey="empresas"
                  name="Empresas"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Vidas impactadas por mês">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="vidas"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top 10 agendistas — faturamento">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={agentRanking.sort((a, b) => b.revenue - a.revenue).slice(0, 10)}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => BRL.format(Number(v))}
                />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: number) => BRL2.format(v)} />
                <Bar
                  dataKey="revenue"
                  name="Faturamento"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top 10 empresas — faturamento">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topCompByRevenue} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => BRL.format(Number(v))}
                />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: number) => BRL2.format(v)} />
                <Bar
                  dataKey="revenue"
                  name="Faturamento"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="mb-6">
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          {eyebrow}
        </div>
        <h2 className="mt-3 font-display text-2xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-4 " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-xl leading-none">{value}</div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function RankingTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ left: string; right: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">Sem dados.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between px-5 py-3">
              <span className="truncate text-sm">
                {i + 1}. {r.left}
              </span>
              <span className="ml-3 shrink-0 font-display text-sm">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
