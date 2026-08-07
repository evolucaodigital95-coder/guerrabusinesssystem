/**
 * GBS — Catálogo de eventos do Motor de Automações.
 *
 * IMPORTANTE: este módulo NÃO contém regra financeira nem cálculo.
 * Ele apenas nomeia os eventos de negócio que o sistema emite.
 */

import type { EntityType } from "@/lib/entities";

export const AUTOMATION_EVENTS = {
  "company.created": "Empresa criada",
  "company.updated": "Empresa editada",
  "lecture.created": "Palestra criada",
  "lecture.updated": "Palestra alterada",
  "lecture.closed": "Palestra encerrada (fechamento financeiro)",
  "finance.movement.created": "Pagamento registrado",
  "finance.movement.updated": "Lançamento financeiro alterado",
  "finance.payment.received": "Pagamento confirmado (entrada)",
  "finance.payment.made": "Pagamento confirmado (saída)",
  "stock.movement.created": "Saída de estoque",
  "stock.batch.created": "Entrada de estoque",
  "advance.created": "Adiantamento realizado",
  "supplier.settlement.created": "Acerto com fornecedor",
} as const;

export type AutomationEvent = keyof typeof AUTOMATION_EVENTS;

export function eventLabel(event: string): string {
  return (AUTOMATION_EVENTS as Record<string, string>)[event] ?? event;
}

export const AUTOMATION_EVENT_LIST = Object.entries(AUTOMATION_EVENTS).map(
  ([key, label]) => ({ key: key as AutomationEvent, label }),
);

/** Dados que acompanham um evento. Todos opcionais — o motor é tolerante. */
export type AutomationPayload = {
  entityType?: EntityType;
  entityId?: string | null;
  /** Entidades relacionadas, usadas para invalidar caches de detalhe. */
  companyId?: string | null;
  lectureId?: string | null;
  agentId?: string | null;
  seasonId?: string | null;
  stockItemId?: string | null;
  /** Texto curto exibido no log e na timeline. */
  summary?: string;
  /** Valores livres apenas para registro (nunca usados em cálculo). */
  meta?: Record<string, unknown>;
};
