/** Formatadores numéricos compartilhados (pt-BR). */
export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const NUM = new Intl.NumberFormat("pt-BR");

/**
 * Converte valores de data do banco para Date sem deslocar o dia.
 * "2026-07-12" (coluna `date`) vira meia-noite LOCAL; `new Date("2026-07-12")`
 * seria meia-noite UTC — no Brasil, 21h do dia anterior.
 */
export function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

/** 12/07/2026 */
export function formatDateNumeric(value: string | null | undefined) {
  if (!value) return "—";
  return toLocalDate(value).toLocaleDateString("pt-BR");
}
