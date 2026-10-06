import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCommercialState, usePlans, usePlatformMutations } from "@/hooks/use-platform";
import { UsageMeters } from "@/components/platform/usage-meters";
import {
  LIMIT_LABEL,
  USAGE_KEYS,
  money,
  shortDate,
  SUBSCRIPTION_STATUS_LABEL,
  type LimitKey,
  type PlanLimits,
} from "@/lib/platform";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function errMsg(e: unknown) {
  return (e as Error)?.message ?? "Não foi possível concluir a operação.";
}

/** Painel comercial do GBS Admin. Tudo passa por funções protegidas no banco. */
export function AdminSubscriptionPanel({ organizationId }: { organizationId: string }) {
  const state = useCommercialState(organizationId);
  const { data: plans } = usePlans();
  const { changePlan, setTrial, setSubscriptionStatus, setLimits } = usePlatformMutations();

  const [planId, setPlanId] = useState("");
  const [apply, setApply] = useState<"now" | "scheduled">("now");
  const [period, setPeriod] = useState("");
  const [trialDays, setTrialDays] = useState("14");
  const [reason, setReason] = useState("");
  const [cancelAt, setCancelAt] = useState("");
  const [limitsDraft, setLimitsDraft] = useState<Record<string, string> | null>(null);

  if (state.isLoading) return <div className="py-10 text-sm text-muted-foreground">Carregando…</div>;
  if (state.error || !state.data) return <div className="py-10 text-sm text-muted-foreground">Não foi possível carregar a assinatura.</div>;
  const s = state.data;
  const sub = s.subscription;
  if (!sub) return <div className="py-10 text-sm text-muted-foreground">Esta organização ainda não possui assinatura.</div>;

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
      state.refetch();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const overrides = (sub.limit_overrides ?? {}) as PlanLimits;
  const draft =
    limitsDraft ??
    Object.fromEntries(USAGE_KEYS.map((k) => [k, k in overrides ? String(overrides[k] ?? "") : ""]));

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3 lg:grid-cols-6">
        <Info label="Plano" value={s.plan?.name ?? "—"} />
        <Info label="Status efetivo" value={SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status} />
        <Info label="Valor" value={money(sub.contracted_price ?? null)} />
        <Info label="Início" value={shortDate(sub.started_at)} />
        <Info label="Trial até" value={shortDate(sub.trial_ends_at)} />
        <Info label="Renovação" value={shortDate(sub.next_renewal_at)} />
        {s.pending_plan && (
          <div className="sm:col-span-3 lg:col-span-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            Downgrade agendado para <b>{s.pending_plan.name}</b> em {shortDate(sub.pending_change_at)}.
          </div>
        )}
        {sub.cancel_effective_at && (
          <div className="sm:col-span-3 lg:col-span-6 text-xs text-muted-foreground">
            Cancelamento com data efetiva em {shortDate(sub.cancel_effective_at)}
            {sub.cancel_reason ? ` · Motivo: ${sub.cancel_reason}` : ""}
          </div>
        )}
        {s.billing_exempt && (
          <div className="sm:col-span-3 lg:col-span-6 text-xs text-muted-foreground">
            Organização isenta: limites e bloqueios comerciais não se aplicam.
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid gap-3 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display text-lg">Alterar plano</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select value={planId || sub.plan_id || ""} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent>
                {(plans ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.is_active === false ? " (inativo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period || sub.period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={apply} onValueChange={(v) => setApply(v as "now" | "scheduled")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Aplicar agora</SelectItem>
                <SelectItem value="scheduled">Na renovação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Downgrade nunca apaga dados: o que passar do novo limite fica preservado e só novos cadastros são bloqueados.
          </p>
          <Button
            variant="navy"
            disabled={changePlan.isPending || !(planId || sub.plan_id)}
            onClick={() =>
              run(
                changePlan.mutateAsync({ organizationId, planId: planId || sub.plan_id!, apply, period: period || sub.period }),
                apply === "now" ? "Plano alterado." : "Troca de plano agendada.",
              )
            }
          >
            Salvar plano
          </Button>
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display text-lg">Trial</h3>
          <div className="grid gap-2 sm:grid-cols-[120px_1fr_1fr]">
            <Input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
            <Button variant="outline" disabled={setTrial.isPending}
              onClick={() => run(setTrial.mutateAsync({ organizationId, days: Number(trialDays), restart: false }), "Trial estendido.")}>
              Estender trial
            </Button>
            <Button variant="outline" disabled={setTrial.isPending}
              onClick={() => run(setTrial.mutateAsync({ organizationId, days: Number(trialDays), restart: true }), "Trial iniciado.")}>
              Iniciar novo trial
            </Button>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="font-display text-lg">Status da assinatura</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (registrado na auditoria)" />
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cancelar em (opcional)</Label>
              <Input type="date" value={cancelAt} onChange={(e) => setCancelAt(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" disabled={setSubscriptionStatus.isPending}
              onClick={() => run(setSubscriptionStatus.mutateAsync({ organizationId, status: "active", reason: reason || null }), "Assinatura ativa.")}>
              Ativar / reativar
            </Button>
            <Button variant="outline" disabled={setSubscriptionStatus.isPending}
              onClick={() => run(setSubscriptionStatus.mutateAsync({ organizationId, status: "past_due", reason: reason || null }), "Marcada como inadimplente.")}>
              Inadimplente
            </Button>
            <Button variant="outline" disabled={setSubscriptionStatus.isPending}
              onClick={() => run(setSubscriptionStatus.mutateAsync({ organizationId, status: "suspended", reason: reason || null }), "Assinatura suspensa.")}>
              Suspender
            </Button>
            <Button variant="outline" disabled={setSubscriptionStatus.isPending}
              onClick={() =>
                run(
                  setSubscriptionStatus.mutateAsync({
                    organizationId,
                    status: "canceled",
                    reason: reason || null,
                    effectiveAt: cancelAt ? new Date(`${cancelAt}T23:59:59`).toISOString() : null,
                  }),
                  cancelAt ? "Cancelamento agendado." : "Assinatura cancelada. Nenhum dado foi apagado.",
                )
              }>
              Cancelar
            </Button>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="font-display text-lg">Limites desta organização</h3>
          <p className="text-xs text-muted-foreground">
            Deixe em branco para usar o limite do plano. Use 0 para bloquear. Valores aqui substituem os do plano só para esta organização.
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {USAGE_KEYS.map((k) => (
              <div key={k} className="grid gap-1">
                <Label className="text-xs">{LIMIT_LABEL[k]}</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft[k] ?? ""}
                  placeholder={s.plan?.limits?.[k] == null ? "Plano: ilimitado" : `Plano: ${s.plan?.limits?.[k]}`}
                  onChange={(e) => setLimitsDraft({ ...draft, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div>
            <Button
              variant="navy"
              disabled={setLimits.isPending || !limitsDraft}
              onClick={() => {
                const next: PlanLimits = {};
                for (const k of USAGE_KEYS) {
                  const v = (draft[k] ?? "").trim();
                  if (v !== "") next[k as LimitKey] = Number(v);
                }
                run(setLimits.mutateAsync({ organizationId, overrides: next }), "Limites atualizados.").then(() => setLimitsDraft(null));
              }}
            >
              Salvar limites
            </Button>
          </div>
        </section>
      </div>

      <section>
        <h3 className="mb-3 font-display text-lg">Consumo</h3>
        <UsageMeters state={s} />
      </section>
    </div>
  );
}
