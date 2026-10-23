/**
 * GBS Assistant — Centro de Operações Inteligente.
 *
 * Camada de ANÁLISE PURA. Não altera cálculos financeiros, não grava nada,
 * não inventa dados: recebe as linhas reais já carregadas do banco
 * (respeitando organization_id / RLS na consulta) e devolve
 * resumo do dia, alertas, prioridades e insights.
 */

import { BRL, NUM } from "@/lib/format";

export type Priority = "critico" | "alto" | "medio" | "baixo";

export const PRIORITY_LABEL: Record<Priority, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
};

const PRIORITY_ORDER: Record<Priority, number> = { critico: 0, alto: 1, medio: 2, baixo: 3 };

export type AssistantPeriod = "hoje" | "semana" | "mes" | "temporada";

export type AssistantFilters = {
  period: AssistantPeriod;
  seasonId?: string | null;
  agentId?: string | null;
  campaignId?: string | null;
  projectId?: string | null;
};

export type AssistantAlert = {
  id: string;
  title: string;
  detail: string;
  priority: Priority;
  date: string | null;
  to: string;
  source: string;
};

export type SummaryRow = {
  key: string;
  label: string;
  value: number;
  to: string;
  tone?: "danger" | "warn" | "neutral";
};

export type AssistantResult = {
  summary: SummaryRow[];
  alerts: AssistantAlert[];
  priorities: AssistantAlert[];
  insights: string[];
  hasData: boolean;
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export type AssistantData = {
  lectures: Row[];
  movements: Row[];
  snapshots: Row[];
  items: Row[];
  batches: Row[];
  stockMovs: Row[];
  settlements: Row[];
  companies: Row[];
  advances?: Row[];
  seasons?: Row[];
  agents?: Row[];
};

/* ------------------------------------------------------------- helpers */

const N = (v: unknown) => Number(v ?? 0) || 0;

const dayOf = (s: string | null | undefined) => (s ? String(s).slice(0, 10) : null);

export function todayISO(now = new Date()) {
  const x = new Date(now);
  x.setHours(12, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(from: string, to: string) {
  return Math.round(
    (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000,
  );
}

export function fmtDay(s: string | null | undefined) {
  const d = dayOf(s);
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const isSettled = (m: Row) => m.status === "recebido" || m.status === "pago" || m.status === "paga";
const isPending = (m: Row) =>
  m.status === "previsto" || m.status === "prevista" || m.status === "parcial";
const movDate = (m: Row) => dayOf(m.expected_date ?? m.occurs_on);
const movValue = (m: Row) => N(m.amount) || N(m.expected_amount);

function periodRange(
  period: AssistantPeriod,
  today: string,
): { from: string | null; to: string | null } {
  if (period === "hoje") return { from: today, to: today };
  if (period === "semana") return { from: today, to: addDays(today, 7) };
  if (period === "mes")
    return {
      from: today.slice(0, 7) + "-01",
      to: addDays(today.slice(0, 7) + "-01", 45).slice(0, 7) + "-01",
    };
  return { from: null, to: null };
}

/* --------------------------------------------------------------- build */

export function buildAssistant(
  data: AssistantData,
  filters: AssistantFilters,
  now = new Date(),
): AssistantResult {
  const today = todayISO(now);
  const { from, to } = periodRange(filters.period, today);

  const lectureById = new Map(data.lectures.map((l) => [l.id, l]));

  /** Um registro pertence ao escopo dos filtros dimensionais? */
  const lectureMatches = (l: Row | null | undefined) => {
    if (!l)
      return !filters.seasonId && !filters.agentId && !filters.campaignId && !filters.projectId;
    if (filters.seasonId && l.season_id !== filters.seasonId) return false;
    if (filters.agentId && l.agent_id !== filters.agentId) return false;
    if (filters.campaignId && l.campaign_id !== filters.campaignId) return false;
    if (filters.projectId && l.project_id !== filters.projectId) return false;
    return true;
  };

  const movementMatches = (m: Row) => {
    if (m.lecture_id) return lectureMatches(lectureById.get(m.lecture_id));
    if (filters.seasonId && m.season_id !== filters.seasonId) return false;
    if (filters.projectId && m.project_id !== filters.projectId) return false;
    if (filters.agentId && m.agent_id !== filters.agentId) return false;
    if (filters.campaignId) return false;
    return true;
  };

  /** Filtro de período aplicado a uma data (null = sempre inclui). */
  const inPeriod = (d: string | null) => {
    if (!from || !to) return true;
    if (!d) return false;
    return d >= from && d <= to;
  };

  const lectures = data.lectures.filter(lectureMatches);
  const movements = data.movements.filter(movementMatches);
  const snapshots = data.snapshots.filter((s) => lectureMatches(lectureById.get(s.lecture_id)));

  /* ---------------- palestras */
  const todayLectures = lectures.filter((l) => dayOf(l.scheduled_at) === today);
  const upcoming = lectures
    .filter((l) => {
      const d = dayOf(l.scheduled_at);
      return (
        !!d && d > today && (filters.period === "temporada" ? true : d <= (to ?? addDays(today, 7)))
      );
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  const snapLectures = new Set(data.snapshots.map((s) => s.lecture_id));
  const unclosed = lectures
    .filter((l) => {
      const d = dayOf(l.scheduled_at);
      return (
        !!d &&
        d < today &&
        (l.status === "realizada" || l.status === "encerrada") &&
        !snapLectures.has(l.id)
      );
    })
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  /* ---------------- financeiro */
  const overdue = movements
    .filter((m) => isPending(m) && movDate(m) && movDate(m)! < today)
    .sort((a, b) => String(movDate(a)).localeCompare(String(movDate(b))));
  const dueSoon = movements
    .filter((m) => {
      const d = movDate(m);
      return (
        isPending(m) &&
        !!d &&
        d >= today &&
        diffDays(today, d) <= (filters.period === "hoje" ? 1 : 7)
      );
    })
    .sort((a, b) => String(movDate(a)).localeCompare(String(movDate(b))));

  const expectedIn = movements
    .filter((m) => m.direction === "in" && isPending(m))
    .reduce((a, m) => a + movValue(m), 0);
  const settledIn = movements
    .filter((m) => m.direction === "in" && isSettled(m))
    .reduce((a, m) => a + N(m.amount), 0);
  const settledOut = movements
    .filter((m) => m.direction === "out" && isSettled(m))
    .reduce((a, m) => a + N(m.amount), 0);

  /* ---------------- estoque */
  const stockMovs = data.stockMovs.filter((m) =>
    m.lecture_id ? lectureMatches(lectureById.get(m.lecture_id)) : !filters.campaignId,
  );
  const balance = new Map<string, number>();
  for (const m of data.stockMovs) {
    if (m.status === "cancelado" || !m.stock_item_id) continue;
    const sign = m.kind === "saida" || m.kind === "baixa" || m.kind === "reserva" ? -1 : 1;
    balance.set(m.stock_item_id, (balance.get(m.stock_item_id) ?? 0) + sign * N(m.quantity));
  }
  const lowStock = data.items
    .filter((i) => N(i.min_quantity) > 0 && (balance.get(i.id) ?? 0) <= N(i.min_quantity))
    .map((i) => ({
      id: i.id,
      name: i.name as string,
      qty: balance.get(i.id) ?? 0,
      min: N(i.min_quantity),
    }))
    .sort((a, b) => a.qty - b.qty);

  const stockValue = data.items.reduce((a, i) => {
    const qty = Math.max(0, balance.get(i.id) ?? 0);
    return a + qty * (N(i.average_cost) || N(i.purchase_price));
  }, 0);

  const usedCost = stockMovs
    .filter(
      (m) =>
        (m.kind === "saida" || m.kind === "baixa") &&
        m.status !== "cancelado" &&
        m.status !== "estornado",
    )
    .reduce((a, m) => a + (N(m.total_cost) || N(m.unit_cost) * N(m.quantity)), 0);

  /* ---------------- fornecedores */
  const bySupplier = new Map<string, { purchased: number; paid: number }>();
  const bump = (k: string) => {
    const cur = bySupplier.get(k) ?? { purchased: 0, paid: 0 };
    bySupplier.set(k, cur);
    return cur;
  };
  for (const b of data.batches) {
    if (filters.seasonId && b.season_id && b.season_id !== filters.seasonId) continue;
    bump(b.supplier ?? "Sem fornecedor").purchased +=
      N(b.unit_cost) * N(b.initial_quantity ?? b.quantity);
  }
  for (const s of data.settlements) {
    if (filters.seasonId && s.season_id && s.season_id !== filters.seasonId) continue;
    bump(s.supplier ?? "Sem fornecedor").paid += N(s.amount_paid);
  }
  const suppliersDue = Array.from(bySupplier.entries())
    .map(([name, v]) => ({ name, due: v.purchased - v.paid }))
    .filter((s) => s.due > 0.5)
    .sort((a, b) => b.due - a.due);

  /* ---------------- conta corrente (adiantamentos em aberto) */
  const advances = (data.advances ?? []).filter((a) => {
    if (a.status === "abatido_total" || a.status === "cancelado") return false;
    if (filters.agentId && a.agent_id !== filters.agentId) return false;
    if (a.lecture_id && !lectureMatches(lectureById.get(a.lecture_id))) return false;
    return N(a.amount) - N(a.amount_amortized) > 0.5;
  });
  const advancesOpen = advances.reduce((a, x) => a + (N(x.amount) - N(x.amount_amortized)), 0);

  /* ---------------- follow-up */
  const staleCompanies = data.companies
    .filter(
      (c) =>
        c.updated_at &&
        c.lifecycle_stage !== "cliente_perdido" &&
        diffDays(dayOf(c.updated_at)!, today) >= 60,
    )
    .map((c) => ({
      id: c.id,
      name: (c.trade_name || c.legal_name) as string,
      days: diffDays(dayOf(c.updated_at)!, today),
    }))
    .sort((a, b) => b.days - a.days);

  /* ------------------------------------------------------------ resumo */
  const summary: SummaryRow[] = [
    { key: "today", label: "Palestras de hoje", value: todayLectures.length, to: "/app/agenda" },
    { key: "next", label: "Palestras próximas", value: upcoming.length, to: "/app/palestras" },
    {
      key: "expected",
      label: "Pagamentos previstos",
      value: dueSoon.length,
      to: "/app/financeiro",
      tone: dueSoon.length ? "warn" : "neutral",
    },
    {
      key: "overdue",
      label: "Pagamentos atrasados",
      value: overdue.length,
      to: "/app/financeiro",
      tone: overdue.length ? "danger" : "neutral",
    },
    {
      key: "closing",
      label: "Pendências de fechamento",
      value: unclosed.length,
      to: "/app/palestras",
      tone: unclosed.length ? "danger" : "neutral",
    },
    {
      key: "followup",
      label: "Empresas p/ follow-up",
      value: staleCompanies.length,
      to: "/app/crm",
    },
    {
      key: "stock",
      label: "Alertas de estoque",
      value: lowStock.length,
      to: "/app/estoque",
      tone: lowStock.length ? "warn" : "neutral",
    },
    {
      key: "cc",
      label: "Conta corrente pendente",
      value: advances.length,
      to: "/app/agendistas",
      tone: advances.length ? "warn" : "neutral",
    },
  ];

  /* ------------------------------------------------------------ alertas */
  const alerts: AssistantAlert[] = [];

  for (const m of overdue.slice(0, 6)) {
    const d = movDate(m)!;
    const late = diffDays(d, today);
    alerts.push({
      id: `ov-${m.id}`,
      title: `${m.direction === "in" ? "Recebimento" : "Pagamento"} em atraso — ${BRL.format(movValue(m))}`,
      detail: `${m.description ?? "Lançamento"} · vencido há ${late} dia(s).`,
      priority: late >= 15 ? "critico" : "alto",
      date: d,
      to: "/app/financeiro",
      source: "Financeiro",
    });
  }

  for (const l of unclosed.slice(0, 6)) {
    const d = dayOf(l.scheduled_at)!;
    const late = diffDays(d, today);
    alerts.push({
      id: `uc-${l.id}`,
      title: `Palestra ainda não encerrada — ${l.companies?.trade_name || l.companies?.legal_name || l.title || "sem título"}`,
      detail: `Realizada há ${late} dia(s) e ainda sem fechamento financeiro.`,
      priority: late >= 30 ? "critico" : "alto",
      date: d,
      to: `/app/palestras/${l.id}`,
      source: "Palestras",
    });
  }

  for (const l of todayLectures) {
    if (l.status === "confirmada" || l.status === "realizada" || l.status === "encerrada") continue;
    alerts.push({
      id: `tl-${l.id}`,
      title: `Palestra de hoje sem confirmação — ${l.companies?.trade_name || l.companies?.legal_name || l.title || "sem título"}`,
      detail: "Confirmar presença, local e materiais com o contato responsável.",
      priority: "alto",
      date: today,
      to: `/app/palestras/${l.id}`,
      source: "Agenda",
    });
  }

  for (const s of lowStock.slice(0, 4)) {
    alerts.push({
      id: `ls-${s.id}`,
      title: `Estoque abaixo do mínimo — ${s.name}`,
      detail: `Saldo ${NUM.format(s.qty)} · mínimo ${NUM.format(s.min)}.`,
      priority: s.qty <= 0 ? "critico" : "medio",
      date: today,
      to: `/app/estoque/${s.id}`,
      source: "Estoque",
    });
  }

  for (const s of suppliersDue.slice(0, 3)) {
    alerts.push({
      id: `sup-${s.name}`,
      title: `Fornecedor com saldo pendente — ${s.name}`,
      detail: `Saldo devedor de ${BRL.format(s.due)}. Registrar acerto na prestação de contas.`,
      priority: "medio",
      date: today,
      to: "/app/estoque",
      source: "Fornecedores",
    });
  }

  if (advances.length > 0) {
    alerts.push({
      id: "cc-open",
      title: "Conta corrente possui movimentação pendente",
      detail: `${advances.length} adiantamento(s) em aberto, totalizando ${BRL.format(advancesOpen)} a compensar.`,
      priority: "medio",
      date: today,
      to: "/app/agendistas",
      source: "Agendistas",
    });
  }

  for (const m of dueSoon.slice(0, 3)) {
    alerts.push({
      id: `ds-${m.id}`,
      title: `${m.direction === "in" ? "A receber" : "A pagar"} até ${fmtDay(movDate(m))} — ${BRL.format(movValue(m))}`,
      detail: `${m.description ?? "Lançamento"} previsto para os próximos dias.`,
      priority: "baixo",
      date: movDate(m),
      to: "/app/financeiro",
      source: "Financeiro",
    });
  }

  for (const c of staleCompanies.slice(0, 3)) {
    alerts.push({
      id: `fu-${c.id}`,
      title: `Empresa sem follow-up há ${c.days} dias — ${c.name}`,
      detail: "Retomar contato para gerar nova oportunidade.",
      priority: "baixo",
      date: null,
      to: `/app/crm/${c.id}`,
      source: "CRM",
    });
  }

  alerts.sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      String(a.date ?? "9").localeCompare(String(b.date ?? "9")),
  );

  const limited = alerts.slice(0, 12);
  const priorities = limited.filter((a) => a.priority !== "baixo").slice(0, 5);

  /* ------------------------------------------------------------ insights */
  const insights: string[] = [];
  const grossApurado = snapshots.reduce((a, s) => a + N(s.gross_revenue), 0);
  const profitApurado = snapshots.reduce((a, s) => a + N(s.net_profit), 0);

  if (grossApurado > 0)
    insights.push(
      `As palestras apuradas no escopo atual geraram ${BRL.format(grossApurado)} de receita bruta.`,
    );
  if (profitApurado !== 0)
    insights.push(`O lucro líquido apurado no escopo atual é de ${BRL.format(profitApurado)}.`);

  if (grossApurado > 0) {
    const byCompany = new Map<string, number>();
    for (const s of snapshots) {
      const l = lectureById.get(s.lecture_id);
      const name = l?.companies?.trade_name || l?.companies?.legal_name;
      if (!name) continue;
      byCompany.set(name, (byCompany.get(name) ?? 0) + N(s.gross_revenue));
    }
    const top = Array.from(byCompany.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 0)
      insights.push(
        `A empresa ${top[0]} é responsável por ${((top[1] / grossApurado) * 100).toFixed(0)}% da receita apurada.`,
      );
  }

  const byAgent = new Map<string, number>();
  for (const s of snapshots) {
    const name = (data.agents ?? []).find((a) => a.id === s.agent_id)?.full_name;
    if (!name) continue;
    byAgent.set(name, (byAgent.get(name) ?? 0) + N(s.gross_revenue));
  }
  const topAgent = Array.from(byAgent.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topAgent && topAgent[1] > 0)
    insights.push(
      `O agendista ${topAgent[0]} gerou o maior faturamento: ${BRL.format(topAgent[1])}.`,
    );

  if (stockValue > 0)
    insights.push(`O estoque atual possui ${BRL.format(stockValue)} em materiais disponíveis.`);
  if (usedCost > 0)
    insights.push(
      `Já foram consumidos ${BRL.format(usedCost)} em materiais no escopo selecionado.`,
    );
  if (expectedIn > 0)
    insights.push(`Você possui ${BRL.format(expectedIn)} pendente de recebimento.`);
  if (settledIn > 0 || settledOut > 0)
    insights.push(
      `Caixa realizado no escopo: ${BRL.format(settledIn - settledOut)} (${BRL.format(settledIn)} entradas · ${BRL.format(settledOut)} saídas).`,
    );

  const hasData =
    data.lectures.length > 0 ||
    data.movements.length > 0 ||
    data.companies.length > 0 ||
    data.items.length > 0;

  return { summary, alerts: limited, priorities, insights: insights.slice(0, 6), hasData };
}
