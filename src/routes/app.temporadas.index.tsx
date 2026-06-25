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
import { SEASON_STATUS, seasonStatusLabel } from "@/lib/strategy";
import { SeasonFormDialog } from "@/components/strategy/season-form-dialog";

export const Route = createFileRoute("/app/temporadas/")({
  head: () => ({
    meta: [
      { title: "Temporadas — GBS" },
      { name: "description", content: "Ciclos comerciais que organizam palestras, campanhas, projetos e financeiro." },
    ],
  }),
  component: TemporadasPage,
});

const ALL = "__all__";

type Season = {
  id: string; name: string; description: string | null; status: string | null;
  starts_on: string | null; ends_on: string | null;
};

function TemporadasPage() {
  const { user } = useSession();
  const { organizationId, loading } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState(ALL);

  const seasons = useQuery({
    queryKey: ["seasons", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, description, status, starts_on, ends_on")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Season[];
    },
  });

  const filtered = useMemo(() => {
    let list = seasons.data ?? [];
    if (fStatus !== ALL) list = list.filter((s) => s.status === fStatus);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => [s.name, s.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    return list;
  }, [seasons.data, search, fStatus]);

  const totals = useMemo(() => {
    const list = seasons.data ?? [];
    return {
      total: list.length,
      ativa: list.filter((s) => s.status === "ativa").length,
      encerrada: list.filter((s) => s.status === "encerrada").length,
      planejamento: list.filter((s) => s.status === "planejamento").length,
    };
  }, [seasons.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Temporadas"
        title="Ciclos do Grupo"
        description="Cada temporada organiza palestras, campanhas, projetos, financeiro, estoque e agendistas em um único período."
        actions={
          <Button variant="navy" className="rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova temporada
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Temporadas" value={totals.total} />
        <Summary label="Ativas" value={totals.ativa} />
        <Summary label="Em planejamento" value={totals.planejamento} muted />
        <Summary label="Encerradas" value={totals.encerrada} muted />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-8">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar temporada…" className="rounded-full pl-9" />
          </div>
          <div className="md:col-span-4">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {SEASON_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading || seasons.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nenhuma temporada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {(seasons.data?.length ?? 0) > 0 ? "Ajuste os filtros." : "Crie a primeira temporada desta organização."}
          </p>
          <Button variant="navy" className="mt-6 rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova temporada
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.id} to="/app/temporadas/$id" params={{ id: s.id }}
              className="group rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/70 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Temporada</p>
                  <p className="mt-1 truncate font-serif text-lg text-foreground">{s.name}</p>
                  {s.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <Badge variant="outline" className="font-normal">{seasonStatusLabel(s.status)}</Badge>
              </div>
              <div className="mt-5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(s.starts_on)}</span>
                <span>→</span>
                <span>{formatDate(s.ends_on)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {organizationId && user && (
        <SeasonFormDialog open={open} onOpenChange={setOpen} organizationId={organizationId} userId={user.id} />
      )}
    </div>
  );
}

function Summary({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-3 font-serif text-2xl tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {new Intl.NumberFormat("pt-BR").format(value)}
      </p>
    </div>
  );
}
