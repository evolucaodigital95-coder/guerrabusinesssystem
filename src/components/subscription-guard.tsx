import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlans, useSubscriptionAccess } from "@/hooks/use-platform";
import { FEATURE_LABEL, planAllowsFeature, type FeatureKey } from "@/lib/platform";
import { cn } from "@/lib/utils";

/**
 * SUBSCRIPTION ACCESS GUARD
 *
 * Camada central de verificação de acesso comercial:
 *   organização -> membership -> permissões (matriz de papéis)
 *   -> status da assinatura -> plano -> recursos -> limites
 *
 * NÃO substitui o RLS. O RLS continua sendo a segurança dos dados;
 * esta camada é experiência de produto e bloqueio gradual.
 */

/** Aviso discreto de trial / vencimento. */
export function SubscriptionBanner() {
  const { warning, status, loading } = useSubscriptionAccess();
  if (loading || !warning) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b px-6 py-2 text-xs md:px-10",
        status === "past_due"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{warning}</span>
      <Link to="/app/planos" className="font-medium text-foreground underline underline-offset-4">
        Ver planos
      </Link>
    </div>
  );
}

/** Bloqueia a operação quando a assinatura expirou/cancelou. Nenhum dado é apagado. */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { blocked, status, loading } = useSubscriptionAccess();

  if (loading || !blocked) return <>{children}</>;

  const message =
    status === "canceled"
      ? "Sua assinatura foi cancelada. Seus dados continuam guardados com segurança."
      : status === "suspended"
        ? "Sua assinatura está suspensa. Seus dados continuam guardados com segurança."
        : "Seu acesso precisa ser renovado. Seus dados continuam guardados com segurança.";

  return (
    <div className="mx-auto grid max-w-lg place-items-center gap-5 py-24 text-center">
      <ShieldAlert className="h-9 w-9 text-muted-foreground" />
      <div>
        <h1 className="font-display text-3xl">Seu acesso precisa ser renovado.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button asChild variant="brand">
        <Link to="/app/planos">Ver planos</Link>
      </Button>
    </div>
  );
}

/**
 * Bloqueio gradual por recurso do plano.
 * Nesta fase os planos liberam tudo por padrão — a estrutura fica pronta.
 */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { plan, loading } = useSubscriptionAccess();
  const plans = usePlans();
  if (loading || planAllowsFeature(plan, feature)) return <>{children}</>;
  const target = (plans.data ?? []).find(
    (p) =>
      p.is_active !== false &&
      p.display_order > (plan?.display_order ?? -1) &&
      planAllowsFeature(p, feature),
  );

  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 py-20 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <div>
        <h1 className="text-lg font-medium text-foreground">
          {FEATURE_LABEL[feature]} não está no seu plano
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {target
            ? `Recurso disponível no plano ${target.name}.`
            : "Este recurso está disponível em outro plano do GBS."}
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/app/planos">Conhecer planos</Link>
      </Button>
    </div>
  );
}
