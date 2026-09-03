import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, FileText, FileSpreadsheet, Wallet, TrendingUp, Users,
  Building2, Mic, MapPin, CalendarRange, Target, Info, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { cn } from "@/lib/utils";
import {
  exportSpeakerCSV, exportSpeakerXLSX, exportSpeakerPDF,
  type SpeakerReportContext,
} from "@/lib/speaker-report-export";

export const Route = createFileRoute("/app/centro-palestrante")({
  head: () => ({
    meta: [
      { title: "Centro Financeiro do Palestrante — GBS" },
      { name: "description", content: "Painel executivo financeiro do palestrante — indicadores, rentabilidade, metas e resultados consolidados." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CentroPalestrante,
});

/* ============================================================
 * Tipos derivados dos snapshots
 * ============================================================ */
type SnapshotRow = {
  id: string;
  lecture_id: string;
  agent_id: string | null;
  gustavo_amount: number | null;
  agent_amount: number | null;
  gross_revenue: number | null;
  net_profit: number | null;
  total_expenses: number | null;
  total_card_fees: number | null;
  total_stock_cost: number | null;
  closed_at: string | null;
  breakdown: unknown;
  lectures: {
    id?: string;
    title?: string;
    scheduled_at?: string | null;
    city?: string | null;
    state?: string | null;
    actual_audience?: number | null;
    expected_audience?: number | null;
    audience_size?: number | null;
    company_id?: string | null;
    season_id?: string | null;
    companies?: { id?: string; legal_name?: string | null } | null;
    seasons?: { id?: string; name?: string | null } | null;
    campaigns?: { id?: string; name?: string | null } | null;
    projects?: { id?: string; name?: string | null } | null;
  } | null;
  agents?: { id?: string; full_name?: string | null } | null;
};

type PendingLecture = {
  id: string;
  title: string | null;
  scheduled_at: string | null;
  gross_revenue: number | null;
  status: string | null;
  companies: { legal_name?: string | null } | null;
};

const TITHE = 0.10;

function CentroPalestrante() {
  const { organizationId } = useCurrentOrg();
  const [fStart, setFStart] = useState<string>("");
  const [fEnd, setFEnd] = useState<string>("");
  const [fCompany, setFCompany] = useState<string>("__all__");
  const [fCity, setFCity] = useState<string>("__all__");
  const [fState, setFState] = useState<string>("__all__");
  const [fSeason, setFSeason] = useState<string>("__all__");
  const [fCampaign, setFCampaign] = useState<string>("__all__");

  const snapshots = useQuery({
    queryKey: ["cfp-snapshots", organizationId],
    enabled: !!organizationId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecture_financial_snapshots")
        .select(`
          id, lecture_id, agent_id, gustavo_amount, agent_amount, gross_revenue, net_profit,
          total_expenses, total_card_fees, total_stock_cost, closed_at, breakdown,
          lectures:lecture_id (
            id, title, scheduled_at, city, state, actual_audience, expected_audience, audience_size,
            company_id, season_id,
            companies:company_id ( id, legal_name ),
            seasons:season_id ( id, name ),
            campaigns:campaign_id ( id, name ),
            projects:project_id ( id, name )
          ),
          agents:agent_id ( id, full_name )
        `)
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SnapshotRow[];
    },
  });

  const pending = useQuery({
    queryKey: ["cfp-pending", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at, gross_revenue, status, companies:company_id ( legal_name )")
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .in("status", ["agendada", "confirmada", "realizada"])
        .is("closed_at", null)
        .order("scheduled_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingLecture[];
    },
  });

  const speakerPayouts = useQuery({
    queryKey: ["cfp-speaker-payouts", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, amount, occurs_on, description, status, payment_method, category, direction, accounts:account_id ( name )")
        .eq("organization_id", organizationId!)
        .eq("direction", "out")
        .in("status", ["paga", "parcial"])
        .in("category", ["Pró-labore", "Palestrante"])
        .is("archived_at", null)
        .order("occurs_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const advances = useQuery({
    queryKey: ["cfp-advances", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select("id, amount, amount_amortized, granted_on, source, paid_by_label, status, notes, receipt_url, agents:agent_id ( full_name )")
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("granted_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /* ------------------------------------------------------------
   * Filtros / dados derivados
   * ------------------------------------------------------------ */
  const filtered = useMemo(() => {
    const rows = snapshots.data ?? [];
    return rows.filter((s) => {
      const d = s.closed_at ? s.closed_at.slice(0, 10) : null;
      if (fStart && (!d || d < fStart)) return false;
      if (fEnd && (!d || d > fEnd)) return false;
      const lec = s.lectures;
      if (fCompany !== "__all__" && lec?.company_id !== fCompany) return false;
      if (fCity !== "__all__" && (lec?.city ?? "") !== fCity) return false;
      if (fState !== "__all__" && (lec?.state ?? "") !== fState) return false;
      if (fSeason !== "__all__" && lec?.season_id !== fSeason) return false;
      if (fCampaign !== "__all__" && lec?.campaigns?.id !== fCampaign) return false;
      return true;
    });
  }, [snapshots.data, fStart, fEnd, fCompany, fCity, fState, fSeason, fCampaign]);

  const optCompanies = useMemo(() => {
    const m = new Map<string, string>();
    (snapshots.data ?? []).forEach((s) => {
      const c = s.lectures?.companies;
      if (c?.id && c.legal_name) m.set(c.id, c.legal_name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [snapshots.data]);
  const optCities = useMemo(() => {
    const s = new Set<string>();
    (snapshots.data ?? []).forEach((r) => { if (r.lectures?.city) s.add(r.lectures.city); });
    return Array.from(s).sort();
  }, [snapshots.data]);
  const optStates = useMemo(() => {
    const s = new Set<string>();
    (snapshots.data ?? []).forEach((r) => { if (r.lectures?.state) s.add(r.lectures.state); });
    return Array.from(s).sort();
  }, [snapshots.data]);
  const optSeasons = useMemo(() => {
    const m = new Map<string, string>();
    (snapshots.data ?? []).forEach((s) => {
      const se = s.lectures?.seasons;
      if (se?.id && se.name) m.set(se.id, se.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [snapshots.data]);
  const optCampaigns = useMemo(() => {
    const m = new Map<string, string>();
    (snapshots.data ?? []).forEach((s) => {
      const ca = s.lectures?.campaigns;
      if (ca?.id && ca.name) m.set(ca.id, ca.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [snapshots.data]);

  const speakerName = "Gustavo Guerra"; // Único palestrante — deriva no futuro se houver speaker_id
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const thisYear = now.getFullYear();

  // KPIs
  const kpis = useMemo(() => {
    const gross = filtered.reduce((s, r) => s + Number(r.gross_revenue ?? 0), 0);
    const netProfit = filtered.reduce((s, r) => s + Number(r.net_profit ?? 0), 0);
    const speakerTotal = filtered.reduce((s, r) => s + Number(r.gustavo_amount ?? 0), 0);
    const costs = filtered.reduce(
      (s, r) => s + Number(r.total_expenses ?? 0) + Number(r.total_card_fees ?? 0),
      0,
    );

    const paidToSpeaker = (speakerPayouts.data ?? []).reduce(
      (s, m) => s + Number(m.amount ?? 0),
      0,
    );
    const advancesOpen = (advances.data ?? []).reduce(
      (s, a) => s + Math.max(0, Number(a.amount ?? 0) - Number(a.amount_amortized ?? 0)),
      0,
    );

    const lucroMes = filtered
      .filter((r) => (r.closed_at ?? "").slice(0, 7) === thisMonth)
      .reduce((s, r) => s + Number(r.gustavo_amount ?? 0), 0);
    const lucroAno = filtered
      .filter((r) => (r.closed_at ?? "").slice(0, 4) === String(thisYear))
      .reduce((s, r) => s + Number(r.gustavo_amount ?? 0), 0);

    const aReceber = (pending.data ?? []).reduce(
      (s, p) => s + Number(p.gross_revenue ?? 0) * 0.5,
      0,
    );

    const companies = new Set(filtered.map((r) => r.lectures?.company_id).filter(Boolean));
    const audience = filtered.reduce(
      (s, r) =>
        s +
        Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0),
      0,
    );

    return {
      saldoAtual: speakerTotal - paidToSpeaker - advancesOpen,
      aReceber,
      recebido: paidToSpeaker,
      adiantamentosAbertos: advancesOpen,
      lucroMes,
      lucroAno,
      receitaBruta: gross,
      custosTotais: costs,
      margem: gross > 0 ? netProfit / gross : 0,
      dizimoSugerido: speakerTotal * TITHE,
      totalEmpresas: companies.size,
      totalPalestras: filtered.length,
      pessoasImpactadas: audience,
    };
  }, [filtered, speakerPayouts.data, advances.data, pending.data, thisMonth, thisYear]);

  // Extrato palestra a palestra
  const statement = useMemo(() => {
    type BD = { totals?: { totalStock?: number; totalCardFees?: number; totalTaxes?: number; totalCosts?: number; totalOtherExpenses?: number } };
    const rows = [...filtered]
      .sort((a, b) => (a.closed_at ?? "").localeCompare(b.closed_at ?? ""))
      .map((r) => {
        const bd = (r.breakdown ?? {}) as BD;
        const t = bd.totals ?? {};
        const materials = t.totalStock ?? Number(r.total_stock_cost ?? 0);
        const cardFees = t.totalCardFees ?? Number(r.total_card_fees ?? 0);
        const others = (t.totalTaxes ?? 0) + (t.totalCosts ?? 0) + (t.totalOtherExpenses ?? 0);
        const speakerShare = Number(r.gustavo_amount ?? 0);
        return {
          date: r.closed_at ? r.closed_at.slice(0, 10) : null,
          company: r.lectures?.companies?.legal_name ?? "—",
          lecture: r.lectures?.title ?? "Palestra",
          gross: Number(r.gross_revenue ?? 0),
          materials,
          cardFees,
          otherCosts: others,
          netProfit: Number(r.net_profit ?? 0),
          speakerShare,
          tithe: Math.round(speakerShare * TITHE * 100) / 100,
          balance: 0,
        };
      });
    let running = 0;
    return rows.map((r) => { running += r.speakerShare; return { ...r, balance: running }; });
  }, [filtered]);

  // Por empresa
  const byCompany = useMemo(() => {
    const m = new Map<string, {
      company: string; lectures: number; gross: number; netProfit: number;
      speakerShare: number; agentShare: number; audience: number;
    }>();
    filtered.forEach((r) => {
      const key = r.lectures?.companies?.legal_name ?? "—";
      const cur = m.get(key) ?? { company: key, lectures: 0, gross: 0, netProfit: 0, speakerShare: 0, agentShare: 0, audience: 0 };
      cur.lectures += 1;
      cur.gross += Number(r.gross_revenue ?? 0);
      cur.netProfit += Number(r.net_profit ?? 0);
      cur.speakerShare += Number(r.gustavo_amount ?? 0);
      cur.agentShare += Number(r.agent_amount ?? 0);
      cur.audience += Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((c) => ({ ...c, margin: c.gross > 0 ? c.netProfit / c.gross : 0 }))
      .sort((a, b) => b.gross - a.gross);
  }, [filtered]);

  // Por agendista
  const byAgent = useMemo(() => {
    const m = new Map<string, { agent: string; lectures: number; gross: number; netProfit: number; agentShare: number; audience: number }>();
    filtered.forEach((r) => {
      const key = r.agents?.full_name ?? "—";
      const cur = m.get(key) ?? { agent: key, lectures: 0, gross: 0, netProfit: 0, agentShare: 0, audience: 0 };
      cur.lectures += 1;
      cur.gross += Number(r.gross_revenue ?? 0);
      cur.netProfit += Number(r.net_profit ?? 0);
      cur.agentShare += Number(r.agent_amount ?? 0);
      cur.audience += Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((a) => ({ ...a, avgTicket: a.lectures > 0 ? a.gross / a.lectures : 0 }))
      .sort((a, b) => b.gross - a.gross);
  }, [filtered]);

  // Por cidade
  const byCity = useMemo(() => {
    const m = new Map<string, { city: string; lectures: number; gross: number; netProfit: number; audience: number }>();
    filtered.forEach((r) => {
      const key = [r.lectures?.city, r.lectures?.state].filter(Boolean).join(" / ") || "—";
      const cur = m.get(key) ?? { city: key, lectures: 0, gross: 0, netProfit: 0, audience: 0 };
      cur.lectures += 1;
      cur.gross += Number(r.gross_revenue ?? 0);
      cur.netProfit += Number(r.net_profit ?? 0);
      cur.audience += Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.gross - a.gross);
  }, [filtered]);

  // Por temporada
  const bySeason = useMemo(() => {
    const m = new Map<string, { season: string; gross: number; netProfit: number; lectures: number; audience: number; companies: Set<string> }>();
    filtered.forEach((r) => {
      const key = r.lectures?.seasons?.name ?? "Sem temporada";
      const cur = m.get(key) ?? { season: key, gross: 0, netProfit: 0, lectures: 0, audience: 0, companies: new Set<string>() };
      cur.gross += Number(r.gross_revenue ?? 0);
      cur.netProfit += Number(r.net_profit ?? 0);
      cur.lectures += 1;
      cur.audience += Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0);
      if (r.lectures?.company_id) cur.companies.add(r.lectures.company_id);
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((s) => ({ season: s.season, gross: s.gross, netProfit: s.netProfit, lectures: s.lectures, companies: s.companies.size, audience: s.audience }))
      .sort((a, b) => b.gross - a.gross);
  }, [filtered]);

  // Evolução mensal
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; gross: number; netProfit: number; lectures: number; companies: Set<string>; audience: number }>();
    filtered.forEach((r) => {
      const key = (r.closed_at ?? "").slice(0, 7) || "—";
      const cur = m.get(key) ?? { month: key, gross: 0, netProfit: 0, lectures: 0, companies: new Set<string>(), audience: 0 };
      cur.gross += Number(r.gross_revenue ?? 0);
      cur.netProfit += Number(r.net_profit ?? 0);
      cur.lectures += 1;
      if (r.lectures?.company_id) cur.companies.add(r.lectures.company_id);
      cur.audience += Number(r.lectures?.actual_audience ?? r.lectures?.expected_audience ?? r.lectures?.audience_size ?? 0);
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((x) => ({
        month: x.month, gross: x.gross, netProfit: x.netProfit, lectures: x.lectures,
        companies: x.companies.size, audience: x.audience,
        ticket: x.lectures > 0 ? Math.round(x.gross / x.lectures) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // Rentabilidade — lista ordenada por margem
  const rentability = useMemo(() => {
    return filtered
      .map((r) => {
        const gross = Number(r.gross_revenue ?? 0);
        const netProfit = Number(r.net_profit ?? 0);
        const margin = gross > 0 ? netProfit / gross : 0;
        return {
          id: r.id,
          date: r.closed_at,
          company: r.lectures?.companies?.legal_name ?? "—",
          lecture: r.lectures?.title ?? "Palestra",
          gross,
          materials: Number(r.total_stock_cost ?? 0),
          cardFees: Number(r.total_card_fees ?? 0),
          otherCosts: Math.max(0, Number(r.total_expenses ?? 0) - Number(r.total_stock_cost ?? 0)),
          netProfit,
          margin,
          speaker: Number(r.gustavo_amount ?? 0),
          agent: Number(r.agent_amount ?? 0),
        };
      })
      .sort((a, b) => b.margin - a.margin);
  }, [filtered]);

  // Metas — persistidas em localStorage
  const [goalMonth, setGoalMonth] = useLocalStorageNumber("cfp-goal-month", 0);
  const [goalYear, setGoalYear] = useLocalStorageNumber("cfp-goal-year", 0);
  const goalMonthPct = goalMonth > 0 ? Math.min(100, (kpis.lucroMes / goalMonth) * 100) : 0;
  const goalYearPct = goalYear > 0 ? Math.min(100, (kpis.lucroAno / goalYear) * 100) : 0;

  const periodLabel = useMemo(() => {
    if (!fStart && !fEnd) return "Todos os períodos";
    if (fStart && fEnd) return `${formatDate(fStart)} — ${formatDate(fEnd)}`;
    if (fStart) return `a partir de ${formatDate(fStart)}`;
    return `até ${formatDate(fEnd)}`;
  }, [fStart, fEnd]);

  const buildReport = (): SpeakerReportContext => ({
    speakerName,
    periodLabel,
    emittedAt: new Date().toLocaleString("pt-BR"),
    kpis,
    statement,
    byCompany,
    byAgent,
    byCity,
    bySeason,
  });

  const isLoading = snapshots.isLoading || pending.isLoading || speakerPayouts.isLoading || advances.isLoading;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Centro Financeiro do Palestrante"
        description="Painel executivo com indicadores, rentabilidade, resultados e projeções — 100% baseado nos snapshots congelados."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2">
                <Download className="h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportSpeakerPDF(buildReport())}>
                <FileText className="mr-2 h-4 w-4" /> PDF Executivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSpeakerXLSX(buildReport())}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSpeakerCSV(buildReport())}>
                <FileText className="mr-2 h-4 w-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div>
            <Label className="text-xs">Início</Label>
            <Input type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim</Label>
            <Input type="date" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
          </div>
          <FilterSelect label="Empresa" value={fCompany} onChange={setFCompany} options={optCompanies.map((c) => ({ value: c.id, label: c.name }))} />
          <FilterSelect label="Cidade" value={fCity} onChange={setFCity} options={optCities.map((c) => ({ value: c, label: c }))} />
          <FilterSelect label="Estado" value={fState} onChange={setFState} options={optStates.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Temporada" value={fSeason} onChange={setFSeason} options={optSeasons.map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect label="Campanha" value={fCampaign} onChange={setFCampaign} options={optCampaigns.map((c) => ({ value: c.id, label: c.name }))} />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados executivos...</div>
      ) : (
        <>
          {/* Dashboard KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <Kpi label="Saldo Atual" value={formatCurrency(kpis.saldoAtual)} highlight tone={kpis.saldoAtual >= 0 ? "positive" : "negative"} />
            <Kpi label="A Receber" value={formatCurrency(kpis.aReceber)} tone="neutral" />
            <Kpi label="Recebido" value={formatCurrency(kpis.recebido)} tone="positive" />
            <Kpi label="Adiantamentos" value={formatCurrency(kpis.adiantamentosAbertos)} tone="negative" />
            <Kpi label="Lucro — Mês" value={formatCurrency(kpis.lucroMes)} />
            <Kpi label="Lucro — Ano" value={formatCurrency(kpis.lucroAno)} />
            <Kpi label="Receita Bruta" value={formatCurrency(kpis.receitaBruta)} />
            <Kpi label="Custos Totais" value={formatCurrency(kpis.custosTotais)} tone="negative" />
            <Kpi label="Margem" value={`${(kpis.margem * 100).toFixed(1)}%`} tone={kpis.margem >= 0.4 ? "positive" : kpis.margem >= 0.2 ? "neutral" : "negative"} />
            <Kpi label="Dízimo Sugerido" value={formatCurrency(kpis.dizimoSugerido)} icon={<Info className="h-3 w-3" />} />
            <Kpi label="Empresas" value={String(kpis.totalEmpresas)} icon={<Building2 className="h-3 w-3" />} />
            <Kpi label="Palestras" value={String(kpis.totalPalestras)} icon={<Mic className="h-3 w-3" />} />
          </div>
          <div>
            <Kpi label="Pessoas Impactadas" value={kpis.pessoasImpactadas.toLocaleString("pt-BR")} icon={<Users className="h-3 w-3" />} fullWidth />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="extrato" className="mt-4">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="extrato">Extrato</TabsTrigger>
              <TabsTrigger value="resultados">Resultados</TabsTrigger>
              <TabsTrigger value="evolucao">Evolução Mensal</TabsTrigger>
              <TabsTrigger value="rentabilidade">Rentabilidade</TabsTrigger>
              <TabsTrigger value="adiantamentos">Adiantamentos & Pagamentos</TabsTrigger>
              <TabsTrigger value="dizimo">Dízimo</TabsTrigger>
              <TabsTrigger value="metas">Metas & Previsão</TabsTrigger>
            </TabsList>

            {/* Extrato */}
            <TabsContent value="extrato" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Extrato palestra a palestra</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {statement.length === 0 ? (
                    <EmptyRow message="Nenhuma palestra fechada no período." />
                  ) : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                          <Th>Data</Th><Th>Empresa</Th><Th>Palestra</Th>
                          <Th right>Bruto</Th><Th right>Materiais</Th>
                          <Th right>Juros/Taxa</Th><Th right>Outros</Th>
                          <Th right>Lucro</Th><Th right>Palestrante</Th>
                          <Th right>Dízimo</Th><Th right>Saldo</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {statement.map((r, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                            <Td>{formatDate(r.date)}</Td>
                            <Td className="font-medium">{r.company}</Td>
                            <Td className="text-muted-foreground">{r.lecture}</Td>
                            <Td right>{formatCurrency(r.gross)}</Td>
                            <Td right className="text-rose-600">{r.materials ? `−${formatCurrency(r.materials)}` : "—"}</Td>
                            <Td right className="text-rose-600">{r.cardFees ? `−${formatCurrency(r.cardFees)}` : "—"}</Td>
                            <Td right className="text-rose-600">{r.otherCosts ? `−${formatCurrency(r.otherCosts)}` : "—"}</Td>
                            <Td right className="font-semibold">{formatCurrency(r.netProfit)}</Td>
                            <Td right className="font-semibold text-navy">{formatCurrency(r.speakerShare)}</Td>
                            <Td right className="text-muted-foreground">{formatCurrency(r.tithe)}</Td>
                            <Td right className="font-bold">{formatCurrency(r.balance)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resultados */}
            <TabsContent value="resultados" className="mt-4">
              <Tabs defaultValue="empresa">
                <TabsList>
                  <TabsTrigger value="empresa"><Building2 className="h-3.5 w-3.5 mr-1.5" />Por Empresa</TabsTrigger>
                  <TabsTrigger value="agendista"><Users className="h-3.5 w-3.5 mr-1.5" />Por Agendista</TabsTrigger>
                  <TabsTrigger value="cidade"><MapPin className="h-3.5 w-3.5 mr-1.5" />Por Cidade</TabsTrigger>
                  <TabsTrigger value="temporada"><CalendarRange className="h-3.5 w-3.5 mr-1.5" />Por Temporada</TabsTrigger>
                </TabsList>
                <TabsContent value="empresa" className="mt-3">
                  <RankingTable
                    columns={["Empresa", "Palestras", "Receita", "Lucro", "Palestrante", "Agendista", "Público", "Margem"]}
                    rows={byCompany.map((r, idx) => [
                      <><Badge variant="outline" className="mr-2">#{idx + 1}</Badge>{r.company}</>,
                      r.lectures,
                      formatCurrency(r.gross),
                      formatCurrency(r.netProfit),
                      formatCurrency(r.speakerShare),
                      formatCurrency(r.agentShare),
                      r.audience.toLocaleString("pt-BR"),
                      <MarginBadge value={r.margin} />,
                    ])}
                  />
                </TabsContent>
                <TabsContent value="agendista" className="mt-3">
                  <RankingTable
                    columns={["Agendista", "Palestras", "Receita", "Lucro", "Participação", "Ticket Médio", "Público"]}
                    rows={byAgent.map((r, idx) => [
                      <><Badge variant="outline" className="mr-2">#{idx + 1}</Badge>{r.agent}</>,
                      r.lectures,
                      formatCurrency(r.gross),
                      formatCurrency(r.netProfit),
                      formatCurrency(r.agentShare),
                      formatCurrency(r.avgTicket),
                      r.audience.toLocaleString("pt-BR"),
                    ])}
                  />
                </TabsContent>
                <TabsContent value="cidade" className="mt-3">
                  <RankingTable
                    columns={["Cidade", "Palestras", "Receita", "Lucro", "Público"]}
                    rows={byCity.map((r) => [r.city, r.lectures, formatCurrency(r.gross), formatCurrency(r.netProfit), r.audience.toLocaleString("pt-BR")])}
                  />
                </TabsContent>
                <TabsContent value="temporada" className="mt-3">
                  <RankingTable
                    columns={["Temporada", "Receita", "Lucro", "Palestras", "Empresas", "Público"]}
                    rows={bySeason.map((r) => [r.season, formatCurrency(r.gross), formatCurrency(r.netProfit), r.lectures, r.companies, r.audience.toLocaleString("pt-BR")])}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* Evolução Mensal */}
            <TabsContent value="evolucao" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard title="Receita bruta × Lucro líquido">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="gross" name="Receita" stroke="#c8a45a" strokeWidth={2} />
                      <Line type="monotone" dataKey="netProfit" name="Lucro" stroke="#0f2747" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Palestras & Empresas atendidas">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="lectures" name="Palestras" fill="#0f2747" />
                      <Bar dataKey="companies" name="Empresas" fill="#c8a45a" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Pessoas impactadas">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Line type="monotone" dataKey="audience" name="Público" stroke="#166534" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Ticket médio mensal">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="ticket" name="Ticket médio" fill="#c8a45a" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            {/* Rentabilidade */}
            <TabsContent value="rentabilidade" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Análise por palestra — ordenada por margem</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {rentability.length === 0 ? <EmptyRow message="Nada para analisar ainda." /> : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                          <Th>Data</Th><Th>Empresa</Th><Th>Palestra</Th>
                          <Th right>Bruto</Th><Th right>Material</Th><Th right>Taxas</Th>
                          <Th right>Custos</Th><Th right>Lucro</Th><Th right>Palestrante</Th>
                          <Th right>Agendista</Th><Th right>Margem</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentability.map((r) => (
                          <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                            <Td>{formatDate(r.date)}</Td>
                            <Td className="font-medium">{r.company}</Td>
                            <Td className="text-muted-foreground">{r.lecture}</Td>
                            <Td right>{formatCurrency(r.gross)}</Td>
                            <Td right className="text-rose-600">{formatCurrency(r.materials)}</Td>
                            <Td right className="text-rose-600">{formatCurrency(r.cardFees)}</Td>
                            <Td right className="text-rose-600">{formatCurrency(r.otherCosts)}</Td>
                            <Td right className="font-semibold">{formatCurrency(r.netProfit)}</Td>
                            <Td right>{formatCurrency(r.speaker)}</Td>
                            <Td right>{formatCurrency(r.agent)}</Td>
                            <Td right><MarginBadge value={r.margin} /></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Adiantamentos & Pagamentos */}
            <TabsContent value="adiantamentos" className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-rose-600" />Adiantamentos do palestrante</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdvanceOpen(true)} disabled={!organizationId || !userId}>
                    <Plus className="h-3.5 w-3.5" /> Novo
                  </Button>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(advances.data ?? []).length === 0 ? <EmptyRow message="Sem adiantamentos." /> : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                          <Th>Data</Th><Th right>Valor</Th><Th>Origem</Th><Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(advances.data ?? []).map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <Td>{formatDate(a.granted_on)}</Td>
                            <Td right className="font-semibold text-rose-600">{formatCurrency(Number(a.amount ?? 0))}</Td>
                            <Td className="text-muted-foreground">{a.source ?? "—"}{a.paid_by_label ? ` · ${a.paid_by_label}` : ""}</Td>
                            <Td><Badge variant="outline">{a.status ?? "—"}</Badge></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-emerald-700" />Retiradas / pagamentos</CardTitle>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPayoutOpen(true)} disabled={!organizationId || !userId}>
                    <Plus className="h-3.5 w-3.5" /> Nova
                  </Button>
                </CardHeader>

                <CardContent className="overflow-x-auto">
                  {(speakerPayouts.data ?? []).length === 0 ? <EmptyRow message="Sem pagamentos registrados." /> : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                          <Th>Data</Th><Th>Descrição</Th><Th>Forma</Th><Th>Conta</Th><Th right>Valor</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(speakerPayouts.data ?? []).map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <Td>{formatDate(p.occurs_on)}</Td>
                            <Td>{p.description ?? "—"}</Td>
                            <Td className="text-muted-foreground">{p.payment_method ?? "—"}</Td>
                            <Td className="text-muted-foreground">{(p.accounts as { name?: string } | null)?.name ?? "—"}</Td>
                            <Td right className="font-semibold">{formatCurrency(Number(p.amount ?? 0))}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dízimo */}
            <TabsContent value="dizimo" className="mt-4 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-700" />
                  <div>
                    <strong className="text-amber-900 dark:text-amber-200">Informativo apenas.</strong>
                    <span className="text-amber-900/80 dark:text-amber-200/80"> O dízimo sugerido nunca é descontado automaticamente. Corresponde a 10% da participação individual do palestrante em cada fechamento.</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi label="Dízimo — Mês" value={formatCurrency(kpis.lucroMes * TITHE)} />
                <Kpi label="Dízimo — Ano" value={formatCurrency(kpis.lucroAno * TITHE)} />
                <Kpi label="Dízimo — Acumulado" value={formatCurrency(kpis.dizimoSugerido)} highlight />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Origem — por palestra</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                        <Th>Data</Th><Th>Empresa</Th><Th>Palestra</Th><Th right>Participação</Th><Th right>Dízimo 10%</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {statement.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <Td>{formatDate(r.date)}</Td>
                          <Td className="font-medium">{r.company}</Td>
                          <Td className="text-muted-foreground">{r.lecture}</Td>
                          <Td right>{formatCurrency(r.speakerShare)}</Td>
                          <Td right className="font-semibold text-amber-700">{formatCurrency(r.tithe)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Metas & Previsão */}
            <TabsContent value="metas" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Meta Mensal</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Meta de lucro no mês</Label>
                      <Input type="number" min={0} step={100} value={goalMonth || ""} onChange={(e) => setGoalMonth(Number(e.target.value) || 0)} placeholder="0,00" />
                    </div>
                    <div className="text-xs text-muted-foreground">Realizado: <strong>{formatCurrency(kpis.lucroMes)}</strong></div>
                    <ProgressBar pct={goalMonthPct} />
                    <div className="text-xs text-muted-foreground">Restante: <strong>{formatCurrency(Math.max(0, goalMonth - kpis.lucroMes))}</strong> · Atingido: <strong>{goalMonthPct.toFixed(1)}%</strong></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" />Meta Anual</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Meta de lucro no ano</Label>
                      <Input type="number" min={0} step={1000} value={goalYear || ""} onChange={(e) => setGoalYear(Number(e.target.value) || 0)} placeholder="0,00" />
                    </div>
                    <div className="text-xs text-muted-foreground">Realizado: <strong>{formatCurrency(kpis.lucroAno)}</strong></div>
                    <ProgressBar pct={goalYearPct} />
                    <div className="text-xs text-muted-foreground">Restante: <strong>{formatCurrency(Math.max(0, goalYear - kpis.lucroAno))}</strong> · Atingido: <strong>{goalYearPct.toFixed(1)}%</strong></div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />Previsão de recebimentos</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {(pending.data ?? []).length === 0 ? <EmptyRow message="Nenhuma palestra pendente de fechamento." /> : (
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                          <Th>Data</Th><Th>Empresa</Th><Th>Palestra</Th><Th>Status</Th><Th right>Valor Previsto</Th><Th right>Previsão do Palestrante</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pending.data ?? []).map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <Td>{formatDate(p.scheduled_at)}</Td>
                            <Td className="font-medium">{p.companies?.legal_name ?? "—"}</Td>
                            <Td className="text-muted-foreground">{p.title ?? "—"}</Td>
                            <Td><Badge variant="outline">{p.status ?? "—"}</Badge></Td>
                            <Td right>{formatCurrency(Number(p.gross_revenue ?? 0))}</Td>
                            <Td right className="font-semibold text-navy">{formatCurrency(Number(p.gross_revenue ?? 0) * 0.5)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/* ============================================================
 * Componentes auxiliares
 * ============================================================ */

function Kpi({
  label, value, highlight, tone = "neutral", icon, fullWidth,
}: {
  label: string; value: string; highlight?: boolean;
  tone?: "positive" | "negative" | "neutral"; icon?: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        highlight ? "bg-[color:var(--navy,#0f2747)] border-transparent text-white" : "bg-card",
        fullWidth && "col-span-full",
      )}
    >
      <div className={cn("text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5",
        highlight ? "text-amber-300" : "text-muted-foreground")}>
        {icon}{label}
      </div>
      <div className={cn(
        "mt-1.5 text-lg sm:text-xl font-bold tabular-nums",
        highlight ? "text-white" :
          tone === "positive" ? "text-emerald-700 dark:text-emerald-400" :
          tone === "negative" ? "text-rose-700 dark:text-rose-400" : "text-foreground",
      )}>{value}</div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={cn("py-2 px-2 font-semibold", right && "text-right")}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={cn("py-2 px-2 align-top", right && "text-right tabular-nums", className)}>{children}</td>;
}

function RankingTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        {rows.length === 0 ? <EmptyRow message="Sem dados para o filtro atual." /> : (
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                {columns.map((c, i) => <Th key={i} right={i > 0}>{c}</Th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                  {r.map((cell, j) => <Td key={j} right={j > 0}>{cell}</Td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function MarginBadge({ value }: { value: number }) {
  const pct = (value * 100).toFixed(1) + "%";
  const tone = value >= 0.4 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : value >= 0.2 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";
  return <span className={cn("inline-flex px-2 py-0.5 rounded font-semibold text-xs tabular-nums", tone)}>{pct}</span>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = clamped >= 100 ? "bg-emerald-600" : clamped >= 60 ? "bg-navy" : "bg-amber-500";
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <div className="text-center text-sm text-muted-foreground py-6">{message}</div>;
}

/* localStorage-persisted number */
function useLocalStorageNumber(key: string, initial: number): [number, (v: number) => void] {
  const [v, setV] = useState<number>(() => {
    if (typeof window === "undefined") return initial;
    const raw = window.localStorage.getItem(key);
    if (raw == null) return initial;
    const n = Number(raw);
    return Number.isFinite(n) ? n : initial;
  });
  const setter = (next: number) => {
    setV(next);
    if (typeof window !== "undefined") window.localStorage.setItem(key, String(next));
  };
  return [v, setter];
}
