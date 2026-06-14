/**
 * Motor Financeiro — funções puras e transparentes.
 *
 * Princípios:
 *  - Todos os valores são derivados de movimentos / adiantamentos / regras.
 *  - Nada é armazenado manualmente quando pode ser calculado.
 *  - Toda função retorna não apenas o resultado, mas o passo-a-passo do cálculo.
 *  - As regras são parâmetros vindos do banco (financial_rules), nunca fixas no código.
 */

export type RuleSnapshot = {
  id?: string;
  name?: string | null;
  gustavo_share: number; // 0..1
  agent_share: number;   // 0..1
  fee_percent: number;   // 0..1
  fee_fixed: number;     // BRL
  effective_from?: string | null;
  effective_to?: string | null;
  scope?: string | null;
};

export const DEFAULT_RULE: RuleSnapshot = {
  name: "Padrão GBS — 50 / 50",
  gustavo_share: 0.5,
  agent_share: 0.5,
  fee_percent: 0,
  fee_fixed: 0,
};

export type CalcLine = {
  label: string;
  amount: number;
  kind: "in" | "out" | "subtotal" | "split";
  hint?: string;
};

export type LectureCalcInput = {
  grossRevenue: number;
  expenses: { description: string | null; amount: number; date?: string | null }[];
  advances: { id: string; amount: number; granted_on?: string | null; source?: string | null }[];
  rule: RuleSnapshot;
};

export type LectureCalcResult = {
  rule: RuleSnapshot;
  lines: CalcLine[];
  totals: {
    grossRevenue: number;
    fee: number;
    totalExpenses: number;
    totalAdvances: number;
    netProfit: number;
    gustavoAmount: number;
    agentAmount: number;
  };
};

/** Cálculo transparente de fechamento de uma palestra. */
export function calculateLecture(input: LectureCalcInput): LectureCalcResult {
  const { grossRevenue, expenses, advances, rule } = input;

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount || 0), 0);
  const fee = round(grossRevenue * (rule.fee_percent || 0) + (rule.fee_fixed || 0));
  const netProfit = round(grossRevenue - fee - totalExpenses - totalAdvances);
  const gustavoAmount = round(netProfit * (rule.gustavo_share || 0));
  const agentAmount = round(netProfit * (rule.agent_share || 0));

  const lines: CalcLine[] = [
    { label: "Receita bruta", amount: grossRevenue, kind: "in" },
    {
      label: `Taxa (${pct(rule.fee_percent)}${rule.fee_fixed ? ` + ${money(rule.fee_fixed)}` : ""})`,
      amount: -fee,
      kind: "out",
    },
    ...expenses.map<CalcLine>((e) => ({
      label: e.description || "Despesa",
      amount: -Math.abs(Number(e.amount || 0)),
      kind: "out",
      hint: e.date ?? undefined,
    })),
    ...advances.map<CalcLine>((a) => ({
      label: `Adiantamento${a.source ? ` · ${a.source}` : ""}`,
      amount: -Math.abs(Number(a.amount || 0)),
      kind: "out",
      hint: a.granted_on ?? undefined,
    })),
    { label: "Lucro líquido", amount: netProfit, kind: "subtotal" },
    { label: `Gustavo (${pct(rule.gustavo_share)})`, amount: gustavoAmount, kind: "split" },
    { label: `Agendista (${pct(rule.agent_share)})`, amount: agentAmount, kind: "split" },
  ];

  return {
    rule,
    lines,
    totals: { grossRevenue, fee, totalExpenses, totalAdvances, netProfit, gustavoAmount, agentAmount },
  };
}

/** Conta corrente do agendista — derivada de snapshots e adiantamentos. */
export type AgentStatementInput = {
  closedShares: { lectureId: string; lectureTitle: string; date: string | null; amount: number }[];
  advances: { id: string; granted_on: string | null; amount: number; amount_amortized: number; source?: string | null; status?: string | null }[];
  payouts: { id: string; occurs_on: string | null; amount: number; description?: string | null }[];
};

export type AgentStatementLine = {
  id: string;
  date: string | null;
  description: string;
  amount: number;     // signed
  kind: "share" | "advance" | "payout";
  ref?: string;
};

