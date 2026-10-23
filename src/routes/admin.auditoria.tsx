import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { usePlatformAudit } from "@/hooks/use-platform";
import { dateTime } from "@/lib/platform";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — GBS Admin" },
      {
        name: "description",
        content: "Registro de todas as ações administrativas da plataforma GBS.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuditoria,
});

function AdminAuditoria() {
  const { data, isLoading } = usePlatformAudit(200);

  return (
    <>
      <PageHeader
        eyebrow="Plataforma"
        title="Auditoria administrativa"
        description="Nenhuma alteração é silenciosa: planos, assinaturas e status ficam registrados com autor, data e conteúdo."
      />

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-20 text-center text-sm text-muted-foreground">
          Nenhuma ação administrativa registrada ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Autor</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Entidade</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {dateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3">{row.actorName}</td>
                  <td className="px-4 py-3 font-medium">{row.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.entity_type}</td>
                  <td className="max-w-md px-4 py-3">
                    <code className="block truncate text-xs text-muted-foreground">
                      {JSON.stringify(row.diff)}
                    </code>
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
