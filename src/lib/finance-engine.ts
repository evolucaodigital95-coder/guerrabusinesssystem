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
  agent_share: number; // 0..1
  fee_percent: number; // 0..1
  fee_fixed: number; // BRL
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

export type ExpenseBucket = "tax" | "cost" | "stock" | "expense";
export const BUCKET_LABEL: Record<ExpenseBucket, string> = {
  tax: "Taxas",
  cost: "Custos",
  stock: "Estoque",
  expense: "Despesas",
};

export type LectureExpenseInput = {
  description: string | null;
  amount: number;
  date?: string | null;
  bucket?: ExpenseBucket; // default: "expense"
};

export type CardFeeLine = {
  movement_id?: string;
  description?: string | null;
  brand?: string | null;
  installments?: number | null;
  percent?: number | null;
  amount: number; // valor da taxa (positivo)
  date?: string | null;
};

export type LectureCalcInput = {
  grossRevenue: number;
  cardFees?: CardFeeLine[]; // taxa do cartão por movimento (automática)
  expenses: LectureExpenseInput[];
  advances: { id: string; amount: number; granted_on?: string | null; source?: string | null }[];
  rule: RuleSnapshot;
  titheRate?: number; // padrão 10% — apenas informativo (não deduz do saldo)
};

export type LectureCalcResult = {
  rule: RuleSnapshot;
  lines: CalcLine[];
  totals: {
    grossRevenue: number;
    fee: number;
    totalCardFees: number;
    totalTaxes: number;
    totalCosts: number;
    totalStock: number;
    totalOtherExpenses: number;
    totalExpenses: number;
    totalAdvances: number;
    netProfit: number;
    gustavoAmount: number;
    agentAmount: number;
    titheRate: number;
    gustavoTithe: number;
    agentTithe: number;
    agentAfterAdvances: number;
  };
};

/**
 * Cálculo transparente de fechamento de uma palestra.
 * Ordem fixa e auditável:
 *   Receita Bruta − Taxa do Cartão − Taxa da regra − Despesas − Custos de Estoque − Custos operacionais
 *   = Lucro Líquido → divisão conforme regra vigente.
 */
