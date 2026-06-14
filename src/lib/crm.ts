export const LIFECYCLE_STAGES = [
  { key: "lead", label: "Lead criado" },
  { key: "first_contact", label: "Primeiro contato" },
  { key: "negotiation", label: "Negociação" },
  { key: "proposal", label: "Proposta enviada" },
  { key: "closing", label: "Fechamento" },
  { key: "lecture_done", label: "Palestra realizada" },
  { key: "post_sale", label: "Pós-venda" },
  { key: "recurring", label: "Cliente recorrente" },
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]["key"];

export function stageIndex(stage: string | null | undefined): number {
  if (!stage) return 0;
  const i = LIFECYCLE_STAGES.findIndex((s) => s.key === stage);
  return i < 0 ? 0 : i;
}

export const COMPANY_STATUS = ["ativo", "inativo", "prospect", "perdido"] as const;

export const LEAD_STATUS = ["novo", "qualificando", "qualificado", "convertido", "descartado"] as const;

export const OPPORTUNITY_STATUS = ["aberta", "ganha", "perdida", "pausada"] as const;

export function formatCurrency(value: number | null | undefined, currency = "BRL") {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value));
}
