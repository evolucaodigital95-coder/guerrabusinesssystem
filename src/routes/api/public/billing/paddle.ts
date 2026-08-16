import { createFileRoute } from "@tanstack/react-router";

import { normalizePaymentStatus, normalizeSubscriptionStatus } from "@/lib/billing";
import { verifyPaddleSignature, getPaddleConfig } from "@/lib/billing.server";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * WEBHOOK DO PADDLE — única fonte de verdade para ativar/alterar assinaturas.
 *
 * Segurança: assinatura HMAC validada antes de qualquer leitura útil do payload.
 * Idempotência: `billing_events.event_id` é único; evento repetido é registrado
 * como "duplicate" e NÃO é processado novamente.
 */

async function resolveOrganizationId(
  admin: any,
  payload: any,
): Promise<{ organizationId: string | null; subscriptionRow: any | null }> {
  const custom = payload?.data?.custom_data ?? {};
  const subscriptionId = payload?.data?.subscription_id ?? payload?.data?.id ?? null;
  const customerId = payload?.data?.customer_id ?? null;

  if (subscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("*")
      .eq("gateway_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) return { organizationId: data.organization_id, subscriptionRow: data };
  }

  let organizationId: string | null = custom.organization_id ?? null;
  if (!organizationId && customerId) {
    const { data } = await admin
      .from("billing_customers")
      .select("organization_id")
      .eq("gateway_customer_id", customerId)
      .maybeSingle();
    organizationId = data?.organization_id ?? null;
  }
  if (!organizationId) return { organizationId: null, subscriptionRow: null };

  const { data: sub } = await admin
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return { organizationId, subscriptionRow: sub ?? null };
}

async function planIdForPrice(admin: any, priceId: string | null): Promise<string | null> {
  if (!priceId) return null;
  const { data } = await admin
    .from("plans")
    .select("id")
    .or(`gateway_price_id_monthly.eq.${priceId},gateway_price_id_yearly.eq.${priceId}`)
    .maybeSingle();
  return data?.id ?? null;
}

async function handleSubscriptionEvent(admin: any, payload: any, organizationId: string | null) {
  const d = payload.data ?? {};
  const status = normalizeSubscriptionStatus(d.status);
  const priceId = d.items?.[0]?.price?.id ?? null;
  const planId = await planIdForPrice(admin, priceId);
  const scheduledCancel = d.scheduled_change?.action === "cancel";

  if (!organizationId) return "ignored";

  const patch: Record<string, unknown> = {
    gateway: "paddle",
    gateway_subscription_id: d.id ?? null,
    gateway_customer_id: d.customer_id ?? null,
    gateway_price_id: priceId,
    current_period_start: d.current_billing_period?.starts_at ?? null,
    current_period_end: d.current_billing_period?.ends_at ?? null,
    next_renewal_at: d.next_billed_at ?? null,
    cancel_at_period_end: scheduledCancel,
    canceled_at: d.canceled_at ?? null,
    last_synced_at: new Date().toISOString(),
  };
  if (status) patch["status"] = status;
  if (planId) patch["plan_id"] = planId;
  if (d.status === "trialing" && d.current_billing_period?.ends_at) {
    patch["trial_ends_at"] = d.current_billing_period.ends_at;
  }

  await admin.from("subscriptions").update(patch).eq("organization_id", organizationId);

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (sub) {
    await admin.from("subscription_events").insert({
      organization_id: organizationId,
      subscription_id: sub.id,
      event: payload.event_type,
      to_status: status,
      to_plan_id: planId,
      source: "gateway",
    });
  }
  return "processed";
}

async function handleTransactionEvent(admin: any, payload: any, organizationId: string | null) {
  const d = payload.data ?? {};
  const total = d.details?.totals?.grand_total ?? d.details?.totals?.total ?? null;

  const { data: sub } = organizationId
    ? await admin
        .from("subscriptions")
        .select("id")
        .eq("organization_id", organizationId)
        .maybeSingle()
    : { data: null };

  await admin.from("billing_payments").upsert(
    {
      organization_id: organizationId,
      subscription_id: sub?.id ?? null,
      gateway: "paddle",
      gateway_transaction_id: d.id,
      gateway_invoice_id: d.invoice_id ?? null,
      gateway_customer_id: d.customer_id ?? null,
      status: normalizePaymentStatus(d.status),
      amount_cents: total !== null ? Number(total) : null,
      currency: d.currency_code ?? "BRL",
      billed_at: d.billed_at ?? d.created_at ?? null,
      environment: process.env["PADDLE_ENVIRONMENT"] === "production" ? "production" : "sandbox",
      failure_reason:
        payload.event_type === "transaction.payment_failed"
          ? (d.payments?.[0]?.error_code ?? "payment_failed")
          : null,
    },
    { onConflict: "gateway,gateway_transaction_id" },
  );

  return "processed";
}

export const Route = createFileRoute("/api/public/billing/paddle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getPaddleConfig();
        const rawBody = await request.text();

        if (!config?.webhookSecret) {
          console.error("[billing] webhook received but PADDLE_WEBHOOK_SECRET is not configured");
          return new Response("not configured", { status: 503 });
        }

        const valid = await verifyPaddleSignature(
          config.webhookSecret,
          request.headers.get("paddle-signature"),
          rawBody,
        );
        if (!valid) return new Response("invalid signature", { status: 401 });

        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("invalid payload", { status: 400 });
        }

        const eventId: string | undefined = payload?.event_id;
        const eventType: string | undefined = payload?.event_type;
        if (!eventId || !eventType) return new Response("invalid payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        // IDEMPOTÊNCIA: só processa quem conseguiu inserir o event_id.
        const inserted = await admin
          .from("billing_events")
          .insert({
            gateway: "paddle",
            event_id: eventId,
            event_type: eventType,
            status: "received",
            environment: config.environment,
            gateway_subscription_id: payload?.data?.subscription_id ?? payload?.data?.id ?? null,
            gateway_transaction_id: payload?.data?.transaction_id ?? null,
            gateway_customer_id: payload?.data?.customer_id ?? null,
            payload,
          })
          .select("id")
          .maybeSingle();

        if (inserted.error) {
          if (inserted.error.code === "23505") {
            console.warn(`[billing] duplicate webhook ignored: ${eventType} ${eventId}`);
            return new Response("duplicate", { status: 200 });
          }
          console.error("[billing] failed to persist webhook", inserted.error);
          return new Response("error", { status: 500 });
        }

        const rowId = inserted.data?.id;
        try {
          const { organizationId } = await resolveOrganizationId(admin, payload);
          let result = "ignored";

          if (eventType.startsWith("subscription.")) {
            result = await handleSubscriptionEvent(admin, payload, organizationId);
          } else if (eventType.startsWith("transaction.")) {
            result = await handleTransactionEvent(admin, payload, organizationId);
          }

          await admin
            .from("billing_events")
            .update({
              status: result,
              organization_id: organizationId,
              processed_at: new Date().toISOString(),
            })
            .eq("id", rowId);

          return new Response("ok", { status: 200 });
        } catch (error) {
          console.error("[billing] webhook processing failed", error);
          await admin
            .from("billing_events")
            .update({
              status: "error",
              error: error instanceof Error ? error.message : String(error),
              processed_at: new Date().toISOString(),
            })
            .eq("id", rowId);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
