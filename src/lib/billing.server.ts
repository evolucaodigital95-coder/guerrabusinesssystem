/**
 * PADDLE BILLING — camada server-only.
 *
 * Todo contato com o gateway acontece aqui. Nenhuma chave sai deste arquivo.
 * As credenciais são lidas por requisição (Workers injetam env em request time).
 *
 * Secrets esperados (nenhum valor é inventado — sem eles a cobrança fica desligada):
 *   PADDLE_API_KEY        chave de servidor (sandbox durante a validação)
 *   PADDLE_WEBHOOK_SECRET segredo de assinatura do webhook
 *   PADDLE_ENVIRONMENT    "sandbox" (padrão) ou "production"
 */

export type PaddleConfig = {
  apiKey: string;
  webhookSecret: string | null;
  environment: "sandbox" | "production";
  apiBase: string;
};

export class BillingError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export function getPaddleConfig(): PaddleConfig | null {
  const apiKey = process.env["PADDLE_API_KEY"];
  if (!apiKey) return null;
  const environment = process.env["PADDLE_ENVIRONMENT"] === "production" ? "production" : "sandbox";
  return {
    apiKey,
    webhookSecret: process.env["PADDLE_WEBHOOK_SECRET"] ?? null,
    environment,
    apiBase: environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com",
  };
}

export function requirePaddleConfig(): PaddleConfig {
  const config = getPaddleConfig();
  if (!config) throw new BillingError("gateway_not_configured");
  return config;
}

async function paddleFetch<T>(
  config: PaddleConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch (error) {
    console.error("[billing] gateway unreachable", error);
    throw new BillingError("gateway_unavailable");
  }

  const text = await response.text();
  if (!response.ok) {
    // Detalhe técnico fica no log; o cliente recebe apenas o código genérico.
    console.error(`[billing] paddle ${path} failed [${response.status}]: ${text}`);
    throw new BillingError("gateway_unavailable");
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/* ------------------------------------------------------------------ *
 * CUSTOMERS
 * ------------------------------------------------------------------ */

export async function createPaddleCustomer(
  config: PaddleConfig,
  input: { email: string; name?: string | null; organizationId: string },
): Promise<{ id: string; email: string }> {
  const result = await paddleFetch<{ data: { id: string; email: string } }>(config, "/customers", {
    method: "POST",
    body: {
      email: input.email,
      ...(input.name ? { name: input.name } : {}),
      custom_data: { organization_id: input.organizationId },
    },
  });
  return result.data;
}

/* ------------------------------------------------------------------ *
 * TRANSACTIONS / CHECKOUT
 * ------------------------------------------------------------------ */

/**
 * Cria a transação que abre o Paddle Checkout.
 * O preço vem SEMPRE do cadastro do plano — nunca do frontend.
 */
export async function createPaddleCheckoutTransaction(
  config: PaddleConfig,
  input: {
    priceId: string;
    customerId: string;
    organizationId: string;
    planId: string;
    interval: string;
  },
): Promise<{ id: string; checkoutUrl: string | null }> {
  const result = await paddleFetch<{
    data: { id: string; checkout?: { url?: string | null } | null };
  }>(config, "/transactions", {
    method: "POST",
    body: {
      items: [{ price_id: input.priceId, quantity: 1 }],
      customer_id: input.customerId,
      custom_data: {
        organization_id: input.organizationId,
        plan_id: input.planId,
        interval: input.interval,
      },
    },
  });
  return { id: result.data.id, checkoutUrl: result.data.checkout?.url ?? null };
}

/* ------------------------------------------------------------------ *
 * SUBSCRIPTIONS
 * ------------------------------------------------------------------ */

export type PaddleSubscription = {
  id: string;
  status: string;
  customer_id: string;
  scheduled_change?: { action: string; effective_at: string } | null;
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  next_billed_at?: string | null;
  canceled_at?: string | null;
  items?: { price?: { id?: string } | null }[];
  custom_data?: Record<string, unknown> | null;
};

export async function getPaddleSubscription(config: PaddleConfig, subscriptionId: string) {
  const result = await paddleFetch<{ data: PaddleSubscription }>(
    config,
    `/subscriptions/${subscriptionId}`,
  );
  return result.data;
}

export async function cancelPaddleSubscription(
  config: PaddleConfig,
  subscriptionId: string,
  when: "immediately" | "next_billing_period",
) {
  const result = await paddleFetch<{ data: PaddleSubscription }>(
    config,
    `/subscriptions/${subscriptionId}/cancel`,
    { method: "POST", body: { effective_from: when } },
  );
  return result.data;
}

/**
 * Upgrade/downgrade. A prorrata é decidida pelo gateway — o GBS não calcula.
 */
export async function changePaddleSubscriptionPrice(
  config: PaddleConfig,
  subscriptionId: string,
  priceId: string,
  prorationMode: string,
) {
  const result = await paddleFetch<{ data: PaddleSubscription }>(
    config,
    `/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      body: {
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: prorationMode,
      },
    },
  );
  return result.data;
}

/* ------------------------------------------------------------------ *
 * WEBHOOK — validação de assinatura (Paddle-Signature: ts=...;h1=...)
 * ------------------------------------------------------------------ */

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPaddleSignature(
  secret: string,
  signatureHeader: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  let ts: string | null = null;
  let h1: string | null = null;
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.split("=");
    if (key === "ts") ts = value ?? null;
    if (key === "h1") h1 = value ?? null;
  }
  if (!ts || !h1) return false;

  // Rejeita eventos com carimbo de tempo muito antigo (replay).
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const computed = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqualHex(computed, h1.toLowerCase());
}
