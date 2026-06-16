/**
 * Fonte única dos `entity_type` usados por tabelas polimórficas:
 * `attachments`, `notes`, `timeline_events`, `taggings`, `audit_log`.
 *
 * Manter aqui evita strings soltas pelo código e garante que
 * Empresas, Palestras, Agendistas, Financeiro, Temporadas etc.
 * sempre se refiram às mesmas chaves.
 */

export const ENTITY_TYPES = {
  company: "company",
  contact: "contact",
  lead: "lead",
  opportunity: "opportunity",
  lecture: "lecture",
  agent: "agent",
  season: "season",
  campaign: "campaign",
  project: "project",
  financial_movement: "financial_movement",
  account: "account",
  stock_item: "stock_item",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export const ENTITY_LABEL: Record<EntityType, string> = {
  company: "Empresa",
  contact: "Contato",
  lead: "Lead",
  opportunity: "Oportunidade",
  lecture: "Palestra",
  agent: "Agendista",
  season: "Temporada",
  campaign: "Campanha",
  project: "Projeto",
  financial_movement: "Lançamento",
  account: "Conta",
  stock_item: "Estoque",
};

/** Rota canônica de detalhe para cada entidade (quando existe). */
export const ENTITY_ROUTE: Partial<Record<EntityType, (id: string) => string>> = {
  company: (id) => `/app/crm/${id}`,
  lecture: (id) => `/app/palestras/${id}`,
  agent: (id) => `/app/agendistas/${id}`,
  financial_movement: () => `/app/financeiro`,
};
