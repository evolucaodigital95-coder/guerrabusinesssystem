import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Minus, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { UsageMeters } from "@/components/platform/usage-meters";
import { useCommercialState, usePlans } from "@/hooks/use-platform";
import {
  FEATURE_LABEL,
  LIMIT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  USAGE_KEYS,
  daysUntil,
  money,
  planAllowsFeature,
  shortDate,
  usageLevel,
  type FeatureKey,
} from "@/lib/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/planos")({
  head: () => ({
    meta: [
      { title: "Minha assinatura — GBS" },
      {
        name: "description",
        content: "Plano atual, consumo, limites e comparação dos planos do GBS.",
      },
      { property: "og:title", content: "Minha assinatura — GBS" },
      {
        property: "og:description",
        content: "Veja seu plano, quanto está usando e o que cada plano do GBS oferece.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanosPage,
});

const COMPARE_FEATURES: FeatureKey[] = [
  "crm",
  "contatos",
  "palestras",
  "agendistas",
  "financeiro",
  "conta_corrente",
  "estoque",
  "campanhas",
  "temporadas",
  "projetos",
  "relatorios",
  "documentos",
  "arquivo_oficial",
  "dashboard_avancado",
  "exportacoes",
  "multi_usuarios",
];

function PlanosPage() {
  const state = useCommercialState();
  const plans = usePlans();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const s = state.data;
  const sub = s?.subscription ?? null;
  const plan = s?.plan ?? null;
  const visiblePlans = (plans.data ?? []).filter((p) => p.is_active !== false || p.id === plan?.id);
  const trialLeft = s?.status === "trial" ? daysUntil(sub?.trial_ends_at) : null;
  const near = s
    ? USAGE_KEYS.filter((k) => {
        const lim = s.limits?.[k];
        return usageLevel(Number(s.usage?.[k] ?? 0), lim == null ? null : Number(lim)) !== "normal";
      })
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Assinatura"
        title="Minha assinatura"
        description="Seu plano, quanto você está usando e o que cada plano oferece."
      />

      {state.isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : !s ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Não foi possível carregar a assinatura.
        </div>
      ) : (
        <>
          <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 lg:grid-cols-[1.2fr_2fr]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Plano atual
              </div>
              <div className="mt-2 font-display text-4xl">{plan?.name ?? "—"}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn(SUBSCRIPTION_STATUS_TONE[s.status])}>
                  {SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status}
                </Badge>
                {s.billing_exempt && <Badge variant="outline">Organização interna</Badge>}
              </div>
              {trialLeft !== null && (
                <p className="mt-4 text-sm">
                  <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
                  {trialLeft <= 0
                    ? "Seu período de teste termina hoje."
                    : `Faltam ${trialLeft} ${trialLeft === 1 ? "dia" : "dias"} de teste.`}
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Item label="Valor" value={money(sub?.contracted_price ?? null, plan?.currency)} />
              <Item label="Periodicidade" value={sub?.period === "yearly" ? "Anual" : "Mensal"} />
              <Item label="Início" value={shortDate(sub?.started_at)} />
              <Item label="Próxima renovação" value={shortDate(sub?.next_renewal_at)} />
              <Item label="Início do teste" value={shortDate(sub?.trial_started_at)} />
              <Item label="Fim do teste" value={shortDate(sub?.trial_ends_at)} />
            </dl>
            {s.pending_plan && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs lg:col-span-2">
                Troca para o plano <b>{s.pending_plan.name}</b> agendada para{" "}
                {shortDate(sub?.pending_change_at)}. Nenhum dado será apagado; acima dos novos limites
                apenas novos cadastros ficarão bloqueados.
              </p>
            )}
            {sub?.cancel_effective_at && (
              <p className="text-xs text-muted-foreground lg:col-span-2">
                Cancelamento com data efetiva em {shortDate(sub.cancel_effective_at)}. Seus dados
                continuam guardados.
              </p>
            )}
          </section>

          {near.length > 0 && !s.billing_exempt && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              Perto do limite: {near.map((k) => LIMIT_LABEL[k]).join(", ")}. Para continuar
              crescendo, fale com a equipe GBS sobre um upgrade.
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-4 font-display text-xl">Consumo</h2>
            <UsageMeters state={s} />
          </section>
        </>
      )}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Planos</h2>
            <p className="text-xs text-muted-foreground">
              Para mudar de plano, fale com a equipe GBS. A troca é feita sem perder nenhum dado.
            </p>
          </div>
          <div className="flex rounded-full border border-border p-1 text-xs">
            {(["monthly", "yearly"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setInterval(o)}
                className={cn(
                  "rounded-full px-3 py-1",
                  interval === o ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {o === "monthly" ? "Mensal" : "Anual"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-[10px] font-normal uppercase tracking-[0.2em] text-muted-foreground">
                  &nbsp;
                </th>
                {visiblePlans.map((p) => {
                  const price = interval === "yearly" ? p.price_yearly : p.price_monthly;
                  const current = p.id === plan?.id;
                  return (
                    <th
                      key={p.id}
                      className={cn("p-4 text-left align-top font-normal", current && "bg-muted/50")}
                    >
                      <div className="font-display text-lg">{p.name}</div>
                      <div className="mt-1 font-display text-2xl">
                        {price == null ? "Sob consulta" : money(price, p.currency)}
                      </div>
                      {price != null && (
                        <div className="text-[11px] text-muted-foreground">
                          por {interval === "yearly" ? "ano" : "mês"}
                        </div>
                      )}
                      {current && (
                        <Badge variant="outline" className="mt-2">
                          Seu plano
                        </Badge>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {USAGE_KEYS.map((k) => (
                <tr key={k} className="border-b border-border/60">
                  <td className="p-3 pl-4 text-muted-foreground">{LIMIT_LABEL[k]}</td>
                  {visiblePlans.map((p) => {
                    const v = p.limits?.[k];
                    return (
                      <td key={p.id} className={cn("p-3 tabular-nums", p.id === plan?.id && "bg-muted/50")}>
                        {v == null ? "Ilimitado" : v === 0 ? "—" : Number(v).toLocaleString("pt-BR")}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {COMPARE_FEATURES.map((f) => (
                <tr key={f} className="border-b border-border/60 last:border-0">
                  <td className="p-3 pl-4 text-muted-foreground">{FEATURE_LABEL[f]}</td>
                  {visiblePlans.map((p) => (
                    <td key={p.id} className={cn("p-3", p.id === plan?.id && "bg-muted/50")}>
                      {planAllowsFeature(p, f) ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
