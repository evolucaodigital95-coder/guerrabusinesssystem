export const MOVEMENT_DIRECTIONS = [
  { key: "in", label: "Entrada" },
  { key: "out", label: "Saída" },
] as const;

export type MovementDirection = (typeof MOVEMENT_DIRECTIONS)[number]["key"];

export const INCOME_STATUS = [
  { key: "previsto", label: "Previsto" },
  { key: "parcial", label: "Parcial" },
  { key: "recebido", label: "Recebido" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export const EXPENSE_STATUS = [
  { key: "prevista", label: "Prevista" },
  { key: "parcial", label: "Parcial" },
  { key: "paga", label: "Paga" },
  { key: "cancelada", label: "Cancelada" },
] as const;

export const ACCOUNT_KINDS = [
  "Caixa",
  "Banco",
  "PIX",
  "InfinitePay",
  "Cartão",
  "Sócio",
  "Outro",
] as const;

export const ACCOUNT_STATUS = ["ativa", "inativa"] as const;

export const MOVEMENT_CATEGORIES = [
  "Palestra",
  "Comissão",
  "Pró-labore",
  "Marketing",
  "Operacional",
  "Impostos",
  "Folha",
  "Tecnologia",
  "Viagem",
  "Adiantamento",
  "Outros",
] as const;

export function statusOptions(direction: MovementDirection) {
  return direction === "in" ? INCOME_STATUS : EXPENSE_STATUS;
}

export function statusLabel(direction: MovementDirection | null | undefined, status: string | null | undefined) {
  if (!status) return "—";
  const list = direction === "out" ? EXPENSE_STATUS : INCOME_STATUS;
  return list.find((s) => s.key === status)?.label ?? status;
}

export function isSettled(direction: MovementDirection | null | undefined, status: string | null | undefined) {
  if (!status) return false;
  return status === "recebido" || status === "paga";
}

export const FINANCE_TIMELINE_KINDS = [
  { key: "receivable_created", label: "Receita criada" },
  { key: "payable_created", label: "Despesa criada" },
  { key: "payment_received", label: "Pagamento recebido" },
  { key: "payment_made", label: "Pagamento efetuado" },
  { key: "receipt_attached", label: "Comprovante anexado" },
  { key: "reconciled", label: "Conciliação" },
  { key: "closed", label: "Fechamento" },
] as const;
