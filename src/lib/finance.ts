export const PAYMENT_METHODS = [
  { key: "pix", label: "PIX" },
  { key: "dinheiro", label: "Dinheiro" },
  { key: "credito", label: "Cartão de Crédito", isCard: true },
  { key: "debito", label: "Cartão de Débito", isCard: true },
  { key: "cheque", label: "Cheque" },
  { key: "transferencia", label: "Transferência" },
  { key: "boleto", label: "Boleto" },
  { key: "outro", label: "Outro" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["key"];

export function paymentMethodLabel(key: string | null | undefined) {
  if (!key) return "—";
  return PAYMENT_METHODS.find((p) => p.key === key)?.label ?? key;
}

export function isCardPayment(key: string | null | undefined) {
  if (!key) return false;
  const m = PAYMENT_METHODS.find((p) => p.key === key);
  return !!(m as { isCard?: boolean } | undefined)?.isCard;
}

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
