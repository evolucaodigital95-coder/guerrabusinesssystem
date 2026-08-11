import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, PartyPopper, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { useOrgMembers } from "@/hooks/use-org-members";
import { ItemFormDialog } from "@/components/estoque/item-form-dialog";
import { RequirePermission } from "@/components/require-permission";
import {
  useCancelInvite,
  useCompleteStep,
  useInviteMember,
  useOnboarding,
  useOrgInvites,
  useOrgSettings,
  useUpdateOrgSettings,
} from "@/hooks/use-onboarding";
import {
  ONBOARDING_STEPS,
  OPERATION_TYPES,
  OPERATIONAL_MODULES,
  OPTIONAL_STEPS,
  PAYMENT_METHODS,
  type OnboardingStepKey,
} from "@/lib/onboarding";
import { ROLE_LABEL, type OrgRole } from "@/lib/permissions";

export const Route = createFileRoute("/app/onboarding")({
  head: () => ({
    meta: [
      { title: "Bem-vindo ao GBS — Configuração inicial" },
      {
        name: "description",
        content:
          "Configure sua organização no GBS em poucos passos: empresa, identidade, produtos, regras financeiras, equipe e módulos.",
      },
      { property: "og:title", content: "Bem-vindo ao GBS — Configuração inicial" },
      {
        property: "og:description",
        content: "Deixe seu ambiente GBS pronto para uso em seis etapas guiadas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequirePermission permission="settings">
      <OnboardingPage />
    </RequirePermission>
  ),
});

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-[13px]">
        {label}
        {optional && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            opcional
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const { organizationId, organizationName } = useCurrentOrg();
  const { user } = useSession();
  const onboarding = useOnboarding();
  const settingsQ = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();
  const completeStep = useCompleteStep();

  const [step, setStep] = useState(1);
  const [finished, setFinished] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  // Hidrata o formulário com o que já foi salvo (nunca perder o preenchido).
  useEffect(() => {
    if (settingsQ.data) setForm((f) => ({ ...settingsQ.data, ...f }));
  }, [settingsQ.data]);

  useEffect(() => {
    if (onboarding.data?.current_step) setStep(Math.min(onboarding.data.current_step, 6));
    if (onboarding.data?.status === "completed") setFinished(true);
  }, [onboarding.data]);

  const completed = onboarding.data?.completed_steps ?? [];
  const progress = onboarding.data?.progress_percent ?? 0;
  const current = ONBOARDING_STEPS[step - 1];
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function persist(stepKey?: OnboardingStepKey, patch?: Record<string, unknown>) {
    if (patch && Object.keys(patch).length) await updateSettings.mutateAsync(patch);
    await completeStep.mutateAsync({ step: stepKey, goTo: Math.min(step + 1, 6) });
  }

  async function handleNext(patch?: Record<string, unknown>) {
    try {
      await persist(current.key, patch);
      if (step === 6) {
        await completeStep.mutateAsync({ finish: true });
        setFinished(true);
      } else {
        setStep(step + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  async function handleSkip() {
    await completeStep.mutateAsync({ goTo: Math.min(step + 1, 6) });
    if (step === 6) setFinished(true);
    else setStep(step + 1);
  }

  async function handleSaveLater(patch?: Record<string, unknown>) {
    try {
      if (patch && Object.keys(patch).length) await updateSettings.mutateAsync(patch);
      toast.success("Progresso salvo. Você pode continuar depois.");
      navigate({ to: "/app/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  if (!organizationId) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Nenhuma organização ativa.
      </div>
    );
  }

  if (finished) {
    return (
      <FinishScreen
        form={form}
        progress={progress}
        onEnter={() => navigate({ to: "/app/dashboard" })}
      />
    );
  }

  const busy = updateSettings.isPending || completeStep.isPending;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <section className="mb-10">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          Configuração inicial
        </div>
        <h1 className="mt-6 font-display text-4xl leading-[1.05]">Bem-vindo ao GBS</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Vamos configurar o ambiente de{" "}
          <strong className="text-foreground">{organizationName}</strong> em poucos passos.
        </p>
      </section>

      <div className="mb-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">
            Etapa {step} de {ONBOARDING_STEPS.length} — {current.label}
          </span>
          <span className="text-muted-foreground">{progress}% concluído</span>
        </div>
        <Progress value={progress} className="mt-3 h-1.5" />
        <div className="mt-4 flex flex-wrap gap-2">
          {ONBOARDING_STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i + 1)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] transition-colors ${
                i + 1 === step
                  ? "border-foreground/30 bg-muted font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/20"
              }`}
            >
              {completed.includes(s.key) && <Check className="h-3 w-3 text-emerald-600" />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-8">
        <h2 className="font-display text-2xl">{current.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>

        <div className="mt-8 space-y-6">
          {step === 1 && <StepEmpresa form={form} set={set} />}
          {step === 2 && <StepIdentidade form={form} set={set} />}
          {step === 3 && <StepProdutos organizationId={organizationId} userId={user?.id ?? ""} />}
          {step === 4 && <StepFinanceiro form={form} set={set} />}
          {step === 5 && <StepEquipe />}
          {step === 6 && <StepOperacional form={form} set={set} />}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 1 || busy}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => handleSaveLater(pickPatch(step, form))}
            >
              Salvar e continuar depois
            </Button>
            {OPTIONAL_STEPS.includes(current.key) && (
              <Button variant="outline" size="sm" disabled={busy} onClick={handleSkip}>
                Pular etapa
              </Button>
            )}
            <Button size="sm" disabled={busy} onClick={() => handleNext(pickPatch(step, form))}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {step === 6 ? "Concluir" : "Continuar"}
              {step < 6 && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pickPatch(step: number, f: Record<string, unknown>): Record<string, unknown> {
  const pick = (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));
  if (step === 1)
    return pick([
      "legal_name",
      "trade_name",
      "owner_name",
      "phone",
      "email",
      "city",
      "state",
      "website",
      "description",
      "operation_type",
    ]);
  if (step === 2)
    return pick([
      "logo_url",
      "display_name",
      "primary_color",
      "secondary_color",
      "brand_image_url",
    ]);
  if (step === 4)
    return pick([
      "payment_methods",
      "default_card_fee_percent",
      "max_installments",
      "speaker_share",
      "agent_share",
      "tithe_percent",
      "finance_notes",
    ]);
  if (step === 6) return pick(["enabled_modules"]);
  return {};
}

/* ---------------------------------- Etapas --------------------------------- */

type StepProps = { form: Record<string, any>; set: (k: string, v: unknown) => void }; // eslint-disable-line @typescript-eslint/no-explicit-any

function StepEmpresa({ form, set }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Nome da empresa">
        <Input
          value={form.legal_name ?? ""}
          onChange={(e) => set("legal_name", e.target.value)}
          placeholder="Razão social"
        />
      </Field>
      <Field label="Nome comercial" optional>
        <Input value={form.trade_name ?? ""} onChange={(e) => set("trade_name", e.target.value)} />
      </Field>
      <Field label="Nome do responsável">
        <Input value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} />
      </Field>
      <Field label="Telefone" optional>
        <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="E-mail" optional>
        <Input
          type="email"
          value={form.email ?? ""}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <Field label="Site" optional>
        <Input
          value={form.website ?? ""}
          onChange={(e) => set("website", e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Cidade" optional>
        <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="Estado" optional>
        <Input
          value={form.state ?? ""}
          onChange={(e) => set("state", e.target.value)}
          maxLength={40}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descrição da empresa" optional>
          <Textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Tipo de operação">
          <Select value={form.operation_type ?? ""} onValueChange={(v) => set("operation_type", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {OPERATION_TYPES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function StepIdentidade({ form, set }: StepProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Nome exibido">
        <Input
          value={form.display_name ?? ""}
          onChange={(e) => set("display_name", e.target.value)}
        />
      </Field>
      <Field label="URL do logo" optional>
        <Input
          value={form.logo_url ?? ""}
          onChange={(e) => set("logo_url", e.target.value)}
          placeholder="https://"
        />
      </Field>
      <Field label="Cor principal" optional>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
            value={form.primary_color ?? "#0b1d3a"}
            onChange={(e) => set("primary_color", e.target.value)}
          />
          <Input
            value={form.primary_color ?? ""}
            onChange={(e) => set("primary_color", e.target.value)}
            placeholder="#0B1D3A"
          />
        </div>
      </Field>
      <Field label="Cor secundária" optional>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
            value={form.secondary_color ?? "#c9a227"}
            onChange={(e) => set("secondary_color", e.target.value)}
          />
          <Input
            value={form.secondary_color ?? ""}
            onChange={(e) => set("secondary_color", e.target.value)}
            placeholder="#C9A227"
          />
        </div>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Imagem de marca" optional>
          <Input
            value={form.brand_image_url ?? ""}
            onChange={(e) => set("brand_image_url", e.target.value)}
            placeholder="https://"
          />
        </Field>
      </div>
      {(form.logo_url || form.brand_image_url) && (
        <div className="sm:col-span-2 flex items-center gap-4 rounded-2xl border border-border bg-muted/40 p-4">
          {form.logo_url && (
            <img
              src={form.logo_url}
              alt="Prévia do logo da organização"
              className="h-12 w-auto object-contain"
            />
          )}
          <span className="text-sm text-muted-foreground">
            Prévia da identidade — usada em dashboard, PDFs e relatórios.
          </span>
        </div>
      )}
    </div>
  );
}

function StepProdutos({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const items = useQuery({
    queryKey: ["stock-items", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, category, sku, purchase_price, status")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Cadastre os produtos e materiais que sua organização utiliza. Os preços ficam salvos apenas
        nesta organização.
      </p>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar produto
      </Button>
      <div className="divide-y divide-border rounded-2xl border border-border">
        {items.isLoading && <div className="p-4 text-sm text-muted-foreground">Carregando…</div>}
        {!items.isLoading && (items.data?.length ?? 0) === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</div>
        )}
        {items.data?.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium">{i.name}</div>
              <div className="text-xs text-muted-foreground">
                {[i.category, i.sku].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <Badge variant="outline">{i.status ?? "ativo"}</Badge>
          </div>
        ))}
      </div>
      {open && (
        <ItemFormDialog
          open={open}
          onOpenChange={setOpen}
          organizationId={organizationId}
          userId={userId}
        />
      )}
    </div>
  );
}

function StepFinanceiro({ form, set }: StepProps) {
  const methods: string[] = Array.isArray(form.payment_methods) ? form.payment_methods : [];
  const toggle = (v: string) =>
    set("payment_methods", methods.includes(v) ? methods.filter((m) => m !== v) : [...methods, v]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Estas regras valem <strong className="text-foreground">apenas para esta organização</strong>
        . Se algum campo ficar em branco, o GBS usa os valores padrão do sistema.
      </div>

      <Field label="Formas de pagamento aceitas">
        <div className="grid gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.value}
              className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
            >
              <Checkbox
                checked={methods.includes(m.value)}
                onCheckedChange={() => toggle(m.value)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Taxa de cartão padrão (%)" optional>
          <Input
            type="number"
            step="0.01"
            value={form.default_card_fee_percent ?? ""}
            onChange={(e) => set("default_card_fee_percent", Number(e.target.value))}
          />
        </Field>
        <Field label="Parcelamento máximo" optional>
          <Input
            type="number"
            value={form.max_installments ?? ""}
            onChange={(e) => set("max_installments", Number(e.target.value))}
          />
        </Field>
        <Field label="Comissão do palestrante (%)">
          <Input
            type="number"
            step="0.01"
            value={form.speaker_share ?? ""}
            onChange={(e) => set("speaker_share", Number(e.target.value))}
          />
        </Field>
        <Field label="Comissão do agendista (%)">
          <Input
            type="number"
            step="0.01"
            value={form.agent_share ?? ""}
            onChange={(e) => set("agent_share", Number(e.target.value))}
          />
        </Field>
        <Field label="Dízimo (%) — informativo" optional>
          <Input
            type="number"
            step="0.01"
            value={form.tithe_percent ?? ""}
            onChange={(e) => set("tithe_percent", Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Observações sobre as regras" optional>
        <Textarea
          rows={3}
          value={form.finance_notes ?? ""}
          onChange={(e) => set("finance_notes", e.target.value)}
        />
      </Field>
    </div>
  );
}

function StepEquipe() {
  const { organizationId, can } = useCurrentOrg();
  const members = useOrgMembers(organizationId);
  const invites = useOrgInvites();
  const invite = useInviteMember();
  const cancel = useCancelInvite();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const canManage = can("members.manage");

  async function submit() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    try {
      await invite.mutateAsync({ email: value, role });
      setEmail("");
      toast.success("Convite registrado para esta organização.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível convidar.");
    }
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="E-mail">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
                maxLength={255}
              />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Papel">
              <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["owner", "admin", "member", "viewer"] as OrgRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button size="sm" onClick={submit} disabled={invite.isPending}>
            {invite.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-1 h-4 w-4" />
            )}
            Convidar
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seu papel não permite gerenciar a equipe desta organização.
        </p>
      )}

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Membros ativos
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {(members.data ?? []).map((m) => (
            <div key={m.user_id} className="flex items-center justify-between p-4 text-sm">
              <span className="truncate">{m.full_name ?? m.email ?? "Membro"}</span>
              <Badge variant="outline">ativo</Badge>
            </div>
          ))}
          {(members.data?.length ?? 0) === 0 && (
            <div className="p-4 text-sm text-muted-foreground">—</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Convites pendentes
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border">
          {(invites.data ?? [])
            .filter((i) => i.status === "pending")
            .map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <span className="min-w-0 truncate">{i.email}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ROLE_LABEL[i.role as OrgRole] ?? i.role}</Badge>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => cancel.mutate(i.id)}
                      aria-label="Cancelar convite"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          {(invites.data ?? []).filter((i) => i.status === "pending").length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhum convite pendente.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepOperacional({ form, set }: StepProps) {
  const selected: string[] = Array.isArray(form.enabled_modules) ? form.enabled_modules : [];
  const toggle = (v: string) =>
    set(
      "enabled_modules",
      selected.includes(v) ? selected.filter((m) => m !== v) : [...selected, v],
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione os recursos que sua organização utiliza. Nada é removido do sistema — usamos isso
        apenas para destacar o que importa para você.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPERATIONAL_MODULES.map((m) => (
          <label
            key={m.value}
            className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
          >
            <Checkbox
              checked={selected.includes(m.value)}
              onCheckedChange={() => toggle(m.value)}
            />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function FinishScreen({
  form,
  progress,
  onEnter,
}: {
  form: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  progress: number;
  onEnter: () => void;
}) {
  const { organizationId } = useCurrentOrg();
  const members = useOrgMembers(organizationId);
  const invites = useOrgInvites();
  const products = useQuery({
    queryKey: ["stock-items-count", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("stock_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId!)
        .is("archived_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const resumo = useMemo(
    () => [
      { label: "Empresa", value: form.legal_name || form.display_name || "—" },
      {
        label: "Equipe",
        value: `${members.data?.length ?? 0} membros · ${(invites.data ?? []).filter((i) => i.status === "pending").length} convites`,
      },
      { label: "Produtos", value: `${products.data ?? 0} cadastrados` },
      {
        label: "Regras financeiras",
        value: `${form.speaker_share ?? 50}/${form.agent_share ?? 50} · dízimo ${form.tithe_percent ?? 10}%`,
      },
      {
        label: "Módulos configurados",
        value: `${(form.enabled_modules ?? []).length} selecionados`,
      },
      { label: "Logo", value: form.logo_url ? "Configurado" : "Não informado" },
    ],
    [form, members.data, invites.data, products.data],
  );

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div
        className="rounded-3xl p-10"
        style={{ background: "var(--navy)", color: "var(--navy-foreground)" }}
      >
        <PartyPopper className="h-8 w-8" style={{ color: "var(--gold)" }} />
        <h1 className="mt-6 font-display text-4xl">Seu GBS está pronto.</h1>
        <p className="mt-3 text-[var(--navy-foreground)]/80">
          Configuração concluída em {progress}%.
        </p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {resumo.map((r) => (
          <div key={r.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {r.label}
            </div>
            <div className="mt-2 text-sm font-medium">{r.value}</div>
          </div>
        ))}
      </div>
      <Button className="mt-8 w-full sm:w-auto" onClick={onEnter}>
        Entrar no GBS
      </Button>
    </div>
  );
}
