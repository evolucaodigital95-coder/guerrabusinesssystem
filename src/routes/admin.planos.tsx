import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { usePlans, usePlatformMutations } from "@/hooks/use-platform";
import {
  FEATURE_KEYS,
  FEATURE_LABEL,
  LIMIT_KEYS,
  LIMIT_LABEL,
  money,
  type Plan,
} from "@/lib/platform";

export const Route = createFileRoute("/admin/planos")({
  head: () => ({
    meta: [
      { title: "Planos — GBS Admin" },
      { name: "description", content: "Catálogo de planos, recursos e limites do GBS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPlanos,
});

type Draft = Partial<Plan> & { features: Plan["features"]; limits: Plan["limits"] };

const emptyDraft = (): Draft => ({
  code: "",
  name: "",
  description: "",
  price_monthly: 0,
  price_yearly: 0,
  trial_days: 14,
  display_order: 0,
  highlight: false,
  status: "active",
  features: {},
  limits: {},
});

function AdminPlanos() {
  const { data: plans, isLoading } = usePlans();
  const { savePlan, archivePlan } = usePlatformMutations();
  const [draft, setDraft] = useState<Draft | null>(null);

  async function handleSave() {
    if (!draft) return;
    if (!draft.name || !draft.code) {
      toast.error("Informe código e nome do plano.");
      return;
    }
    try {
      await savePlan.mutateAsync(draft as Partial<Plan> & { id?: string });
      toast.success("Plano salvo e registrado na auditoria.");
      setDraft(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Plataforma"
        title="Planos"
        description="Estrutura de planos, recursos e limites. Novos planos são criados aqui — sem alterar código."
        actions={
          <Button variant="brand" onClick={() => setDraft(emptyDraft())}>
            + Novo plano
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(plans ?? []).map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl">{p.name}</h3>
                {p.highlight && <Badge variant="outline">Destaque</Badge>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 text-sm">
                <div>{money(p.price_monthly)} /mês</div>
                <div className="text-muted-foreground">{money(p.price_yearly)} /ano</div>
                <div className="mt-1 text-xs text-muted-foreground">Trial: {p.trial_days} dias</div>
              </div>
              <ul className="mt-4 flex-1 space-y-1 text-xs text-muted-foreground">
                {FEATURE_KEYS.filter((f) => p.features?.[f]).map((f) => (
                  <li key={f}>• {FEATURE_LABEL[f]}</li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...p })}>
                  Editar
                </Button>
                <ConfirmDialog
                  title="Arquivar plano?"
                  description="O plano deixa de ser oferecido. Assinaturas existentes não são alteradas."
                  confirmLabel="Arquivar"
                  onConfirm={() => archivePlan.mutateAsync(p.id!)}
                  trigger={
                    <Button size="sm" variant="ghost">
                      Arquivar
                    </Button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Código</Label>
                <Input
                  value={draft.code ?? ""}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Preço mensal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.price_monthly ?? 0}
                  onChange={(e) => setDraft({ ...draft, price_monthly: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Preço anual</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.price_yearly ?? 0}
                  onChange={(e) => setDraft({ ...draft, price_yearly: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Dias de trial</Label>
                <Input
                  type="number"
                  value={draft.trial_days ?? 14}
                  onChange={(e) => setDraft({ ...draft, trial_days: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Ordem de exibição</Label>
                <Input
                  type="number"
                  value={draft.display_order ?? 0}
                  onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  checked={!!draft.highlight}
                  onCheckedChange={(v) => setDraft({ ...draft, highlight: v })}
                />
                <Label>Destaque</Label>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Recursos
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {FEATURE_KEYS.map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={!!draft.features?.[f]}
                        onCheckedChange={(v) =>
                          setDraft({ ...draft, features: { ...draft.features, [f]: v } })
                        }
                      />
                      {FEATURE_LABEL[f]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  Limites (vazio = ilimitado)
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {LIMIT_KEYS.map((l) => (
                    <div key={l} className="grid gap-1">
                      <Label className="text-xs">{LIMIT_LABEL[l]}</Label>
                      <Input
                        type="number"
                        value={draft.limits?.[l] ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            limits: {
                              ...draft.limits,
                              [l]: e.target.value === "" ? null : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleSave} disabled={savePlan.isPending}>
              {savePlan.isPending ? "Salvando…" : "Salvar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
