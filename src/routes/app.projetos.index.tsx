import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatDate } from "@/lib/crm";
import { PROJECT_STATUS, projectStatusLabel } from "@/lib/strategy";
import { ProjectFormDialog } from "@/components/strategy/project-form-dialog";

export const Route = createFileRoute("/app/projetos")({
  head: () => ({
    meta: [
      { title: "Projetos — GBS" },
      { name: "description", content: "Projetos vinculados a campanhas e temporadas, com responsáveis e prazos." },
    ],
  }),
  component: ProjetosPage,
});

const ALL = "__all__";

type Row = {
  id: string; name: string; description: string | null; status: string | null;
  starts_on: string | null; ends_on: string | null;
  seasons: { id: string; name: string } | null;
  campaigns: { id: string; name: string } | null;
};

function ProjetosPage() {
  const { user } = useSession();
  const { organizationId, loading } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState(ALL);
  const [fSeason, setFSeason] = useState(ALL);

  const seasons = useQuery({
    queryKey: ["seasons", organizationId, "filter"],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase.from("seasons").select("id, name")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const projects = useQuery({
    queryKey: ["projects", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, status, starts_on, ends_on, seasons:season_id(id,name), campaigns:campaign_id(id,name)")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    let list = projects.data ?? [];
    if (fStatus !== ALL) list = list.filter((p) => p.status === fStatus);
    if (fSeason !== ALL) list = list.filter((p) => p.seasons?.id === fSeason);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => [p.name, p.description, p.seasons?.name, p.campaigns?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    return list;
  }, [projects.data, search, fStatus, fSeason]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Projetos"
        title="Iniciativas estratégicas"
        description="Projetos conectam empresas, palestras, agendistas, financeiro e estoque dentro de uma campanha/temporada."
        actions={
          <Button variant="navy" className="rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo projeto
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projeto…" className="rounded-full pl-9" />
          </div>
          <div className="md:col-span-3">
            <Select value={fSeason} onValueChange={setFSeason}>
              <SelectTrigger className="rounded-full"><SelectValue placeholder="Temporada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as temporadas</SelectItem>
                {(seasons.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {PROJECT_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading || projects.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nenhum projeto</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {(projects.data?.length ?? 0) > 0 ? "Ajuste os filtros." : "Crie o primeiro projeto."}
          </p>
          <Button variant="navy" className="mt-6 rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo projeto
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} to="/app/projetos/$id" params={{ id: p.id }}
              className="group rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/70 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {[p.seasons?.name, p.campaigns?.name].filter(Boolean).join(" · ") || "Sem vínculo"}
                  </p>
                  <p className="mt-1 truncate font-serif text-lg text-foreground">{p.name}</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <Badge variant="outline" className="font-normal">{projectStatusLabel(p.status)}</Badge>
              </div>
              <div className="mt-5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(p.starts_on)}</span>
                <span>→</span><span>{formatDate(p.ends_on)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {organizationId && user && (
        <ProjectFormDialog open={open} onOpenChange={setOpen} organizationId={organizationId} userId={user.id} />
      )}
    </div>
  );
}
