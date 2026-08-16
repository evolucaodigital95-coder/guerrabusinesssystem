import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * BILLING SERVICE (fronteira RPC).
 *
 * Regras invioláveis:
 *  - o preço/price_id vem SEMPRE do cadastro do plano no banco;
 *  - o frontend nunca define preço, status ou plano ativo;
 *  - nenhuma assinatura é ativada aqui — só o webhook confirmado ativa.
 */

const isManager = async (supabase: any, userId: string, organizationId: string) => {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return data?.role === "owner" || data?.role === "admin";
};

/** Estado de cobrança da organização (plano, assinatura, pagamentos). */
export const getBillingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ organizationId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const [org, subscription, customer, payments] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, billing_exempt")
        .eq("id", data.organizationId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("*, plans:plan_id (*)")
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      supabase
        .from("billing_customers")
        .select("*")
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      supabase
        .from("billing_payments")
        .select("*")
        .eq("organization_id", data.organizationId)
        .order("billed_at", { ascending: false })
        .limit(50),
    ]);

    // RLS já isola por organização; ausência de linha = sem acesso ou sem dados.
    return {
      organization: org.data ?? null,
      subscription: subscription.data ?? null,
      customer: customer.data ?? null,
      payments: payments.data ?? [],
      gatewayConfigured: !!process.env["PADDLE_API_KEY"],
      environment: process.env["PADDLE_ENVIRONMENT"] === "production" ? "production" : "sandbox",
    };
  });

/**
 * Abre um checkout. Retorna o `transactionId` do gateway para o Paddle.js.
 * NÃO altera a assinatura — a confirmação vem exclusivamente pelo webhook.
 */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      planId: z.string().uuid(),
      interval: z.enum(["monthly", "yearly"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId as string;

    if (!(await isManager(supabase, userId, data.organizationId))) {
      return { ok: false as const, error: "forbidden" };
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, billing_exempt")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!org) return { ok: false as const, error: "forbidden" };
    if (org.billing_exempt) return { ok: false as const, error: "organization_exempt" };

    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", data.planId)
      .is("archived_at", null)
      .maybeSingle();
    if (!plan) return { ok: false as const, error: "plan_not_found" };

    const priceId =
      data.interval === "yearly" ? plan.gateway_price_id_yearly : plan.gateway_price_id_monthly;
    if (!priceId) return { ok: false as const, error: "price_not_configured" };

    const { requirePaddleConfig, createPaddleCustomer, createPaddleCheckoutTransaction, BillingError } =
      await import("./billing.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    try {
      const config = requirePaddleConfig();

      // Identidade do cliente no gateway (nunca o e-mail como chave única).
      let { data: customer } = await supabaseAdmin
        .from("billing_customers")
        .select("*")
        .eq("organization_id", data.organizationId)
        .maybeSingle();

      if (!customer) {
        const email = (context.claims as any)?.email as string | undefined;
        if (!email) return { ok: false as const, error: "gateway_unavailable" };
        const created = await createPaddleCustomer(config, {
          email,
          name: org.name,
          organizationId: org.id,
        });
        const inserted = await supabaseAdmin
          .from("billing_customers")
          .insert({
            organization_id: org.id,
            gateway: "paddle",
            gateway_customer_id: created.id,
            email: created.email,
            name: org.name,
            environment: config.environment,
          })
          .select("*")
          .single();
        customer = inserted.data;
      }

      const transaction = await createPaddleCheckoutTransaction(config, {
        priceId,
        customerId: customer!.gateway_customer_id,
        organizationId: org.id,
        planId: plan.id,
        interval: data.interval,
      });

      // Guardamos apenas a intenção de checkout. Nada de status pago aqui.
      await supabaseAdmin
        .from("subscriptions")
        .update({
          gateway: "paddle",
          gateway_customer_id: customer!.gateway_customer_id,
          gateway_checkout_url: transaction.checkoutUrl,
          external_reference: transaction.id,
        })
        .eq("organization_id", org.id);

      return {
        ok: true as const,
        transactionId: transaction.id,
        checkoutUrl: transaction.checkoutUrl,
        environment: config.environment,
      };
    } catch (error) {
      const code = error instanceof BillingError ? error.code : "gateway_unavailable";
      if (!(error instanceof BillingError)) console.error("[billing] createCheckout", error);
      return { ok: false as const, error: code };
    }
  });

/** Cancelamento (imediato ou no fim do período). O status real vem do webhook. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      mode: z.enum(["immediately", "next_billing_period"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!(await isManager(supabase, context.userId as string, data.organizationId))) {
      return { ok: false as const, error: "forbidden" };
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, gateway_subscription_id")
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (!sub?.gateway_subscription_id) return { ok: false as const, error: "subscription_not_found" };

    const { requirePaddleConfig, cancelPaddleSubscription, BillingError } = await import(
      "./billing.server"
    );
    try {
      const config = requirePaddleConfig();
      const result = await cancelPaddleSubscription(config, sub.gateway_subscription_id, data.mode);
      return { ok: true as const, scheduledAt: result.scheduled_change?.effective_at ?? null };
    } catch (error) {
      const code = error instanceof BillingError ? error.code : "gateway_unavailable";
      if (!(error instanceof BillingError)) console.error("[billing] cancelSubscription", error);
      return { ok: false as const, error: code };
    }
  });

/** Upgrade/downgrade. A prorrata é a oficial do gateway — o GBS não calcula. */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      organizationId: z.string().uuid(),
      planId: z.string().uuid(),
      interval: z.enum(["monthly", "yearly"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!(await isManager(supabase, context.userId as string, data.organizationId))) {
      return { ok: false as const, error: "forbidden" };
    }

    const [{ data: sub }, { data: plan }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id, gateway_subscription_id, plan_id")
        .eq("organization_id", data.organizationId)
        .maybeSingle(),
      supabase.from("plans").select("*").eq("id", data.planId).is("archived_at", null).maybeSingle(),
    ]);

    if (!plan) return { ok: false as const, error: "plan_not_found" };
    if (!sub?.gateway_subscription_id) return { ok: false as const, error: "subscription_not_found" };

    const priceId =
      data.interval === "yearly" ? plan.gateway_price_id_yearly : plan.gateway_price_id_monthly;
    if (!priceId) return { ok: false as const, error: "price_not_configured" };

    const { requirePaddleConfig, changePaddleSubscriptionPrice, BillingError } = await import(
      "./billing.server"
    );
    try {
      const config = requirePaddleConfig();
      await changePaddleSubscriptionPrice(
        config,
        sub.gateway_subscription_id,
        priceId,
        "prorated_immediately",
      );
      return { ok: true as const };
    } catch (error) {
      const code = error instanceof BillingError ? error.code : "gateway_unavailable";
      if (!(error instanceof BillingError)) console.error("[billing] changePlan", error);
      return { ok: false as const, error: code };
    }
  });
