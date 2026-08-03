/**
 * GBS — Catálogo de eventos do Motor de Automações.
 *
 * IMPORTANTE: este módulo NÃO contém regra financeira nem cálculo.
 * Ele apenas nomeia os eventos de negócio que o sistema emite.
 */

import type { EntityType } from "@/lib/entities";

export const AUTOMATION_EVENTS = {
  "company.created": "Empresa criada",
  "company.updated": "Empresa atualizada",
  "lecture.created": "Palestra criada",
  "lecture.updated": "Palestra atualizada",
  "lecture.closed": "Fechamento financeiro da palestra",
  "finance.movement.created": "Lançamento financeiro criado",
  "finance.movement.updated": "Lançamento financeiro atualizado",
  "finance.payment.received": "Pagamento recebido",
  "finance.payment.made": "Pagamento efetuado",
  "stock.movement.created": "Estoque movimentado",
  "stock.batch.created": "Entrada de estoque (lote)",
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
