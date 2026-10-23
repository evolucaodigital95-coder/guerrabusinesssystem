/**
 * Traduz recusas do banco (travas de integridade) para linguagem de usuário.
 * As mensagens de estoque já vêm prontas do gatilho `stock_mov_prevent_negative`.
 */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  fin_mov_direction_chk: "Escolha se o lançamento é uma entrada ou uma saída.",
  fin_mov_amount_nonneg_chk:
    "Os valores não podem ser negativos — o tipo (entrada/saída) já define o sinal.",
  fin_mov_status_chk: "O status escolhido não combina com o tipo do lançamento.",
  fin_mov_settled_amount_chk: "Para marcar como recebido/pago, informe o valor realizado.",
  fin_mov_description_chk: "Descreva o lançamento.",
  stock_mov_direction_chk: "Movimentação de estoque inválida.",
  stock_mov_quantity_chk:
    "A quantidade precisa ser maior que zero (quantidade negativa só em Ajuste).",
};

export function dbErrorMessage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("Estoque insuficiente") || raw.startsWith("Não é possível: o estoque"))
    return raw;
  for (const [name, message] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (raw.includes(name)) return message;
  }
  return null;
}
