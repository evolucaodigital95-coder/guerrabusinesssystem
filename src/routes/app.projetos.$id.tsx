import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { isSettled } from "@/lib/finance";
import { projectStatusLabel } from "@/lib/strategy";
import { ProjectFormDialog, type ProjectRow } from "@/components/strategy/project-form-dialog";
import { TimelineTab } from "@/components/shared/timeline-tab";
import { AttachmentsTab } from "@/components/shared/attachments-tab";

export const Route = createFileRoute("/app/projetos/$id")({
  head: () => ({
    meta: [
      { title: "Projeto — GBS" },
      {
        name: "description",
        content:
          "Detalhe do projeto: palestras, empresas, agendistas, financeiro, estoque, timeline e anexos.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const [editOpen, setEditOpen] = useState(false);

  const project = useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async (): Promise<
      | (ProjectRow & {
          id: string;
          seasons: { id: string; name: string } | null;
          campaigns: { id: string; name: string } | null;
        })
      | null
    > => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, name, description, status, season_id, campaign_id, owner_id, starts_on, ends_on, seasons:season_id(id,name), campaigns:campaign_id(id,name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as never;
    },
  });

  const lectures = useQuery({
    queryKey: ["project-lectures", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select(
          "id, title, status, scheduled_at, companies:company_id(legal_name), agents:agent_id(full_name)",
        )
        .eq("project_id", id)
        .is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const movements = useQuery({
    queryKey: ["project-movements", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, direction, amount, status, occurs_on, description")
        .eq("project_id", id)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stock = useQuery({
    queryKey: ["project-stock", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, kind, quantity, occurs_at, stock_items:stock_item_id(name)")
        .eq("project_id", id)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const fin = useMemo(() => {
    const list = movements.data ?? [];
    let revenue = 0,
      expenses = 0;
    for (const m of list) {
      if (!isSettled(m.direction as never, m.status)) continue;
      const v = Number(m.amount ?? 0);
      if (m.direction === "in") revenue += v;
      else if (m.direction === "out") expenses += v;
    }
    return { revenue, expenses, profit: revenue - expenses };
  }, [movements.data]);

  if (project.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!project.data)
    return <div className="text-sm text-muted-foreground">Projeto não encontrado.</div>;

  return (
    <div className="space-y-8">
      <Link
        to="/app/projetos"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Projetos
      </Link>

      <PageHeader
        eyebrow={
          [project.data.seasons?.name, project.data.campaigns?.name].filter(Boolean).join(" · ") ||
          "Projeto"
        }
        title={project.data.name}
        description={
          project.data.description ??
          `${formatDate(project.data.starts_on)} → ${formatDate(project.data.ends_on)}`
        }
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Status" text={projectStatusLabel(project.data.status)} />
        <Summary label="Palestras" text={String((lectures.data ?? []).length)} />
        <Summary label="Receita liquidada" text={formatCurrency(fin.revenue)} />
        <Summary label="Resultado" text={formatCurrency(fin.profit)} muted />
      </div>

      <Tabs defaultValue="palestras">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-full bg-card/40 p-1">
          {[
            ["palestras", "Palestras"],
            ["empresas", "Empresas"],
            ["agendistas", "Agendistas"],
            ["financeiro", "Financeiro"],
            ["estoque", "Estoque"],
            ["timeline", "Timeline"],
            ["anexos", "Anexos"],
          ].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="rounded-full text-xs">
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="palestras" className="mt-6">
          {(lectures.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem palestras.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {(lectures.data ?? []).map((l, i) => (
                <Link
                  key={l.id}
                  to="/app/palestras/$id"
                  params={{ id: l.id }}
                  className={`flex items-center justify-between gap-3 px-5 py-3 ${i ? "border-t border-border" : ""} bg-card/30 hover:bg-card/50`}
                >
                  <div>
                    <p className="text-sm">{l.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(l as { companies?: { legal_name?: string } | null }).companies
                        ?.legal_name ?? "—"}{" "}
                      · {formatDate(l.scheduled_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-normal">
                    {l.status ?? "—"}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="empresas" className="mt-6">
          <UniqueList
            items={(lectures.data ?? []).map(
              (l) =>
                (l as { companies?: { legal_name?: string } | null }).companies?.legal_name ?? null,
            )}
            empty="Sem empresas."
          />
        </TabsContent>
        <TabsContent value="agendistas" className="mt-6">
          <UniqueList
            items={(lectures.data ?? []).map(
              (l) => (l as { agents?: { full_name?: string } | null }).agents?.full_name ?? null,
            )}
            empty="Sem agendistas."
          />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6">
          {(movements.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem lançamentos.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {(movements.data ?? []).map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3 ${i ? "border-t border-border" : ""} bg-card/30`}
                >
                  <div>
                    <p className="text-sm">
                      {m.description ?? (m.direction === "in" ? "Entrada" : "Saída")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(m.occurs_on)} · {m.status ?? "—"}
                    </p>
                  </div>
                  <p className="font-mono text-sm">{formatCurrency(Number(m.amount ?? 0))}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="estoque" className="mt-6">
          {(stock.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem movimentações.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              {(stock.data ?? []).map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3 ${i ? "border-t border-border" : ""} bg-card/30`}
                >
                  <div>
                    <p className="text-sm">
                      {(s as { stock_items?: { name?: string } | null }).stock_items?.name ??
                        "Item"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.kind ?? "—"} · {formatDate(s.occurs_at)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums">{s.quantity ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {organizationId && user && (
            <TimelineTab
              entityType="project"
              entityId={id}
              organizationId={organizationId}
              userId={user.id}
            />
          )}
        </TabsContent>
        <TabsContent value="anexos" className="mt-6">
          {organizationId && user && (
            <AttachmentsTab
              entityType="project"
              entityId={id}
              organizationId={organizationId}
              userId={user.id}
            />
          )}
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <ProjectFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          organizationId={organizationId}
          userId={user.id}
          initial={{
            id,
            name: project.data.name,
            description: project.data.description,
            status: project.data.status,
            season_id: project.data.season_id,
            campaign_id: project.data.campaign_id,
            owner_id: project.data.owner_id,
            starts_on: project.data.starts_on,
            ends_on: project.data.ends_on,
          }}
        />
      )}
    </div>
  );
}

function Summary({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-3 font-serif text-xl ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {text}
      </p>
    </div>
  );
}
function UniqueList({ items, empty }: { items: (string | null)[]; empty: string }) {
  const list = Array.from(new Set(items.filter((x): x is string => !!x)));
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {list.map((n, i) => (
        <div
          key={n}
          className={`px-5 py-3 ${i ? "border-t border-border" : ""} bg-card/30 text-sm`}
        >
          {n}
        </div>
      ))}
    </div>
  );
}
