import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { usePlans } from "@/hooks/use-platform";
import {
  FEATURE_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  money,
  shortDate,
  type FeatureKey,
  type SubscriptionStatus,
} from "@/lib/platform";
import { billingErrorMessage, formatCents, PAYMENT_STATUS_LABEL, type PaymentStatus } from "@/lib/billing";
import { cancelSubscription, createCheckout, getBillingOverview } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/planos")({
  head: () => ({
    meta: [
      { title: "Plano e cobrança — GBS" },
      {
        name: "description",
        content: "Plano atual, status da assinatura, próxima cobrança e histórico de pagamentos.",
      },
      { property: "og:title", content: "Plano e cobrança — GBS" },
      {
        property: "og:description",
        content: "Gerencie o plano da sua organização no Guerra Business System.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanosPage,
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function PlanosPage() {
  const { organizationId, can } = useCurrentOrg();
  const queryClient = useQueryClient();
  const plans = usePlans();
  const overviewFn = useServerFn(getBillingOverview);
  const checkoutFn = useServerFn(createCheckout);
  const cancelFn = useServerFn(cancelSubscription);

  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [cancelOpen, setCancelOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["billing", "overview", organizationId],
    enabled: !!organizationId,
    queryFn: () => overviewFn({ data: { organizationId: organizationId! } }),
  });

  const data = overview.data as any;
  const subscription = data?.subscription ?? null;
  const currentPlan = subscription?.plans ?? null;
  const exempt = data?.organization?.billing_exempt === true;
  const gatewayReady = data?.gatewayConfigured === true;

  const checkout = useMutation({
    mutationFn: async (planId: string) =>
      checkoutFn({ data: { organizationId: organizationId!, planId, interval } }),
    onSuccess: (result: any) => {
      if (!result?.ok) {
        toast.error(billingErrorMessage(result?.error));
        return;
      }
      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener");
        toast.info("Checkout aberto. A assinatura só é ativada após a confirmação do pagamento.");
      } else {
        toast.info("Checkout criado. Aguardando confirmação do pagamento.");
      }
    },
    onError: () => toast.error(billingErrorMessage("gateway_unavailable")),
  });

  const cancel = useMutation({
    mutationFn: async (mode: "immediately" | "next_billing_period") =>
      cancelFn({ data: { organizationId: organizationId!, mode } }),
    onSuccess: (result: any) => {
      if (!result?.ok) {
        toast.error(billingErrorMessage(result?.error));
        return;
      }
      toast.success("Cancelamento solicitado. O status será atualizado após a confirmação.");
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
  });

  const status: SubscriptionStatus = (subscription?.status ?? "active") as SubscriptionStatus;

  return (
    <>
      <PageHeader
        eyebrow="Assinatura"
        title="Plano e cobrança"
        description="Plano atual da organização, status da assinatura, próxima cobrança e histórico de pagamentos."
      />

      {/* ---------- Assinatura atual ---------- */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Plano atual
            </div>
            <div className="mt-2 font-display text-2xl">{currentPlan?.name ?? "—"}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className={cn(SUBSCRIPTION_STATUS_TONE[status])}>
                {SUBSCRIPTION_STATUS_LABEL[status]}
              </Badge>
              {subscription?.period === "yearly" ? <span>Anual</span> : <span>Mensal</span>}
              {exempt && <Badge variant="outline">Organização interna (isenta)</Badge>}
            </div>
          </div>
          <div className="grid gap-1 text-right text-xs text-muted-foreground">
            <div>
              Período atual:{" "}
              <span className="text-foreground">
                {shortDate(subscription?.current_period_start)} —{" "}
                {shortDate(subscription?.current_period_end)}
              </span>
            </div>
            <div>
              Próxima cobrança:{" "}
              <span className="text-foreground">{shortDate(subscription?.next_renewal_at)}</span>
            </div>
            {subscription?.trial_ends_at && (
              <div>
                Teste até:{" "}
                <span className="text-foreground">{shortDate(subscription.trial_ends_at)}</span>
              </div>
            )}
            {subscription?.cancel_at_period_end && (
              <div className="text-amber-600">Cancelamento agendado para o fim do período</div>
            )}
          </div>
        </div>

        {!gatewayReady && (
          <p className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            <ShieldCheck className="mr-2 inline h-3.5 w-3.5" />
            A cobrança está em modo de preparação: a estrutura já está pronta, mas as credenciais do
            gateway (ambiente de teste) ainda não foram configuradas na plataforma.
          </p>
        )}

        {subscription?.gateway_subscription_id && can("settings") && (
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
              Cancelar assinatura
            </Button>
          </div>
        )}
      </section>

      {/* ---------- Planos ---------- */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl">Planos disponíveis</h2>
          <div className="flex rounded-full border border-border p-1 text-xs">
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setInterval(option)}
                className={cn(
                  "rounded-full px-3 py-1",
                  interval === option ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {option === "monthly" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(plans.data ?? []).map((plan) => {
            const price = interval === "yearly" ? plan.price_yearly : plan.price_monthly;
            const isCurrent = currentPlan?.id === plan.id;
            const features = (Object.keys(plan.features ?? {}) as FeatureKey[]).filter(
              (key) => plan.features?.[key],
            );
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-6",
                  plan.highlight ? "border-foreground" : "border-border",
                )}
              >
                <div className="font-display text-xl">{plan.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{plan.description}</div>
                <div className="mt-4 font-display text-3xl">{money(price, plan.currency)}</div>
                <div className="text-[11px] text-muted-foreground">
                  por {interval === "yearly" ? "ano" : "mês"}
                </div>

                <ul className="mt-5 grid gap-1.5 text-xs text-muted-foreground">
                  {features.slice(0, 8).map((key) => (
                    <li key={key} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {FEATURE_LABEL[key]}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : (
                    <Button
                      variant="navy"
                      size="sm"
                      className="w-full"
                      disabled={
                        !can("settings") || exempt || checkout.isPending || !organizationId
                      }
                      onClick={() => checkout.mutate(plan.id)}
                    >
                      {checkout.isPending ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-3.5 w-3.5" />
                      )}
                      Assinar agora
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Pagamentos ---------- */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Histórico de pagamentos</h2>
        {(data?.payments ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum pagamento registrado ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Data</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-right">Valor</th>
                  <th className="py-2 text-left">Transação</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((payment: any) => (
                  <tr key={payment.id} className="border-t border-border/60">
                    <td className="py-2">{shortDate(payment.billed_at ?? payment.created_at)}</td>
                    <td className="py-2">
                      {PAYMENT_STATUS_LABEL[payment.status as PaymentStatus] ?? payment.status}
                    </td>
                    <td className="py-2 text-right">
                      {formatCents(payment.amount_cents, payment.currency)}
                    </td>
                    <td className="py-2 font-mono text-[11px] text-muted-foreground">
                      {payment.gateway_transaction_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancelar assinatura?"
        description="O acesso continua até o fim do período já contratado. Nenhum dado da organização é apagado."
        confirmLabel="Cancelar no fim do período"
        onConfirm={() => cancel.mutate("next_billing_period")}
      />
    </>
  );
}
