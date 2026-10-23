import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAdminOrganizations } from "@/hooks/use-platform";
import {
  NOT_AVAILABLE,
  shortDate,
  SUBSCRIPTION_STATUS_LABEL,
  SUBSCRIPTION_STATUS_TONE,
  type SubscriptionStatus,
} from "@/lib/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — GBS Admin" },
      {
        name: "description",
        content: "Organizações clientes do GBS, planos e status de assinatura.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminClientes,
});

const FILTERS: { key: SubscriptionStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "trial", label: "Trial" },
  { key: "past_due", label: "Inadimplente" },
  { key: "canceled", label: "Cancelado" },
  { key: "suspended", label: "Suspenso" },
  { key: "expired", label: "Expirado" },
];

function AdminClientes() {
  const { data, isLoading } = useAdminOrganizations();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<SubscriptionStatus | "all">("all");

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!t) return true;
      return [o.name, o.ownerName, o.ownerEmail, o.plan?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [data, term, filter]);

  return (
    <>
      <PageHeader
        eyebrow="Plataforma"
        title="Clientes"
        description="Organizações que utilizam o GBS. Administração da plataforma — não é operação do cliente."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Pesquisar organização, responsável ou plano…"
          className="h-9 max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f.key
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center text-sm text-muted-foreground">
          Nenhuma organização encontrada.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Organização</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criada em</th>
                <th className="px-4 py-3">Último acesso</th>
                <th className="px-4 py-3 text-right">Usuários</th>
                <th className="px-4 py-3 text-right">Empresas</th>
                <th className="px-4 py-3 text-right">Palestras</th>
                <th className="px-4 py-3">Renovação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/clientes/$id"
                      params={{ id: o.id }}
                      className="font-medium hover:underline"
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{o.ownerName ?? "—"}</div>
                    <div className="text-xs">{o.ownerEmail ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">{o.plan?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={SUBSCRIPTION_STATUS_TONE[o.status]}>
                      {SUBSCRIPTION_STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(o.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{NOT_AVAILABLE}</td>
                  <td className="px-4 py-3 text-right">{o.usersCount}</td>
                  <td className="px-4 py-3 text-right">{o.companiesCount}</td>
                  <td className="px-4 py-3 text-right">{o.lecturesCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shortDate(o.subscription?.next_renewal_at ?? o.subscription?.trial_ends_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