export type AgentStatement = {
  lines: AgentStatementLine[];
  totals: {
    earned: number;        // soma dos splits do agendista
    advancesOpen: number;  // adiantamentos ainda não totalmente amortizados
    advancesTotal: number; // total já entregue como adiantamento
    payoutsTotal: number;  // pagamentos efetuados ao agendista
    balance: number;       // earned - advancesTotal - payoutsTotal
  };
};

export function buildAgentStatement(input: AgentStatementInput): AgentStatement {
  const lines: AgentStatementLine[] = [];

  for (const s of input.closedShares) {
    lines.push({
      id: `share-${s.lectureId}`,
      date: s.date,
      description: `Lucro · ${s.lectureTitle}`,
      amount: Math.abs(s.amount),
      kind: "share",
      ref: s.lectureId,
    });
  }
  for (const a of input.advances) {
    lines.push({
      id: `adv-${a.id}`,
      date: a.granted_on,
      description: `Adiantamento${a.source ? ` · ${a.source}` : ""}`,
      amount: -Math.abs(Number(a.amount || 0)),
      kind: "advance",
      ref: a.id,
    });
  }
  for (const p of input.payouts) {
    lines.push({
      id: `pay-${p.id}`,
      date: p.occurs_on,
      description: p.description ?? "Pagamento",
      amount: -Math.abs(Number(p.amount || 0)),
      kind: "payout",
      ref: p.id,
    });
  }

  lines.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const earned = input.closedShares.reduce((s, x) => s + Math.abs(x.amount), 0);
  const advancesTotal = input.advances.reduce((s, a) => s + Number(a.amount || 0), 0);
  const advancesOpen = input.advances
    .filter((a) => a.status !== "abatido_total" && a.status !== "cancelado")
    .reduce((s, a) => s + Math.max(0, Number(a.amount || 0) - Number(a.amount_amortized || 0)), 0);
  const payoutsTotal = input.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);

  return {
    lines,
    totals: {
      earned: round(earned),
      advancesOpen: round(advancesOpen),
      advancesTotal: round(advancesTotal),
      payoutsTotal: round(payoutsTotal),
      balance: round(earned - advancesTotal - payoutsTotal),
    },
  };
}

/** Encontra a regra vigente para um agendista numa data — sem nada fixo no código. */
export function selectRule(opts: {
  rules: Array<RuleSnapshot & { agent_id?: string | null; season_id?: string | null; is_default?: boolean | null; archived_at?: string | null }>;
  agentId?: string | null;
  seasonId?: string | null;
  date?: string;
}): RuleSnapshot {
  const today = opts.date ?? new Date().toISOString().slice(0, 10);
  const active = opts.rules.filter((r) => {
    if (r.archived_at) return false;
    if (r.effective_from && r.effective_from > today) return false;
    if (r.effective_to && r.effective_to < today) return false;
    return true;
  });

  // prioridade: agendista > temporada > default da organização > primeira disponível > built-in
  const byAgent = opts.agentId ? active.find((r) => r.agent_id === opts.agentId) : null;
  if (byAgent) return byAgent;
  const bySeason = opts.seasonId ? active.find((r) => r.season_id === opts.seasonId) : null;
  if (bySeason) return bySeason;
  const def = active.find((r) => r.is_default);
  if (def) return def;
  if (active[0]) return active[0];
  return DEFAULT_RULE;
}

export const ADVANCE_SOURCES = ["Gustavo", "Caixa", "Sels", "Banco", "PIX", "Outro"] as const;
export const ADVANCE_STATUS = [
  { key: "aberto", label: "Aberto" },
  { key: "abatido_parcial", label: "Abatido parcialmente" },
  { key: "abatido_total", label: "Abatido totalmente" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export function advanceStatusLabel(key: string | null | undefined) {
  if (!key) return "—";
  return ADVANCE_STATUS.find((s) => s.key === key)?.label ?? key;
}

/* ---------------- helpers ---------------- */

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function pct(v: number) {
  return `${Math.round((v || 0) * 1000) / 10}%`;
}
function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
