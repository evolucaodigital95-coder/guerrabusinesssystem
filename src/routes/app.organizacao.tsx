import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Circle, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/require-permission";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useOrgMembers } from "@/hooks/use-org-members";
import {
  useOrgInvites,
  useOrgSettings,
  useSetupChecklist,
  useUpdateOrgSettings,
} from "@/hooks/use-onboarding";
import { OPERATION_TYPES, OPERATIONAL_MODULES, PAYMENT_METHODS } from "@/lib/onboarding";
import { ROLE_LABEL, type OrgRole } from "@/lib/permissions";

export const Route = createFileRoute("/app/organizacao")({
  head: () => ({
    meta: [
      { title: "Configuração da organização — GBS" },
      {
        name: "description",
        content:
          "Perfil da empresa, identidade visual, produtos, regras financeiras, equipe e preferências da sua organização no GBS.",
      },
      { property: "og:title", content: "Configuração da organização — GBS" },
      {
        property: "og:description",
        content:
          "Gerencie perfil, identidade, produtos, financeiro, equipe e preferências por organização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequirePermission permission="settings">
      <OrganizacaoPage />
    </RequirePermission>
  ),
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function OrganizacaoPage() {
  const { organizationName, organizationId, can } = useCurrentOrg();
  const settingsQ = useOrgSettings();
  const update = useUpdateOrgSettings();
  const checklist = useSetupChecklist();
  const members = useOrgMembers(organizationId);
  const invites = useOrgInvites();

  const [f, setF] = useState<Record<string, any>>({});
  useEffect(() => {
    if (settingsQ.data) setF((prev) => ({ ...settingsQ.data, ...prev }));
  }, [settingsQ.data]);

  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const canEdit = can("settings");

  async function save(keys: string[]) {
    try {
      const patch = Object.fromEntries(
        keys.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]),
      );
      await update.mutateAsync(patch);
      toast.success("Configuração salva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const methods: string[] = Array.isArray(f.payment_methods) ? f.payment_methods : [];
  const modules: string[] = Array.isArray(f.enabled_modules) ? f.enabled_modules : [];

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <section className="mb-10">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          Configuração da organização
        </div>
        <h1 className="mt-6 flex items-center gap-4 font-display text-4xl leading-[1.05]">
          <Building2 className="h-9 w-9 text-muted-foreground" />
          {organizationName ?? "Organização"}
        </h1>
      </section>

      {/* Checklist */}
      <section className="mb-10 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Checklist de configuração</div>
            <div className="text-xs text-muted-foreground">{checklist.progress}% concluído</div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/onboarding">
              {checklist.isComplete ? "Revisar etapas" : "Continuar configuração"}
            </Link>
          </Button>
        </div>
        <Progress value={checklist.progress} className="mt-4 h-1.5" />
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {checklist.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              {i.done ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={i.done ? "" : "text-muted-foreground"}>{i.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Tabs defaultValue="perfil">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="perfil">Perfil da empresa</TabsTrigger>
          <TabsTrigger value="identidade">Identidade visual</TabsTrigger>
          <TabsTrigger value="produtos">Produtos e estoque</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="equipe">Equipe e permissões</TabsTrigger>
          <TabsTrigger value="preferencias">Preferências</TabsTrigger>
        </TabsList>

        <TabsContent
          value="perfil"
          className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["legal_name", "Nome da empresa"],
              ["trade_name", "Nome comercial"],
              ["owner_name", "Responsável"],
              ["phone", "Telefone"],
              ["email", "E-mail"],
              ["website", "Site"],
              ["city", "Cidade"],
              ["state", "Estado"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label className="text-[13px]">{label}</Label>
                <Input
                  value={f[k] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-[13px]">Descrição</Label>
              <Textarea
                rows={3}
                value={f.description ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">Tipo de operação</Label>
              <Select
                value={f.operation_type ?? ""}
                onValueChange={(v) => set("operation_type", v)}
                disabled={!canEdit}
              >
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
            </div>
          </div>
          <Button
            size="sm"
            disabled={!canEdit || update.isPending}
            onClick={() =>
              save([
                "legal_name",
                "trade_name",
                "owner_name",
                "phone",
                "email",
                "website",
                "city",
                "state",
                "description",
                "operation_type",
              ])
            }
          >
            Salvar perfil
          </Button>
        </TabsContent>

        <TabsContent
          value="identidade"
          className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px]">Nome exibido</Label>
              <Input
                value={f.display_name ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("display_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">URL do logo</Label>
              <Input
                value={f.logo_url ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("logo_url", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">Cor principal</Label>
              <Input
                value={f.primary_color ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("primary_color", e.target.value)}
                placeholder="#0B1D3A"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">Cor secundária</Label>
              <Input
                value={f.secondary_color ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("secondary_color", e.target.value)}
                placeholder="#C9A227"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label className="text-[13px]">Imagem de marca</Label>
              <Input
                value={f.brand_image_url ?? ""}
                disabled={!canEdit}
                onChange={(e) => set("brand_image_url", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Usada em dashboard, PDFs, extratos, relatórios, documentos e biblioteca desta
            organização.
          </p>
          <Button
            size="sm"
            disabled={!canEdit || update.isPending}
            onClick={() =>
              save([
                "display_name",
                "logo_url",
                "primary_color",
                "secondary_color",
                "brand_image_url",
              ])
            }
          >
            Salvar identidade
          </Button>
        </TabsContent>

        <TabsContent
          value="produtos"
          className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-6"
        >
          <p className="text-sm text-muted-foreground">
            Produtos, lotes e movimentações continuam no módulo de Estoque, sempre isolados por
            organização.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/app/estoque">Abrir Estoque</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/onboarding">Cadastrar produtos iniciais</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent
          value="financeiro"
          className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <Label className="text-[13px]">Formas de pagamento</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.map((m) => (
                <label
                  key={m.value}
                  className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <Checkbox
                    checked={methods.includes(m.value)}
                    disabled={!canEdit}
                    onCheckedChange={() =>
                      set(
                        "payment_methods",
                        methods.includes(m.value)
                          ? methods.filter((x) => x !== m.value)
                          : [...methods, m.value],
                      )
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {[
              ["default_card_fee_percent", "Taxa de cartão padrão (%)"],
              ["max_installments", "Parcelamento máximo"],
              ["speaker_share", "Comissão do palestrante (%)"],
              ["agent_share", "Comissão do agendista (%)"],
              ["tithe_percent", "Dízimo (%) — informativo"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-2">
                <Label className="text-[13px]">{label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={f[k] ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => set(k, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Observações</Label>
            <Textarea
              rows={3}
              value={f.finance_notes ?? ""}
              disabled={!canEdit}
              onChange={(e) => set("finance_notes", e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Regras válidas apenas para esta organização. Lançamentos e fechamentos já registrados
            não são recalculados.
          </p>
          <Button
            size="sm"
            disabled={!canEdit || update.isPending}
            onClick={() =>
              save([
                "payment_methods",
                "default_card_fee_percent",
                "max_installments",
                "speaker_share",
                "agent_share",
                "tithe_percent",
                "finance_notes",
              ])
            }
          >
            Salvar regras
          </Button>
        </TabsContent>

        <TabsContent
          value="equipe"
          className="mt-6 space-y-6 rounded-3xl border border-border bg-card p-6"
        >
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
              Convites
            </div>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {(invites.data ?? []).map((i) => (
                <div key={i.id} className="flex items-center justify-between p-4 text-sm">
                  <span className="truncate">{i.email}</span>
                  <Badge variant="outline">{ROLE_LABEL[i.role as OrgRole] ?? i.role}</Badge>
                </div>
              ))}
              {(invites.data?.length ?? 0) === 0 && (
                <div className="p-4 text-sm text-muted-foreground">Nenhum convite.</div>
              )}
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/onboarding">Convidar membros</Link>
          </Button>
        </TabsContent>

        <TabsContent
          value="preferencias"
          className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <Label className="text-[13px]">Módulos utilizados</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {OPERATIONAL_MODULES.map((m) => (
                <label
                  key={m.value}
                  className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"
                >
                  <Checkbox
                    checked={modules.includes(m.value)}
                    disabled={!canEdit}
                    onCheckedChange={() =>
                      set(
                        "enabled_modules",
                        modules.includes(m.value)
                          ? modules.filter((x) => x !== m.value)
                          : [...modules, m.value],
                      )
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Notificações, integrações e importação de dados (CSV/XLSX) serão acopladas a esta área
            nas próximas fases.
          </p>
          <Button
            size="sm"
            disabled={!canEdit || update.isPending}
            onClick={() => save(["enabled_modules"])}
          >
            Salvar preferências
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
