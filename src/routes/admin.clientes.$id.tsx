import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminOrganization, usePlatformMutations } from "@/hooks/use-platform";
import { AdminSubscriptionPanel } from "@/components/platform/admin-subscription-panel";
import {
  dateTime,
  money,
  NOT_AVAILABLE,
  shortDate,
  SUBSCRIPTION_EVENT_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  type SubscriptionStatus,
} from "@/lib/platform";
import { ROLE_LABEL, type OrgRole } from "@/lib/permissions";
import { ORG_STATUS_LABEL } from "@/components/org-provider";

export const Route = createFileRoute("/admin/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Organização — GBS Admin" },
      { name: "description", content: "Detalhe administrativo da organização cliente." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminClienteDetail,
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm">{value}</div>
    </div>
  );
}

function AdminClienteDetail() {
  const { id } = Route.useParams();
  const { org, loading, settings, events, members, onboarding } = useAdminOrganization(id);
  const { setOrganizationStatus } = usePlatformMutations();
  const [orgReason, setOrgReason] = useState("");

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!org) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Organização não encontrada.{" "}
        <Link to="/admin/clientes" className="underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Cliente da plataforma"
        title={org.name}
        description="Administração da plataforma. A operação do cliente (empresas, palestras, financeiro) permanece dentro da organização dele."
        actions={
          <Badge variant="outline" className={SUBSCRIPTION_STATUS_TONE[org.status]}>
            {SUBSCRIPTION_STATUS_LABEL[org.status]}
          </Badge>
        }
      />

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="uso">Uso</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Responsável" value={org.ownerName ?? "—"} />
          <Field label="E-mail" value={org.ownerEmail ?? "—"} />
          <Field label="Criada em" value={shortDate(org.created_at)} />
          <Field label="Último acesso" value={<span className="text-muted-foreground">{NOT_AVAILABLE}</span>} />
          <Field label="Plano" value={org.plan?.name ?? "—"} />
          <Field
            label="Onboarding"
            value={onboarding ? `${onboarding.status} — ${onboarding.progress_percent ?? 0}%` : "—"}
          />
          <Field label="Nome fantasia" value={settings?.trade_name ?? settings?.display_name ?? "—"} />
          <Field label="Cidade / UF" value={[settings?.city, settings?.state].filter(Boolean).join(" / ") || "—"} />
          <Field label="Telefone" value={settings?.phone ?? "—"} />

          <div className="rounded-xl border border-border bg-card p-5 sm:col-span-2 lg:col-span-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Status da organização
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Organização suspensa ou cancelada continua podendo consultar e exportar os dados, mas
              não pode criar nem alterar registros. Nenhum dado é apagado.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant="outline">{ORG_STATUS_LABEL[org.orgStatus]}</Badge>
              {org.statusReason && (
                <span className="text-xs text-muted-foreground">Motivo: {org.statusReason}</span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={orgReason}
                onChange={(e) => setOrgReason(e.target.value)}
                placeholder="Motivo (registrado na auditoria)"
              />
              <div className="flex flex-wrap gap-2">
                {(["active", "suspended", "canceled"] as const)
                  .filter((s) => s !== org.orgStatus)
                  .map((s) => (
                    <Button
                      key={s}
                      variant={s === "active" ? "default" : "outline"}
                      disabled={setOrganizationStatus.isPending}
                      onClick={async () => {
                        try {
                          await setOrganizationStatus.mutateAsync({
                            organizationId: org.id,
                            status: s,
                            reason: orgReason || null,
                          });
                          setOrgReason("");
                          toast.success(`Organização marcada como ${ORG_STATUS_LABEL[s]}.`);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {s === "active" ? "Reativar" : s === "suspended" ? "Suspender" : "Cancelar"}
                    </Button>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assinatura" className="mt-6">
          <AdminSubscriptionPanel organizationId={org.id} />
        </TabsContent>

        <TabsContent value="usuarios" className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Desde</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: { user_id: string; role: string; created_at: string; profiles?: { full_name?: string; email?: string } | null }) => (
                  <tr key={m.user_id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">{m.profiles?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.profiles?.email ?? "—"}</td>
                    <td className="px-4 py-3">{ROLE_LABEL[m.role as OrgRole] ?? m.role}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="uso" className="mt-6">
          <p className="text-sm text-muted-foreground">O consumo detalhado está na aba Assinatura.</p>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
              Nenhum evento de assinatura registrado.
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((e: { id: string; event: string; from_status: string | null; to_status: string | null; source: string; created_at: string }) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
                >
                  <span className="font-medium">{SUBSCRIPTION_EVENT_LABEL[e.event] ?? e.event}</span>
                  {e.from_status && e.to_status && (
                    <span className="text-xs text-muted-foreground">
                      {e.from_status} → {e.to_status}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {e.source} · {dateTime(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
