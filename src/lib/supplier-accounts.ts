/**
 * Prestação de Contas ao Fornecedor.
 *
 * Toda inteligência financeira é DERIVADA das tabelas existentes:
 *  - inventory_batches   → fornecedor + custo da entrada
 *  - stock_movements     → entradas (compra), saídas (utilização), season_id, lecture_id
 *  - supplier_settlements → apenas os acertos financeiros (nova tabela)
 *
 * NADA aqui altera estoque, palestras, snapshots ou o livro razão.
 */

export type Movement = {
  id: string;
  stock_item_id: string | null;
  batch_id: string | null;
  kind: string | null;
  direction: string | null;
  status: string | null;
  quantity: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
  season_id: string | null;
  lecture_id: string | null;
  occurs_on: string | null;
};

export type Batch = {
  id: string;
  stock_item_id: string | null;
  supplier: string | null;
  unit_cost: number | string | null;
};

export type Item = {
  id: string;
  name: string;
  supplier: string | null;
  unit: string | null;
  category: string | null;
};

export type Lecture = {
  id: string;
  title: string | null;
  company_id: string | null;
  season_id: string | null;
};

export type Company = { id: string; legal_name: string | null };

export type Settlement = {
  id: string;
  supplier: string;
  season_id: string | null;
  amount_paid: number | string;
  paid_on: string;
  payment_method: string | null;
  receipt_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const UNKNOWN_SUPPLIER = "Sem fornecedor";

function movementIsLive(m: Movement) {
  if (m.status === "cancelado" || m.status === "estornado") return false;
  if (m.kind === "cancelamento") return false;
  return true;
}

/** Retorna o fornecedor associado a uma movimentação (lote → item). */
export function supplierOf(
  m: Movement,
  batches: Map<string, Batch>,
  items: Map<string, Item>,
): string {
  const b = m.batch_id ? batches.get(m.batch_id) : null;
  if (b?.supplier?.trim()) return b.supplier.trim();
  const it = m.stock_item_id ? items.get(m.stock_item_id) : null;
  if (it?.supplier?.trim()) return it.supplier.trim();
  return UNKNOWN_SUPPLIER;
}

/** Custo total de uma movimentação (total_cost > unit_cost * quantity). */
export function movementCost(m: Movement): number {
  const total = num(m.total_cost);
  if (total > 0) return total;
  return num(m.unit_cost) * num(m.quantity);
}

export type SupplierAggregate = {
  supplier: string;
  purchased: number;
  used: number;
  settled: number;
  balance: number; // used - settled
  inStock: number; // purchased - used
};

export type BookConsumption = {
  itemId: string;
  name: string;
  unit: string | null;
  supplier: string;
  quantity: number;
  avgUnitCost: number;
  totalValue: number;
};

export type CompanyConsumption = {
  companyId: string | null;
  companyName: string;
  supplier: string;
  totalValue: number;
};

export type SupplierFilters = {
  seasonId?: string | null;
};

/**
 * Constrói os agregados por fornecedor, respeitando a temporada.
 * Se seasonId estiver definido, filtra por m.season_id === seasonId.
 */
export function aggregateBySupplier(params: {
  movements: Movement[];
  batches: Batch[];
  items: Item[];
  settlements: Settlement[];
  seasonId?: string | null;
}): SupplierAggregate[] {
  const { movements, batches, items, settlements, seasonId } = params;
  const bMap = new Map(batches.map((b) => [b.id, b]));
  const iMap = new Map(items.map((i) => [i.id, i]));

  const map = new Map<string, SupplierAggregate>();
  const get = (s: string) => {
    let cur = map.get(s);
    if (!cur) {
      cur = { supplier: s, purchased: 0, used: 0, settled: 0, balance: 0, inStock: 0 };
      map.set(s, cur);
    }
    return cur;
  };

  for (const m of movements) {
    if (!movementIsLive(m)) continue;
    if (seasonId && m.season_id !== seasonId) continue;
    const cost = movementCost(m);
    if (cost <= 0) continue;
    const sup = supplierOf(m, bMap, iMap);
    const agg = get(sup);
    if (m.kind === "entrada" || m.kind === "devolucao") {
      agg.purchased += m.kind === "entrada" ? cost : 0;
    } else if (m.kind === "saida" || m.kind === "baixa") {
      agg.used += cost;
    }
  }

  for (const s of settlements) {
    if (seasonId && s.season_id !== seasonId) continue;
    const agg = get(s.supplier?.trim() || UNKNOWN_SUPPLIER);
    agg.settled += num(s.amount_paid);
  }

  for (const a of map.values()) {
    a.inStock = a.purchased - a.used;
    a.balance = a.used - a.settled;
  }

  return Array.from(map.values()).sort((a, b) => b.balance - a.balance || b.used - a.used);
}

export type SupplierTotals = {
  purchased: number;
  used: number;
  inStock: number;
  settled: number;
  balance: number;
};

export function totalsFromAggregates(rows: SupplierAggregate[]): SupplierTotals {
  return rows.reduce<SupplierTotals>(
    (t, r) => {
      t.purchased += r.purchased;
      t.used += r.used;
      t.inStock += r.inStock;
      t.settled += r.settled;
      t.balance += r.balance;
      return t;
    },
    { purchased: 0, used: 0, inStock: 0, settled: 0, balance: 0 },
  );
}

/** Ranking por livro/material — apenas SAÍDAS (consumo). */
export function aggregateBooks(params: {
  movements: Movement[];
  batches: Batch[];
  items: Item[];
  seasonId?: string | null;
  supplier?: string | null;
}): BookConsumption[] {
  const { movements, batches, items, seasonId, supplier } = params;
  const bMap = new Map(batches.map((b) => [b.id, b]));
  const iMap = new Map(items.map((i) => [i.id, i]));

  const map = new Map<string, BookConsumption>();
  for (const m of movements) {
    if (!movementIsLive(m)) continue;
    if (m.kind !== "saida" && m.kind !== "baixa") continue;
    if (seasonId && m.season_id !== seasonId) continue;
    if (!m.stock_item_id) continue;
    const sup = supplierOf(m, bMap, iMap);
    if (supplier && sup !== supplier) continue;
    const it = iMap.get(m.stock_item_id);
    if (!it) continue;
    const cost = movementCost(m);
    const qty = num(m.quantity);
    let row = map.get(m.stock_item_id);
    if (!row) {
      row = { itemId: m.stock_item_id, name: it.name, unit: it.unit, supplier: sup, quantity: 0, avgUnitCost: 0, totalValue: 0 };
      map.set(m.stock_item_id, row);
    }
    row.quantity += qty;
    row.totalValue += cost;
  }
  for (const r of map.values()) {
    r.avgUnitCost = r.quantity > 0 ? r.totalValue / r.quantity : 0;
  }
  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
}

/** Ranking por empresa (via lecture_id → companies). */
export function aggregateCompanies(params: {
  movements: Movement[];
  batches: Batch[];
  items: Item[];
  lectures: Lecture[];
  companies: Company[];
  seasonId?: string | null;
  supplier?: string | null;
}): CompanyConsumption[] {
  const { movements, batches, items, lectures, companies, seasonId, supplier } = params;
  const bMap = new Map(batches.map((b) => [b.id, b]));
  const iMap = new Map(items.map((i) => [i.id, i]));
  const lMap = new Map(lectures.map((l) => [l.id, l]));
  const cMap = new Map(companies.map((c) => [c.id, c]));

  const map = new Map<string, CompanyConsumption>();
  for (const m of movements) {
    if (!movementIsLive(m)) continue;
    if (m.kind !== "saida" && m.kind !== "baixa") continue;
    if (seasonId && m.season_id !== seasonId) continue;
    const sup = supplierOf(m, bMap, iMap);
    if (supplier && sup !== supplier) continue;
    const cost = movementCost(m);
    if (cost <= 0) continue;
    const lec = m.lecture_id ? lMap.get(m.lecture_id) : null;
    const companyId = lec?.company_id ?? null;
    const companyName = companyId
      ? cMap.get(companyId)?.legal_name ?? "Empresa sem nome"
      : "Sem empresa vinculada";
    const key = `${sup}::${companyId ?? "none"}`;
    let row = map.get(key);
    if (!row) {
      row = { companyId, companyName, supplier: sup, totalValue: 0 };
      map.set(key, row);
    }
    row.totalValue += cost;
  }
  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
}

export const PAYMENT_METHODS = [
  "PIX",
  "Transferência",
  "Dinheiro",
  "Boleto",
  "Cheque",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Outro",
] as const;

export const SUPPLIER_ACCOUNTS_LABEL = "Prestação de Contas";
