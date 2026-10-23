import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Mic,
  Wallet,
  Package,
  FileText,
  CalendarRange,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lightbulb,
  Trophy,
  Users,
  ArrowRight,
  Phone,
  MapPin,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { lectureStatusLabel } from "@/lib/lectures";
import { AssistantGuerra } from "@/components/dashboard/assistant-guerra";
import { SetupBanner } from "@/components/onboarding/setup-banner";
import { BRL, NUM } from "@/lib/format";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({
    meta: [
      { title: "Centro de Operações — GBS" },
      {
        name: "description",
        content:
          "Painel executivo do Grupo Guerra: situação da temporada, agenda do dia, alertas, tarefas e insights automáticos.",
      },
      { property: "og:title", content: "Centro de Operações — GBS" },
      {
        property: "og:description",
        content: "Situação da temporada, agenda, alertas inteligentes e decisões em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const GOLD = "#C9A961";

const N = (v: unknown) => Number(v ?? 0) || 0;
const isoDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};
const dayOf = (s: string | null) => (s ? s.slice(0, 10) : null);
function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = s.length === 10 ? new Date(s + "T00:00:00") : new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function fmtTime(s: string | null | undefined) {
  if (!s) return "";
  return new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
  );
}

type Goals = {
  revenue: number;
  profit: number;
  lectures: number;
  companies: number;
  audience: number;
  books: number;
};
const DEFAULT_GOALS: Goals = {
  revenue: 0,
  profit: 0,
  lectures: 0,
  companies: 0,
  audience: 0,
  books: 0,
};
function readGoals(org: string, year: number): Goals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(`gbs.goals.${org}.${year}`);
    if (!raw) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GOALS;
  }
}

/* ------------------------------------------------------------------ data */

function useOperations(orgId: string | null) {
  return useQuery({
    queryKey: ["centro-operacoes", orgId],
    enabled: !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const org = orgId!;
      const base = <T extends { eq: any; is: any }>(q: T): T =>
        q.eq("organization_id", org).is("archived_at", null);

      const [
        seasons,
        lectures,
        movements,
        snapshots,
        items,
        batches,
        stockMovs,
        settlements,
        companies,
        campaigns,
        agents,
        projects,
        advances,
      ] = await Promise.all([
        base(supabase.from("seasons").select("id, name, status, starts_on, ends_on")),
        base(
          supabase
            .from("lectures")
            .select(
              "id, title, status, scheduled_at, scheduled_time, city, state, actual_audience, expected_audience, gross_revenue, financial_status, closed_at, season_id, campaign_id, project_id, company_id, agent_id, contact_id, companies:company_id(legal_name, trade_name), contacts:contact_id(full_name, phone, whatsapp), agents:agent_id(full_name)",
            ),
        ),
        base(
          supabase
            .from("financial_movements")
            .select(
              "id, direction, amount, expected_amount, net_amount, occurs_on, expected_date, status, category, description, company_id, season_id, project_id, agent_id, lecture_id",
            ),
        ),
        supabase
          .from("lecture_financial_snapshots")
          .select(
            "lecture_id, agent_id, gross_revenue, net_profit, gustavo_amount, agent_amount, total_expenses, total_stock_cost, total_card_fees, closed_at",
          )
          .eq("organization_id", org)
          .is("archived_at", null),
        base(
          supabase
            .from("stock_items")
            .select("id, name, min_quantity, average_cost, purchase_price, supplier"),
        ),
        base(
          supabase
            .from("inventory_batches")
            .select("id, stock_item_id, supplier, unit_cost, initial_quantity, quantity"),
        ),
        base(
          supabase
            .from("stock_movements")
            .select(
              "id, stock_item_id, kind, quantity, total_cost, unit_cost, status, occurs_on, lecture_id",
            ),
        ),
        base(
          supabase
            .from("supplier_settlements")
            .select("id, supplier, amount_paid, paid_on, season_id"),
        ),
        base(
          supabase
            .from("companies")
            .select("id, legal_name, trade_name, city, state, lifecycle_stage, updated_at"),
        ),
        base(supabase.from("campaigns").select("id, name, season_id")),
        base(supabase.from("agents").select("id, full_name")),
        base(supabase.from("projects").select("id, name, season_id, campaign_id")),
        base(
          supabase
            .from("advances")
            .select("id, agent_id, lecture_id, amount, amount_amortized, status, granted_on"),
        ),
      ]);

      return {
        seasons: seasons.data ?? [],
        lectures: (lectures.data ?? []) as any[],
        movements: (movements.data ?? []) as any[],
        snapshots: (snapshots.data ?? []) as any[],
        items: (items.data ?? []) as any[],
        batches: (batches.data ?? []) as any[],
        stockMovs: (stockMovs.data ?? []) as any[],
        settlements: (settlements.data ?? []) as any[],
        companies: (companies.data ?? []) as any[],
        campaigns: (campaigns.data ?? []) as any[],
        agents: (agents.data ?? []) as any[],
        projects: (projects.data ?? []) as any[],
        advances: (advances.data ?? []) as any[],
      };
    },
  });
}

