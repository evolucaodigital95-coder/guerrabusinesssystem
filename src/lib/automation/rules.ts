import type { AutomationEvent, AutomationPayload } from "./events";
import type { AutomationContext } from "./engine";

/**
 * Regras do Motor de Automações.
 *
 * Uma regra é uma reação declarativa a um evento. As regras aqui são
 * SEMPRE não-destrutivas: elas sincronizam caches, registram histórico e
 * produzem log auditável. Nenhuma regra altera cálculo ou regra financeira.
 */
export type AutomationRule = {
  id: string;
  label: string;
  description: string;
  events: AutomationEvent[];
  /** Retorna a descrição do resultado (ou null quando não houve efeito). */
  run: (ctx: AutomationContext, payload: AutomationPayload) => Promise<string | null>;
};

/** Invalida um conjunto de chaves do React Query. */
function refresh(keys: (readonly unknown[])[]): AutomationRule["run"] {
  return async (ctx) => {
    if (ctx.dryRun) return `${keys.length} conjuntos de dados seriam atualizados`;
    for (const key of keys) ctx.queryClient.invalidateQueries({ queryKey: key as unknown[] });
    return `${keys.length} conjuntos de dados atualizados`;
  };
}

const DASHBOARD_KEYS = [
  ["dashboard"],
  ["operations"],
  ["hoje"],
  ["agenda"],
  ["indicadores"],
  ["painel-diretor"],
  ["centro-palestrante"],
  ["inteligencia"],
] as const;

export const AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "sync-dashboards",
    label: "Sincronizar painéis executivos",
    description:
      "Atualiza Dashboard, Hoje, Agenda, Indicadores, Painel do Diretor e Centro de Inteligência.",
    events: [
      "company.created",
      "company.updated",
      "lecture.created",
      "lecture.updated",
      "lecture.closed",
      "finance.movement.created",
      "finance.movement.updated",
      "finance.payment.received",
      "finance.payment.made",
      "stock.movement.created",
      "stock.batch.created",
      "advance.created",
      "supplier.settlement.created",
    ],
    run: refresh([...DASHBOARD_KEYS]),
  },
  {
    id: "sync-crm",
    label: "Sincronizar CRM",
    description: "Atualiza a lista de empresas e a ficha da empresa relacionada.",
    events: ["company.created", "company.updated", "lecture.created", "lecture.closed", "finance.movement.created"],
    run: async (ctx, p) => {
      const keys: unknown[][] = [["companies"]];
      if (p.companyId) keys.push(["company", p.companyId], ["company-lectures", p.companyId], ["company-finance", p.companyId]);
      return refresh(keys)(ctx, p);
    },
  },
  {
    id: "sync-lectures",
    label: "Sincronizar palestras",
    description: "Atualiza a agenda de palestras e a Central da Palestra relacionada.",
    events: ["lecture.created", "lecture.updated", "lecture.closed", "finance.movement.created", "stock.movement.created"],
    run: async (ctx, p) => {
      const keys: unknown[][] = [["lectures"]];
      if (p.lectureId) {
        keys.push(
          ["lecture", p.lectureId],
          ["lecture-stock", p.lectureId],
          ["fechamento-stock", p.lectureId],
          ["lecture-finance", p.lectureId],
          ["lecture-snapshot", p.lectureId],
        );
      }
      return refresh(keys)(ctx, p);
    },
  },
  {
    id: "sync-finance",
    label: "Sincronizar livro razão",
    description: "Atualiza lançamentos, contas e saldos do Financeiro.",
    events: [
      "finance.movement.created",
      "finance.movement.updated",
      "finance.payment.received",
      "finance.payment.made",
      "lecture.closed",
      "advance.created",
    ],
    run: refresh([["movements"], ["accounts"], ["finance-summary"]]),
  },
  {
    id: "sync-agents",
    label: "Sincronizar conta corrente dos agendistas",
    description: "Atualiza extrato, adiantamentos e saldo do agendista relacionado.",
    events: ["advance.created", "lecture.closed", "finance.payment.made", "finance.movement.created"],
    run: async (ctx, p) => {
      const keys: unknown[][] = [["agents"]];
      if (p.agentId) keys.push(["advances", p.agentId], ["agent-statement", p.agentId], ["agent", p.agentId]);
      return refresh(keys)(ctx, p);
    },
  },
  {
    id: "sync-stock",
    label: "Sincronizar estoque",
    description: "Atualiza itens, lotes, movimentações e prestação de contas ao fornecedor.",
    events: ["stock.movement.created", "stock.batch.created", "supplier.settlement.created", "lecture.closed"],
    run: async (ctx, p) => {
      const keys: unknown[][] = [
        ["stock-items"],
        ["stock-movements"],
        ["supplier-settlements"],
        ["supplier-accounts"],
      ];
      if (p.stockItemId) {
        keys.push(
          ["stock-item", p.stockItemId],
          ["stock-batches", p.stockItemId],
          ["stock-movements", p.stockItemId],
          ["stock-item-metrics", p.stockItemId],
        );
      }
      return refresh(keys)(ctx, p);
    },
  },
  {
    id: "sync-seasons",
    label: "Sincronizar temporadas",
    description: "Atualiza o painel da temporada, campanhas e projetos vinculados.",
    events: ["lecture.created", "lecture.closed", "finance.movement.created", "supplier.settlement.created"],
    run: async (ctx, p) => {
      const keys: unknown[][] = [["seasons"], ["campaigns"], ["projects"]];
      if (p.seasonId) keys.push(["season", p.seasonId], ["season-dashboard", p.seasonId]);
      return refresh(keys)(ctx, p);
    },
  },
  {
    id: "timeline-entry",
    label: "Registrar na timeline da entidade",
    description:
      "Grava o evento na timeline da empresa, palestra, agendista ou item relacionado.",
    events: [
      "lecture.closed",
      "finance.payment.received",
      "finance.payment.made",
      "advance.created",
      "supplier.settlement.created",
      "stock.movement.created",
    ],
    run: async (ctx, p) => {
      if (!p.entityType || !p.entityId) return null;
      if (ctx.dryRun) return "Registro de timeline simulado";
      const { error } = await ctx.supabase.from("timeline_events").insert({
        organization_id: ctx.organizationId,
        entity_type: p.entityType,
        entity_id: p.entityId,
        kind: "automation",
        title: p.summary ?? "Automação executada",
        body: null,
        occurs_at: new Date().toISOString(),
        created_by: ctx.userId,
        updated_by: ctx.userId,
      });
      if (error) throw error;
      if (p.entityId) ctx.queryClient.invalidateQueries({ queryKey: ["timeline", p.entityType, p.entityId] });
      return "Evento registrado na timeline";
    },
  },
  {
    id: "sync-search-audit",
    label: "Sincronizar busca global e auditoria",
    description: "Mantém a Pesquisa Global e a trilha de auditoria atualizadas.",
    events: [
      "company.created",
      "lecture.created",
      "lecture.closed",
      "finance.movement.created",
      "stock.movement.created",
      "advance.created",
      "supplier.settlement.created",
    ],
    run: refresh([["global-search"], ["audit-log"], ["automation-log"]]),
  },
];

export function rulesForEvent(event: AutomationEvent): AutomationRule[] {
  return AUTOMATION_RULES.filter((r) => r.events.includes(event));
}
