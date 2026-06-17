/**
 * Estoque — constantes e helpers do módulo.
 * Toda entrada/saída/reserva/baixa é uma movimentação em `stock_movements`.
 * Nenhum valor é apagado: usar `archived_at` ou `status = 'cancelado'`.
 */

export const STOCK_CATEGORIES = [
  "Livros",
  "Folders",
  "Brindes",
  "Camisetas",
  "Certificados",
  "Equipamentos",
  "Materiais",
  "Outros",
] as const;

export const STOCK_UNITS = [
  "un",
  "cx",
  "pct",
  "kit",
  "kg",
  "g",
  "m",
  "cm",
  "L",
  "mL",
] as const;

export const STOCK_ITEM_STATUS = [
  { key: "ativo", label: "Ativo" },
  { key: "inativo", label: "Inativo" },
  { key: "esgotado", label: "Esgotado" },
  { key: "descontinuado", label: "Descontinuado" },
] as const;

export type StockItemStatus = (typeof STOCK_ITEM_STATUS)[number]["key"];

/** Tipos de movimentação. `direction` (in/out) é derivado do `kind`. */
export const MOVEMENT_KINDS = [
  { key: "entrada", label: "Entrada", direction: "in" },
  { key: "saida", label: "Saída", direction: "out" },
  { key: "reserva", label: "Reserva", direction: "out" },
  { key: "baixa", label: "Baixa", direction: "out" },
  { key: "devolucao", label: "Devolução", direction: "in" },
  { key: "ajuste", label: "Ajuste", direction: "in" },
  { key: "cancelamento", label: "Cancelamento", direction: "in" },
] as const;

export type MovementKind = (typeof MOVEMENT_KINDS)[number]["key"];

export function movementKindLabel(key: string | null | undefined) {
  if (!key) return "—";
  return MOVEMENT_KINDS.find((k) => k.key === key)?.label ?? key;
}

export function movementDirection(kind: string | null | undefined): "in" | "out" {
  return MOVEMENT_KINDS.find((k) => k.key === kind)?.direction === "out" ? "out" : "in";
}

export const RESERVATION_STATUS = [
  { key: "disponivel", label: "Disponível" },
  { key: "reservado", label: "Reservado" },
  { key: "utilizado", label: "Utilizado" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUS)[number]["key"];

export function reservationStatusLabel(key: string | null | undefined) {
  if (!key) return "—";
  return RESERVATION_STATUS.find((s) => s.key === key)?.label ?? key;
}

/** Calcula o saldo de um item a partir das movimentações. */
export function calcOnHand(
  movements: Array<{ kind?: string | null; direction?: string | null; quantity?: number | string | null; status?: string | null }>,
) {
  let onHand = 0;
  let reserved = 0;
  for (const m of movements) {
    const q = Number(m.quantity ?? 0);
    if (!q) continue;
    if (m.kind === "cancelamento" || m.status === "cancelado") continue;
    if (m.kind === "reserva" && m.status !== "utilizado") {
      reserved += q;
      continue;
    }
    const dir = m.direction ?? movementDirection(m.kind);
    onHand += dir === "in" ? q : -q;
  }
  return { onHand, reserved, available: onHand - reserved };
}