export function calculateLecture(input: LectureCalcInput): LectureCalcResult {
  const { grossRevenue, expenses, advances, rule } = input;
  const cardFees = input.cardFees ?? [];
  const titheRate = input.titheRate ?? 0.1;

  const byBucket: Record<ExpenseBucket, LectureExpenseInput[]> = {
    tax: [],
    cost: [],
    stock: [],
    expense: [],
  };
  for (const e of expenses) {
    byBucket[e.bucket ?? "expense"].push(e);
  }
  const sumBucket = (b: ExpenseBucket) =>
    round(byBucket[b].reduce((s, e) => s + Math.abs(Number(e.amount || 0)), 0));

  const totalCardFees = round(cardFees.reduce((s, f) => s + Math.abs(Number(f.amount || 0)), 0));
  const totalTaxes = sumBucket("tax");
  const totalCosts = sumBucket("cost");
  const totalStock = sumBucket("stock");
  const totalOtherExpenses = sumBucket("expense");
  const totalExpenses = round(totalTaxes + totalCosts + totalStock + totalOtherExpenses);
  const totalAdvances = round(advances.reduce((s, a) => s + Number(a.amount || 0), 0));
  const fee = round(grossRevenue * (rule.fee_percent || 0) + (rule.fee_fixed || 0));
  // REGRA CORRETA: Lucro líquido = Receita − Materiais/Estoque − Juros/Taxa cartão − Taxa regra − Demais despesas.
  // Adiantamentos NÃO reduzem o lucro da palestra; entram apenas como débito na Conta Corrente do agendista.
  const netProfit = round(grossRevenue - totalCardFees - fee - totalExpenses);
  const gustavoAmount = round(netProfit * (rule.gustavo_share || 0));
  const agentAmount = round(netProfit * (rule.agent_share || 0));
  // Dízimo é 10% sobre a parte individual de cada um — APENAS INFORMATIVO
  const gustavoTithe = round(gustavoAmount * titheRate);
  const agentTithe = round(agentAmount * titheRate);
  const agentAfterAdvances = round(agentAmount - totalAdvances);

  const lines: CalcLine[] = [{ label: "Receita bruta", amount: grossRevenue, kind: "in" as const }];
  // Materiais (estoque) primeiro conforme regra
  if (totalStock) {
    lines.push(...bucketLines("stock", byBucket.stock, totalStock));
  }
  if (totalCardFees) {
    for (const f of cardFees) {
      const parts = [
        f.brand ?? "Cartão",
        f.installments && f.installments > 1 ? `${f.installments}x` : null,
        f.percent != null ? `${pct((f.percent || 0) / 100)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push({
        label: `Juros / taxa de cartão · ${parts}`,
        amount: -Math.abs(Number(f.amount || 0)),
        kind: "out" as const,
        hint: f.date ?? undefined,
      });
    }
    lines.push({
      label: "Subtotal juros/taxa cartão",
      amount: -totalCardFees,
      kind: "subtotal" as const,
    });
  }
  if (fee) {
    lines.push({
      label: `Taxa de regra (${pct(rule.fee_percent)}${rule.fee_fixed ? ` + ${money(rule.fee_fixed)}` : ""})`,
      amount: -fee,
      kind: "out" as const,
    });
  }
  lines.push(
    ...bucketLines("tax", byBucket.tax, totalTaxes),
    ...bucketLines("cost", byBucket.cost, totalCosts),
    ...bucketLines("expense", byBucket.expense, totalOtherExpenses),
  );
  lines.push(
    { label: "Lucro líquido operacional", amount: netProfit, kind: "subtotal" as const },
    {
      label: `Palestrante (${pct(rule.gustavo_share)})`,
      amount: gustavoAmount,
      kind: "split" as const,
    },
    {
      label: `Dízimo sugerido do palestrante (${pct(titheRate)}, informativo)`,
      amount: gustavoTithe,
      kind: "split" as const,
      hint: "Não é abatido do saldo — apenas indicativo.",
    },
    { label: `Agendista (${pct(rule.agent_share)})`, amount: agentAmount, kind: "split" as const },
    {
      label: `Dízimo sugerido do agendista (${pct(titheRate)}, informativo)`,
      amount: agentTithe,
      kind: "split" as const,
      hint: "Não é abatido do saldo — apenas indicativo.",
    },
  );
  if (totalAdvances > 0) {
    for (const a of advances) {
      lines.push({
        label: `Adiantamento a compensar${a.source ? ` · ${a.source}` : ""}`,
        amount: -Math.abs(Number(a.amount || 0)),
        kind: "out" as const,
        hint: a.granted_on ?? undefined,
      });
    }
    lines.push({
      label: "Saldo do agendista após adiantamentos",
      amount: agentAfterAdvances,
      kind: "subtotal" as const,
    });
  }

  return {
    rule,
    lines,
    totals: {
      grossRevenue,
      fee,
      totalCardFees,
      totalTaxes,
      totalCosts,
      totalStock,
      totalOtherExpenses,
      totalExpenses,
      totalAdvances,
      netProfit,
      gustavoAmount,
      agentAmount,
      titheRate,
      gustavoTithe,
      agentTithe,
      agentAfterAdvances,
    },
  };
}

function bucketLines(
  bucket: ExpenseBucket,
  items: LectureExpenseInput[],
  subtotal: number,
): CalcLine[] {
  if (items.length === 0) return [];
  const rows: CalcLine[] = items.map((e) => ({
    label: e.description || BUCKET_LABEL[bucket],
    amount: -Math.abs(Number(e.amount || 0)),
    kind: "out" as const,
    hint: e.date ?? undefined,
  }));
  rows.push({
    label: `Subtotal ${BUCKET_LABEL[bucket]}`,
    amount: -subtotal,
    kind: "subtotal" as const,
  });
  return rows;
}

/** Conta corrente do agendista — derivada de snapshots e adiantamentos. */
export type AgentStatementInput = {
  closedShares: { lectureId: string; lectureTitle: string; date: string | null; amount: number }[];
  advances: {
    id: string;
    granted_on: string | null;
    amount: number;
    amount_amortized: number;
    source?: string | null;
    status?: string | null;
  }[];
  payouts: { id: string; occurs_on: string | null; amount: number; description?: string | null }[];
};

export type AgentStatementLine = {
  id: string;
  date: string | null;
  description: string;
  amount: number; // signed
  kind: "share" | "advance" | "payout";
  ref?: string;
};

export type AgentStatement = {
  lines: AgentStatementLine[];
  totals: {
    earned: number; // soma dos splits do agendista
    advancesOpen: number; // adiantamentos ainda não totalmente amortizados
    advancesTotal: number; // total já entregue como adiantamento
    payoutsTotal: number; // pagamentos efetuados ao agendista
    balance: number; // earned - advancesTotal - payoutsTotal
    titheAccumulated: number; // 10% acumulado sobre comissões fechadas (informativo)
  };
};

export function buildAgentStatement(
  input: AgentStatementInput & { titheRate?: number },
): AgentStatement {
  const titheRate = input.titheRate ?? 0.1;
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
  const titheAccumulated = round(earned * titheRate);

  return {
    lines,
    totals: {
      earned: round(earned),
      advancesOpen: round(advancesOpen),
      advancesTotal: round(advancesTotal),
      payoutsTotal: round(payoutsTotal),
      balance: round(earned - advancesTotal - payoutsTotal),
      titheAccumulated,
    },
  };
}

/**
 * Conta corrente do palestrante — usa o MESMO builder de extrato.
 * Hoje há um único palestrante (Gustavo) e o `closedShares` é alimentado
 * com `gustavo_amount` dos snapshots; no futuro basta filtrar por `speaker_id`.
 */
export const buildSpeakerStatement = buildAgentStatement;
export type SpeakerStatementInput = AgentStatementInput;
export type SpeakerStatement = AgentStatement;

/** Encontra a regra vigente para um agendista numa data — sem nada fixo no código. */
export function selectRule(opts: {
  rules: Array<
    RuleSnapshot & {
      agent_id?: string | null;
      season_id?: string | null;
      is_default?: boolean | null;
      archived_at?: string | null;
    }
  >;
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

export const ADVANCE_SOURCES = ["Palestrante", "Caixa", "Banco", "PIX", "Outro"] as const;
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
