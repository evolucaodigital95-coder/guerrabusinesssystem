import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, MapPin, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-shell";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatDate } from "@/lib/crm";
import { LECTURE_STATUS, lectureStatusLabel } from "@/lib/lectures";
import { LectureFormDialog } from "@/components/palestras/lecture-form-dialog";
import { LectureWizardDialog } from "@/components/palestras/lecture-wizard-dialog";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/palestras/")({
  head: () => ({
    meta: [
      { title: "Palestras — GBS" },
      { name: "description", content: "Hub central das palestras: empresa, agendista, temporada, financeiro, estoque e timeline." },
    ],
  }),
  component: PalestrasPage,
});

type Lecture = {
  id: string;
  title: string;
  theme: string | null;
  status: string | null;
  scheduled_at: string | null;
  scheduled_time: string | null;
  city: string | null;
  state: string | null;
  expected_audience: number | null;
  actual_audience: number | null;
  gross_revenue: number | null;
  companies: { id: string; legal_name: string } | null;
  agents: { id: string; full_name: string } | null;
  seasons: { id: string; name: string } | null;
};

const ALL = "__all__";

function PalestrasPage() {
  const { user } = useSession();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>(ALL);

  const lectures = useQuery({
    queryKey: ["lectures", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Lecture[]> => {
      const { data, error } = await supabase
        .from("lectures")
        .select(`
          id, title, theme, status, scheduled_at, scheduled_time, city, state,
          expected_audience, actual_audience, gross_revenue,
          companies:company_id ( id, legal_name ),
          agents:agent_id ( id, full_name ),
          seasons:season_id ( id, name )
        `)
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lecture[];
    },
  });

  const filtered = useMemo(() => {
    let list = lectures.data ?? [];
    if (fStatus !== ALL) list = list.filter((l) => l.status === fStatus);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        [l.title, l.theme, l.city, l.state, l.companies?.legal_name, l.agents?.full_name, l.seasons?.name]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [lectures.data, search, fStatus]);

  const totals = useMemo(() => {
    const list = lectures.data ?? [];
    return {
      total: list.length,
      impacted: list.reduce((s, l) => s + Number(l.actual_audience ?? 0), 0),
      expected: list.reduce((s, l) => s + Number(l.expected_audience ?? 0), 0),
      closed: list.filter((l) => l.status === "encerrada").length,
    };
  }, [lectures.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Palestras"
        title="Hub central"
        description="Cada palestra conecta empresa, contato, agendista, temporada, projeto, financeiro, estoque, timeline e auditoria."
        actions={
          <Button variant="navy" className="rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova palestra
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Palestras" value={totals.total} />
        <Summary label="Pessoas impactadas" value={totals.impacted} />
        <Summary label="Público previsto" value={totals.expected} muted />
        <Summary label="Encerradas" value={totals.closed} muted />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-8">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar palestra, tema, empresa, agendista, cidade…" className="rounded-full pl-9" />
          </div>
          <div className="md:col-span-4">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {LECTURE_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {orgLoading || lectures.isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nenhuma palestra</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {(lectures.data?.length ?? 0) > 0 ? "Ajuste os filtros." : "Crie a primeira palestra desta organização."}
          </p>
          <Button variant="navy" className="mt-6 rounded-full" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova palestra
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((l) => (
            <Link
              key={l.id} to="/app/palestras/$id" params={{ id: l.id }}
              className="group rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/70 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{l.companies?.legal_name ?? "Sem empresa"}</p>
                  <p className="mt-1 truncate font-serif text-lg text-foreground">{l.title}</p>
                  {l.theme && <p className="mt-0.5 truncate text-xs text-muted-foreground">{l.theme}</p>}
                </div>
                <Badge variant="outline" className="font-normal">{lectureStatusLabel(l.status)}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {formatDate(l.scheduled_at)}</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {[l.city, l.state].filter(Boolean).join(" / ") || "—"}</span>
                <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {l.actual_audience ?? l.expected_audience ?? "—"}</span>
              </div>
              {l.agents?.full_name && (
                <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">Agendista · {l.agents.full_name}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {organizationId && user && (
        <LectureFormDialog
          open={open} onOpenChange={setOpen}
          organizationId={organizationId} userId={user.id}
        />
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