/* ------------------------------------------------------------------- ui */

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          {eyebrow}
        </div>
        <h2 className="mt-3 font-display text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <div className="hover-lift h-full rounded-2xl border border-border bg-card p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-4 font-display text-[1.5rem] leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RankList({
  rows,
  format,
}: {
  rows: { name: string; value: number }[];
  format: (v: number) => string;
}) {
  if (rows.length === 0)
    return <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 font-display tabular-nums">{format(r.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: "var(--ink)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- page */

function DashboardPage() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data, isLoading } = useOperations(organizationId);
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});

  const year = new Date().getFullYear();
  useEffect(() => {
    if (organizationId) setGoals(readGoals(organizationId, year));
  }, [organizationId, year]);

  const model = useMemo(() => {
    if (!data) return null;
    const today = isoDay(new Date());
    const monthKey = today.slice(0, 7);
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthKey = isoDay(prevMonthDate).slice(0, 7);

    const {
      lectures,
      movements,
      snapshots,
      items,
      batches,
      stockMovs,
      settlements,
      companies,
      campaigns,
      agents,
      seasons,
    } = data;

    // ---- temporada ativa
    const activeSeason =
      seasons.find((s: any) => s.status === "ativa") ??
      seasons
        .slice()
        .sort((a: any, b: any) =>
          String(b.starts_on ?? "").localeCompare(String(a.starts_on ?? "")),
        )[0] ??
      null;
    const seasonId: string | null = activeSeason?.id ?? null;
    const inSeason = (sid: string | null) => (seasonId ? sid === seasonId : true);

    const seasonLectures = lectures.filter((l) => inSeason(l.season_id));
    const lectureSeason = new Map(lectures.map((l) => [l.id, l.season_id]));
    const seasonSnaps = snapshots.filter((s) => inSeason(lectureSeason.get(s.lecture_id) ?? null));

    const grossSeason = seasonSnaps.reduce((a, s) => a + N(s.gross_revenue), 0);
    const profitSeason = seasonSnaps.reduce((a, s) => a + N(s.net_profit), 0);
    const doneLectures = seasonLectures.filter(
      (l) => l.status === "realizada" || l.status === "encerrada",
    );
    const audienceSeason = doneLectures.reduce((a, l) => a + N(l.actual_audience), 0);
    const companiesSeason = new Set(seasonLectures.map((l) => l.company_id).filter(Boolean)).size;

    // ---- fornecedor / livros
    const purchased = batches.reduce(
      (a, b) => a + N(b.unit_cost) * N(b.initial_quantity ?? b.quantity),
      0,
    );
    const paidSupplier = settlements.reduce((a, s) => a + N(s.amount_paid), 0);
    const dueSupplier = Math.max(0, purchased - paidSupplier);
    const bySupplier = new Map<string, { purchased: number; paid: number }>();
    for (const b of batches) {
      const k = b.supplier ?? "Sem fornecedor";
      const cur = bySupplier.get(k) ?? { purchased: 0, paid: 0 };
      cur.purchased += N(b.unit_cost) * N(b.initial_quantity ?? b.quantity);
      bySupplier.set(k, cur);
    }
    for (const s of settlements) {
      const k = s.supplier ?? "Sem fornecedor";
      const cur = bySupplier.get(k) ?? { purchased: 0, paid: 0 };
      cur.paid += N(s.amount_paid);
      bySupplier.set(k, cur);
    }
    const suppliersDue = Array.from(bySupplier.entries())
      .map(([name, v]) => ({ name, due: v.purchased - v.paid }))
      .filter((s) => s.due > 0.5)
      .sort((a, b) => b.due - a.due);

    // ---- estoque
    const balance = new Map<string, number>();
    for (const m of stockMovs) {
      if (
        m.status === "cancelado" ||
        m.status === "estornado" ||
        m.kind === "cancelamento" ||
        !m.stock_item_id
      )
        continue;
      const q = N(m.quantity);
      const sign = m.kind === "saida" || m.kind === "baixa" || m.kind === "reserva" ? -1 : 1;
      balance.set(m.stock_item_id, (balance.get(m.stock_item_id) ?? 0) + sign * q);
    }
    const lowStock = items
      .filter((i) => N(i.min_quantity) > 0 && (balance.get(i.id) ?? 0) <= N(i.min_quantity))
      .map((i) => ({
        id: i.id,
        name: i.name,
        qty: balance.get(i.id) ?? 0,
        min: N(i.min_quantity),
      }));

    const usedQty = stockMovs
      .filter(
        (m) =>
          (m.kind === "saida" || m.kind === "baixa") &&
          m.status !== "cancelado" &&
          m.status !== "estornado",
      )
      .reduce((a, m) => a + N(m.quantity), 0);
    const usedCost = stockMovs
      .filter(
        (m) =>
          (m.kind === "saida" || m.kind === "baixa") &&
          m.status !== "cancelado" &&
          m.status !== "estornado",
      )
      .reduce((a, m) => a + (N(m.total_cost) || N(m.unit_cost) * N(m.quantity)), 0);
    const totalBalance = Array.from(balance.values()).reduce((a, b) => a + Math.max(0, b), 0);
    const avgPerLecture = doneLectures.length > 0 ? usedQty / doneLectures.length : 0;
    const lecturesCovered = avgPerLecture > 0 ? Math.floor(totalBalance / avgPerLecture) : 0;

    // custo por item (materiais)
    const costByItem = new Map<string, number>();
    for (const m of stockMovs) {
      if (
        m.status === "cancelado" ||
        m.status === "estornado" ||
        m.kind === "cancelamento" ||
        !m.stock_item_id
      )
        continue;
      if (m.kind !== "saida" && m.kind !== "baixa") continue;
      costByItem.set(
        m.stock_item_id,
        (costByItem.get(m.stock_item_id) ?? 0) +
          (N(m.total_cost) || N(m.unit_cost) * N(m.quantity)),
      );
    }
    const itemName = new Map(items.map((i) => [i.id, i.name]));
    const topMaterial =
      Array.from(costByItem.entries())
        .map(([id, v]) => ({ name: itemName.get(id) ?? "Item", value: v }))
        .sort((a, b) => b.value - a.value)[0] ?? null;

    // ---- financeiro
    const settled = (m: any) =>
      m.status === "recebido" || m.status === "paga" || m.status === "pago";
    const pending = (m: any) =>
      m.status === "previsto" || m.status === "prevista" || m.status === "parcial";
    const monthOf = (m: any) => dayOf(m.occurs_on ?? m.expected_date)?.slice(0, 7) ?? "";

    const monthIn = movements
      .filter((m) => m.direction === "in" && settled(m) && monthOf(m) === monthKey)
      .reduce((a, m) => a + N(m.amount), 0);
    const monthOut = movements
      .filter((m) => m.direction === "out" && settled(m) && monthOf(m) === monthKey)
      .reduce((a, m) => a + N(m.amount), 0);
    const prevIn = movements
      .filter((m) => m.direction === "in" && settled(m) && monthOf(m) === prevMonthKey)
      .reduce((a, m) => a + N(m.amount), 0);
    const prevOut = movements
      .filter((m) => m.direction === "out" && settled(m) && monthOf(m) === prevMonthKey)
      .reduce((a, m) => a + N(m.amount), 0);
    const expectedIn = movements
      .filter((m) => m.direction === "in" && pending(m))
      .reduce((a, m) => a + (N(m.expected_amount) || N(m.amount)), 0);
    const expectedOut = movements
      .filter((m) => m.direction === "out" && pending(m))
      .reduce((a, m) => a + (N(m.expected_amount) || N(m.amount)), 0);
    const totalInAll = movements
      .filter((m) => m.direction === "in" && settled(m))
      .reduce((a, m) => a + N(m.amount), 0);
    const totalOutAll = movements
      .filter((m) => m.direction === "out" && settled(m))
      .reduce((a, m) => a + N(m.amount), 0);
    const cashBalance = totalInAll - totalOutAll;

    const overdue = movements
      .filter((m) => pending(m) && m.expected_date && m.expected_date < today)
      .sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)));
    const dueSoon = movements
      .filter(
        (m) =>
          pending(m) &&
          m.expected_date &&
          m.expected_date >= today &&
          daysBetween(today, m.expected_date) <= 7,
      )
      .sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)));

    const yearIn = movements
      .filter((m) => m.direction === "in" && settled(m) && monthOf(m).startsWith(String(year)))
      .reduce((a, m) => a + N(m.amount), 0);

    // ---- agenda de hoje / próximos
    const todayLectures = lectures.filter((l) => dayOf(l.scheduled_at) === today);
    const nextLectures = lectures
      .filter((l) => l.scheduled_at && dayOf(l.scheduled_at)! > today)
      .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))
      .slice(0, 6);

    // ---- palestras sem fechamento financeiro
    const snapByLecture = new Set(snapshots.map((s) => s.lecture_id));
    const unclosed = lectures.filter(
      (l) =>
        (l.status === "realizada" || l.status === "encerrada") &&
        !snapByLecture.has(l.id) &&
        dayOf(l.scheduled_at)! < today,
    );

    // ---- empresas sem follow-up (60 dias)
    const staleCompanies = companies
      .filter((c) => {
        if (!c.updated_at) return false;
        const d = daysBetween(dayOf(c.updated_at)!, today);
        return d >= 60 && c.lifecycle_stage !== "cliente_perdido";
      })
      .map((c) => ({
        id: c.id,
        name: c.trade_name || c.legal_name,
        days: daysBetween(dayOf(c.updated_at)!, today),
      }))
      .sort((a, b) => b.days - a.days);

    // ---- desempenho
    const companyName = new Map(companies.map((c) => [c.id, c.trade_name || c.legal_name]));
    const agentName = new Map(agents.map((a) => [a.id, a.full_name]));
    const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
    const seasonName = new Map(seasons.map((s: any) => [s.id, s.name]));

    const agg = (key: (s: any) => string | null, val: (s: any) => number) => {
      const map = new Map<string, number>();
      for (const s of snapshots) {
        const k = key(s);
        if (!k) continue;
        map.set(k, (map.get(k) ?? 0) + val(s));
      }
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    };
    const lectureById = new Map(lectures.map((l) => [l.id, l]));
    const topCompanies = agg(
      (s) => companyName.get(lectureById.get(s.lecture_id)?.company_id) ?? null,
      (s) => N(s.gross_revenue),
    );
    const topAgents = agg(
      (s) => agentName.get(s.agent_id) ?? null,
      (s) => N(s.agent_amount),
    );
    const topCampaigns = agg(
      (s) => campaignName.get(lectureById.get(s.lecture_id)?.campaign_id) ?? null,
      (s) => N(s.net_profit),
    );
    const topSeasons = agg(
      (s) => seasonName.get(lectureById.get(s.lecture_id)?.season_id) ?? null,
      (s) => N(s.net_profit),
    );

    const cityMap = new Map<string, number>();
    for (const l of lectures) {
      const c = [l.city, l.state].filter(Boolean).join(" / ");
      if (!c) continue;
      cityMap.set(c, (cityMap.get(c) ?? 0) + N(l.actual_audience));
    }
    const topCities = Array.from(cityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const ticket = seasonSnaps.length > 0 ? grossSeason / seasonSnaps.length : 0;
    const bestProfit =
      snapshots.slice().sort((a, b) => N(b.net_profit) - N(a.net_profit))[0] ?? null;
    const bestAudience =
      lectures.slice().sort((a, b) => N(b.actual_audience) - N(a.actual_audience))[0] ?? null;
    const conversion = seasonLectures.length > 0 ? doneLectures.length / seasonLectures.length : 0;

    const metaPct = goals.revenue > 0 ? Math.min(100, (yearIn / goals.revenue) * 100) : 0;

    // ---- alertas
    type Alert = {
      id: string;
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
      to?: string;
    };
    const alerts: Alert[] = [];
    for (const m of overdue.slice(0, 5)) {
      alerts.push({
        id: `ov-${m.id}`,
        severity: "high",
        title: `${m.direction === "in" ? "Recebimento" : "Pagamento"} vencido — ${BRL.format(N(m.amount) || N(m.expected_amount))}`,
        detail: `${m.description ?? "Lançamento"} · venceu em ${fmtDate(m.expected_date)}`,
        to: "/app/financeiro",
      });
    }
    for (const l of unclosed.slice(0, 5)) {
      alerts.push({
        id: `uc-${l.id}`,
        severity: "high",
        title: "Palestra sem fechamento financeiro",
        detail: `${l.title ?? "Palestra"} · realizada em ${fmtDate(l.scheduled_at)}`,
        to: `/app/palestras/${l.id}`,
      });
    }
    for (const s of suppliersDue.slice(0, 3)) {
      alerts.push({
        id: `sup-${s.name}`,
        severity: "medium",
        title: `Fornecedor ${s.name} com saldo pendente`,
        detail: `Saldo devedor de ${BRL.format(s.due)} — gerar prestação de contas.`,
        to: "/app/estoque",
      });
    }
    for (const s of lowStock.slice(0, 4)) {
      alerts.push({
        id: `ls-${s.id}`,
        severity: "medium",
        title: `Estoque baixo: ${s.name}`,
        detail: `Saldo ${NUM.format(s.qty)} · mínimo ${NUM.format(s.min)}`,
        to: `/app/estoque/${s.id}`,
      });
    }
    for (const c of staleCompanies.slice(0, 4)) {
      alerts.push({
        id: `st-${c.id}`,
        severity: "low",
        title: `Empresa sem follow-up: ${c.name}`,
        detail: `Sem atualização há ${c.days} dias.`,
        to: `/app/crm/${c.id}`,
      });
    }
    for (const m of dueSoon.slice(0, 4)) {
      alerts.push({
        id: `ds-${m.id}`,
        severity: "low",
        title: `${m.direction === "in" ? "A receber" : "A pagar"} em ${fmtDate(m.expected_date)}`,
        detail: `${m.description ?? "Lançamento"} · ${BRL.format(N(m.expected_amount) || N(m.amount))}`,
        to: "/app/financeiro",
      });
    }
    if (lecturesCovered > 0 && lecturesCovered <= 3) {
      alerts.push({
        id: "cover",
        severity: "medium",
        title: "Materiais próximos do fim",
        detail: `O estoque atual cobre aproximadamente ${lecturesCovered} palestra(s).`,
        to: "/app/estoque",
      });
    }

    // ---- tarefas automáticas
    type Task = {
      id: string;
      label: string;
      priority: "Alta" | "Média" | "Baixa";
      owner: string;
      due: string;
      status: string;
    };
    const tasks: Task[] = [];
    for (const l of todayLectures) {
      tasks.push({
        id: `t-lec-${l.id}`,
        label: `Confirmar palestra ${l.companies?.trade_name || l.companies?.legal_name || l.title}`,
        priority: "Alta",
        owner: l.agents?.full_name ?? "Operação",
        due: "Hoje",
        status: lectureStatusLabel(l.status),
      });
    }
    for (const m of overdue.slice(0, 5)) {
      tasks.push({
        id: `t-ov-${m.id}`,
        label: `${m.direction === "in" ? "Receber" : "Pagar"} ${m.description ?? "lançamento"} (${BRL.format(N(m.amount) || N(m.expected_amount))})`,
        priority: "Alta",
        owner: "Financeiro",
        due: fmtDate(m.expected_date),
        status: "Vencido",
      });
    }
    for (const l of unclosed.slice(0, 5)) {
      tasks.push({
        id: `t-uc-${l.id}`,
        label: `Fechar financeiro da palestra ${l.title ?? ""}`.trim(),
        priority: "Alta",
        owner: "Diretoria",
        due: fmtDate(l.scheduled_at),
        status: "Pendente",
      });
    }
    for (const s of suppliersDue.slice(0, 2)) {
      tasks.push({
        id: `t-sup-${s.name}`,
        label: `Fazer prestação de contas com ${s.name} (${BRL.format(s.due)})`,
        priority: "Média",
        owner: "Financeiro",
        due: "Este mês",
        status: "Pendente",
      });
    }
    for (const s of lowStock.slice(0, 2)) {
      tasks.push({
        id: `t-ls-${s.id}`,
        label: `Comprar ${s.name} — saldo ${NUM.format(s.qty)}`,
        priority: "Média",
        owner: "Operação",
        due: "Esta semana",
        status: "Pendente",
      });
    }
    for (const m of dueSoon.slice(0, 3)) {
      tasks.push({
        id: `t-ds-${m.id}`,
        label: `${m.direction === "in" ? "Cobrar" : "Programar pagamento"}: ${m.description ?? "lançamento"}`,
        priority: "Média",
        owner: "Financeiro",
        due: fmtDate(m.expected_date),
        status: "Previsto",
      });
    }
    for (const c of staleCompanies.slice(0, 3)) {
      tasks.push({
        id: `t-fu-${c.id}`,
        label: `Fazer follow-up com ${c.name}`,
        priority: "Baixa",
        owner: "Comercial",
        due: "Esta semana",
        status: "Pendente",
      });
    }

    // ---- insights
    const insights: string[] = [];
    if (grossSeason > 0 && topCompanies[0]) {
      insights.push(
        `A empresa ${topCompanies[0].name} é responsável por ${((topCompanies[0].value / grossSeason) * 100).toFixed(0)}% do faturamento apurado desta temporada.`,
      );
    }
    if (topMaterial && usedCost > 0) {
      insights.push(
        `O item ${topMaterial.name} representa ${((topMaterial.value / usedCost) * 100).toFixed(0)}% do custo dos materiais utilizados.`,
      );
    }
    const prevProfit = prevIn - prevOut;
    const curProfit = monthIn - monthOut;
    if (prevProfit !== 0) {
      const delta = ((curProfit - prevProfit) / Math.abs(prevProfit)) * 100;
      insights.push(
        `Seu resultado de caixa ${delta >= 0 ? "aumentou" : "caiu"} ${Math.abs(delta).toFixed(0)}% em relação ao mês anterior.`,
      );
    }
    if (staleCompanies.length > 0) {
      insights.push(
        `Você possui ${staleCompanies.length} empresa(s) sem contato recente com potencial para uma nova palestra.`,
      );
    }
    if (lecturesCovered > 0)
      insights.push(`O estoque atual atende aproximadamente ${lecturesCovered} palestra(s).`);
    for (const s of suppliersDue.slice(0, 2))
      insights.push(`O fornecedor ${s.name} possui saldo pendente de ${BRL.format(s.due)}.`);
    if (topCampaigns[0])
      insights.push(
        `A campanha ${topCampaigns[0].name} concentra o maior lucro apurado (${BRL.format(topCampaigns[0].value)}).`,
      );
    if (ticket > 0)
      insights.push(`O ticket médio por palestra apurada está em ${BRL.format(ticket)}.`);

    return {
      activeSeason,
      season: {
        gross: grossSeason,
        profit: profitSeason,
        companies: companiesSeason,
        audience: audienceSeason,
        lectures: doneLectures.length,
        purchased,
        dueSupplier,
        paidSupplier,
        expectedIn,
        metaPct,
      },
      exec: { monthIn, monthOut, expectedIn, expectedOut, usedCost, dueSupplier, cashBalance },
      todayLectures,
      nextLectures,
      alerts,
      tasks,
      insights,
      perf: {
        topCompanies,
        topAgents,
        topCities,
        topCampaigns,
        topSeasons,
        ticket,
        bestProfit,
        bestAudience,
        conversion,
      },
      lectureById,
    };
  }, [data, goals, year]);

  if (orgLoading || isLoading || !model) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow="Centro de Operações"
          title="Painel executivo"
          description="Consolidando a operação do Grupo Guerra…"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  const { activeSeason, season, exec, todayLectures, nextLectures, perf } = model;

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      <SetupBanner />
      <PageHeader
        eyebrow="Centro de Operações"
        title="Como está a empresa hoje"
        description="Situação da temporada, agenda do dia, riscos, pendências e decisões — tudo calculado automaticamente a partir dos dados reais."
        actions={
          <Link
            to="/app/inteligencia"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium hover:border-foreground/30"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Painel do Diretor
          </Link>
        }
      />

      <AssistantGuerra
        data={{
          lectures: data!.lectures,
          movements: data!.movements,
          snapshots: data!.snapshots,
          items: data!.items,
          batches: data!.batches,
          stockMovs: data!.stockMovs,
          settlements: data!.settlements,
          companies: data!.companies,
          advances: data!.advances,
          seasons: data!.seasons as any[],
          agents: data!.agents,
        }}
        seasons={(data!.seasons as any[]).map((s) => ({ id: s.id, name: s.name }))}
        agents={data!.agents.map((a) => ({ id: a.id, name: a.full_name }))}
        campaigns={data!.campaigns.map((c) => ({ id: c.id, name: c.name }))}
        projects={data!.projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      {/* Situação da temporada */}
      <section>
        <div
          className="relative overflow-hidden rounded-3xl p-8 md:p-12"
          style={{ background: "var(--ink)", color: "var(--ink-foreground)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
          />
          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.12em] opacity-70">
              Situação da Temporada {activeSeason ? `· ${activeSeason.name}` : ""}
            </div>
            <div className="mt-6 grid gap-8 md:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] opacity-60">
                  Receita bruta
                </div>
                <div className="mt-3 font-display text-4xl leading-none md:text-5xl">
                  {BRL.format(season.gross)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] opacity-60">
                  Lucro líquido
                </div>
                <div
                  className="mt-3 font-display text-4xl leading-none md:text-5xl"
                  style={{ color: GOLD }}
                >
                  {BRL.format(season.profit)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] opacity-60">
                  Meta anual atingida
                </div>
                <div className="mt-3 font-display text-4xl leading-none md:text-5xl">
                  {season.metaPct.toFixed(0)}%
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${season.metaPct}%`, background: GOLD }}
                  />
                </div>
                <Link
                  to="/app/metas"
                  className="mt-2 inline-block text-[11px] underline opacity-70"
                >
                  definir metas
                </Link>
              </div>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/15 sm:grid-cols-4 lg:grid-cols-7">
              {[
                { l: "Empresas atendidas", v: NUM.format(season.companies) },
                { l: "Pessoas impactadas", v: NUM.format(season.audience) },
                { l: "Palestras realizadas", v: NUM.format(season.lectures) },
                { l: "Compra de livros", v: BRL.format(season.purchased) },
                { l: "Devido ao fornecedor", v: BRL.format(season.dueSupplier) },
                { l: "Pago ao fornecedor", v: BRL.format(season.paidSupplier) },
                { l: "A receber", v: BRL.format(season.expectedIn) },
              ].map((x) => (
                <div key={x.l} className="p-4" style={{ background: "var(--ink)" }}>
                  <div className="text-[11px] uppercase tracking-[0.12em] opacity-60">{x.l}</div>
                  <div className="mt-2 font-display text-lg tabular-nums">{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Agenda de hoje */}
      <section>
        <SectionTitle
          eyebrow="Agenda de Hoje"
          title="O que acontece agora"
          action={
            <Link
              to="/app/agenda"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Ver agenda completa <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Hoje" subtitle={`${todayLectures.length} compromisso(s)`}>
            {todayLectures.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum compromisso agendado para hoje.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {todayLectures.map((l: any) => (
                  <li key={l.id}>
                    <Link
                      to="/app/palestras/$id"
                      params={{ id: l.id }}
                      className="block py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {l.companies?.trade_name || l.companies?.legal_name || l.title}
                        </span>
                        <span className="shrink-0 font-display text-sm">
                          {fmtTime(l.scheduled_at) || l.scheduled_time || "—"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[l.city, l.state].filter(Boolean).join(" / ") || "—"}
                        </span>
                        {l.contacts?.full_name && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {l.contacts.full_name}
                          </span>
                        )}
                        {(l.contacts?.phone || l.contacts?.whatsapp) && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {l.contacts.phone || l.contacts.whatsapp}
                          </span>
                        )}
                        {l.agents?.full_name && <span>Agendista: {l.agents.full_name}</span>}
                        <span className="uppercase tracking-wider">
                          {lectureStatusLabel(l.status)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Próximas atividades" subtitle="Agendadas nos próximos dias">
            {nextLectures.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma atividade futura agendada.</p>
            ) : (
              <ul className="divide-y divide-border">
                {nextLectures.map((l: any) => (
                  <li key={l.id}>
                    <Link
                      to="/app/palestras/$id"
                      params={{ id: l.id }}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm">{l.title || l.companies?.legal_name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {[l.city, l.state].filter(Boolean).join(" / ")} ·{" "}
                          {l.agents?.full_name ?? "sem agendista"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-sm">{fmtDate(l.scheduled_at)}</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {lectureStatusLabel(l.status)}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      {/* Resumo executivo */}
      <section>
        <SectionTitle eyebrow="Resumo Executivo" title="O mês em números" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi label="Receita do mês" value={BRL.format(exec.monthIn)} to="/app/financeiro" />
          <Kpi
            label="Lucro do mês"
            value={BRL.format(exec.monthIn - exec.monthOut)}
            hint="caixa realizado"
          />
          <Kpi label="A receber" value={BRL.format(exec.expectedIn)} to="/app/financeiro" />
          <Kpi label="Recebido" value={BRL.format(exec.monthIn)} />
          <Kpi label="Despesas" value={BRL.format(exec.monthOut)} />
          <Kpi label="Materiais usados" value={BRL.format(exec.usedCost)} to="/app/estoque" />
          <Kpi
            label="Saldo disponível"
            value={BRL.format(exec.cashBalance)}
            hint="entradas − saídas liquidadas"
          />
        </div>
      </section>

      {/* Desempenho */}
      <section>
        <SectionTitle eyebrow="Desempenho" title="Quem entrega resultado" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel title="Top empresas" subtitle="Receita bruta apurada">
            <RankList rows={perf.topCompanies} format={(v) => BRL.format(v)} />
          </Panel>
          <Panel title="Top agendistas" subtitle="Comissão apurada">
            <RankList rows={perf.topAgents} format={(v) => BRL.format(v)} />
          </Panel>
          <Panel title="Top cidades" subtitle="Público impactado">
            <RankList rows={perf.topCities} format={(v) => NUM.format(v)} />
          </Panel>
          <Panel title="Top campanhas" subtitle="Lucro apurado">
            <RankList rows={perf.topCampaigns} format={(v) => BRL.format(v)} />
          </Panel>
          <Panel title="Top temporadas" subtitle="Lucro apurado">
            <RankList rows={perf.topSeasons} format={(v) => BRL.format(v)} />
          </Panel>
          <Panel title="Recordes" subtitle="Marcas da operação">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" /> Ticket médio
                </span>
                <span className="font-display tabular-nums">{BRL.format(perf.ticket)}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Maior lucro (palestra)</span>
                <span className="font-display tabular-nums">
                  {BRL.format(N(perf.bestProfit?.net_profit))}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Maior público</span>
                <span className="font-display tabular-nums">
                  {NUM.format(N(perf.bestAudience?.actual_audience))}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Conversão da temporada</span>
                <span className="font-display tabular-nums">
                  {(perf.conversion * 100).toFixed(0)}%
                </span>
              </li>
            </ul>
          </Panel>
        </div>
      </section>
    </div>
  );
}
