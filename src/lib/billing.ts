/**
 * GBS BILLING — camada neutra de cobrança (client-safe).
 *
 * Nada aqui fala com o gateway. Este módulo define apenas:
 *   - tipos compartilhados
 *   - normalização de status do gateway -> status interno do GBS
 *   - formatação de valores em centavos
 *
 * A comunicação real com o Paddle vive em `billing.server.ts` (server-only)
 * e é exposta por `billing.functions.ts` (server functions).
 */

import type { SubscriptionStatus } from "@/lib/platform";

export type BillingGateway = "paddle";
export type BillingEnvironment = "sandbox" | "production";
export type BillingInterval = "monthly" | "yearly";

export type BillingCustomer = {
  id: string;
  organization_id: string;
  gateway: string;
  gateway_customer_id: string;
  email: string | null;
  name: string | null;
  environment: string;
  created_at: string;
};

export type BillingPayment = {
  id: string;
  organization_id: string | null;
  subscription_id: string | null;
  gateway: string;
  gateway_transaction_id: string;
  gateway_invoice_id: string | null;
  status: string;
  amount_cents: number | null;
  currency: string;
  billed_at: string | null;
  environment: string;
  failure_reason: string | null;
  created_at: string;
};

export type BillingEvent = {
  id: string;
  gateway: string;
  event_id: string;
  event_type: string;
  organization_id: string | null;
  gateway_subscription_id: string | null;
  gateway_transaction_id: string | null;
  status: string;
  environment: string;
  error: string | null;
  received_at: string;
  processed_at: string | null;
};

/* ------------------------------------------------------------------ *
 * NORMALIZAÇÃO DE STATUS
 * Os status do gateway NUNCA devem vazar para a aplicação.
 * ------------------------------------------------------------------ */

/** Status de assinatura do Paddle Billing. */
const PADDLE_SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  trialing: "trial",
  active: "active",
  past_due: "past_due",
  paused: "suspended",
  canceled: "canceled",
};

export function normalizeSubscriptionStatus(
  gatewayStatus: string | null | undefined,
): SubscriptionStatus | null {
  if (!gatewayStatus) return null;
  return PADDLE_SUBSCRIPTION_STATUS[gatewayStatus.toLowerCase()] ?? null;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "canceled";

/** Status de transação do Paddle Billing. */
const PADDLE_TRANSACTION_STATUS: Record<string, PaymentStatus> = {
  draft: "pending",
  ready: "pending",
  billed: "pending",
  paid: "paid",
  completed: "paid",
  past_due: "failed",
  payment_failed: "failed",
  canceled: "canceled",
};

export function normalizePaymentStatus(gatewayStatus: string | null | undefined): PaymentStatus {
  if (!gatewayStatus) return "pending";
  return PADDLE_TRANSACTION_STATUS[gatewayStatus.toLowerCase()] ?? "pending";
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Recusado",
  refunded: "Reembolsado",
  canceled: "Cancelado",
};

/* ------------------------------------------------------------------ *
 * VALORES
 * O gateway trabalha com a menor unidade da moeda (centavos, string).
 * ------------------------------------------------------------------ */

export function centsToAmount(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return Math.round(cents) / 100;
}

export function amountToCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

export function formatCents(cents: number | null | undefined, currency = "BRL"): string {
  const value = centsToAmount(cents);
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

/* ------------------------------------------------------------------ *
 * EVENTOS SUPORTADOS
 * ------------------------------------------------------------------ */

export const BILLING_EVENT_LABEL: Record<string, string> = {
  "transaction.created": "Checkout criado",
  "transaction.completed": "Pagamento aprovado",
  "transaction.payment_failed": "Pagamento recusado",
  "transaction.updated": "Transação atualizada",
  "subscription.created": "Assinatura criada",
  "subscription.activated": "Assinatura ativada",
  "subscription.updated": "Assinatura atualizada",
  "subscription.canceled": "Assinatura cancelada",
  "subscription.paused": "Assinatura suspensa",
  "subscription.resumed": "Assinatura reativada",
  "subscription.past_due": "Assinatura em atraso",
  "adjustment.created": "Reembolso / ajuste",
};

export const BILLING_ERROR_MESSAGE: Record<string, string> = {
  gateway_not_configured:
    "A cobrança ainda não está configurada. Fale com o administrador da plataforma.",
  plan_not_found: "Plano indisponível no momento.",
  price_not_configured: "Este plano ainda não possui preço configurado no gateway.",
  organization_exempt: "Esta organização é interna e não passa por cobrança.",
  forbidden: "Você não tem permissão para gerenciar a assinatura desta organização.",
  gateway_unavailable: "O serviço de pagamento está indisponível. Tente novamente em instantes.",
  subscription_not_found: "Nenhuma assinatura ativa foi encontrada para esta organização.",
};

export function billingErrorMessage(code: string | null | undefined): string {
  if (!code) return "Não foi possível concluir a operação. Tente novamente.";
  return BILLING_ERROR_MESSAGE[code] ?? "Não foi possível concluir a operação. Tente novamente.";
}
