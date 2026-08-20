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
  { key: "utilizado", label: "Efetivada" },
  { key: "cancelado", label: "Cancelada" },
  { key: "estornado", label: "Estornada" },
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUS)[number]["key"];

/** Status que anulam o efeito da movimentação (saldo, custo e indicadores). */
export const VOID_STATUSES = ["cancelado", "estornado"] as const;

export function isVoidMovement(status?: string | null, kind?: string | null) {
  return !!status && (VOID_STATUSES as readonly string[]).includes(status) || kind === "cancelamento";
}

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
    if (isVoidMovement(m.status, m.kind)) continue;
    if (m.kind === "reserva" && m.status !== "utilizado") {
      reserved += q;
      continue;
    }
    const dir = m.direction ?? movementDirection(m.kind);
    onHand += dir === "in" ? q : -q;
  }
  return { onHand, reserved, available: onHand - reserved };
}

/** Custo real de uma movimentação (usa o valor histórico gravado). */
export function movementCost(m: {
  quantity?: number | string | null;
  unit_cost?: number | string | null;
  total_cost?: number | string | null;
}) {
  const total = Number(m.total_cost ?? 0);
  if (total) return total;
  return Number(m.quantity ?? 0) * Number(m.unit_cost ?? 0);
}

