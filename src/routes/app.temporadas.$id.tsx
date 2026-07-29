import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Camera, TrendingUp, Users, Building2, Calendar } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { isSettled } from "@/lib/finance";
import { seasonStatusLabel } from "@/lib/strategy";
import { SeasonFormDialog, type SeasonRow } from "@/components/strategy/season-form-dialog";
import { TimelineTab } from "@/components/shared/timeline-tab";
import { NotesTab } from "@/components/shared/notes-tab";
import { AttachmentsTab } from "@/components/shared/attachments-tab";
import { ArchiveButton } from "@/components/shared/archive-button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/temporadas/$id")({
  head: () => ({
    meta: [
      { title: "Temporada — GBS" },
      { name: "description", content: "Visão completa de uma temporada: palestras, empresas, agendistas, financeiro, estoque, projetos, campanhas e snapshots." },
    ],
  }),
  component: SeasonDetail,
});

function SeasonDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const season = useQuery({
    queryKey: ["season", id],
    enabled: !!id,
    queryFn: async (): Promise<SeasonRow & { id: string } | null> => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, description, status, starts_on, ends_on")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as never;
    },
  });

  const lectures = useQuery({
    queryKey: ["season-lectures", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, status, scheduled_at, city, state, expected_audience, actual_audience, companies:company_id(legal_name), agents:agent_id(full_name)")
        .eq("season_id", id).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const movements = useQuery({
    queryKey: ["season-movements", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, direction, category, amount, status, occurs_on, description")
        .eq("season_id", id).is("archived_at", null)
        .order("occurs_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaigns = useQuery({
    queryKey: ["season-campaigns", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns").select("id, name, status, starts_on, ends_on")
        .eq("season_id", id).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const projects = useQuery({
    queryKey: ["season-projects", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("id, name, status, starts_on, ends_on")
        .eq("season_id", id).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stockMov = useQuery({
    queryKey: ["season-stock", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, kind, status, quantity, occurs_at, stock_items:stock_item_id(name)")
        .eq("season_id", id).is("archived_at", null)
        .order("occurs_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshots = useQuery({
    queryKey: ["season-snapshots", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("season_snapshots")
        .select("id, taken_at, revenue, expenses, profit, lectures_count, companies_count, agents_count, stock_movements_count, people_impacted, notes")
        .eq("season_id", id).is("archived_at", null)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const fin = useMemo(() => {
    const list = movements.data ?? [];
    let revenue = 0, expenses = 0;
    for (const m of list) {
      if (!isSettled(m.direction as never, m.status)) continue;
      const v = Number(m.amount ?? 0);
      if (m.direction === "in") revenue += v;
      else if (m.direction === "out") expenses += v;
    }
    return { revenue, expenses, profit: revenue - expenses };
  }, [movements.data]);

  const peopleImpacted = useMemo(
    () => (lectures.data ?? []).reduce((s, l) => s + Number(l.actual_audience ?? 0), 0),
    [lectures.data],
  );

  const companiesCount = useMemo(() => {
    const set = new Set<string>();
    for (const l of lectures.data ?? []) {
      const c = (l as { companies?: { legal_name?: string } | null }).companies?.legal_name;
      if (c) set.add(c);
    }
    return set.size;
  }, [lectures.data]);

  const agentsCount = useMemo(() => {
    const set = new Set<string>();
    for (const l of lectures.data ?? []) {
      const a = (l as { agents?: { full_name?: string } | null }).agents?.full_name;
      if (a) set.add(a);
    }
    return set.size;
  }, [lectures.data]);

  // ---------------- Analytics: Dashboard da Temporada ----------------
  const revenueSeries = useMemo(() => {
    // Cumulativo por mês (receita e despesa liquidada)
    const byMonth = new Map<string, { month: string; receita: number; despesa: number }>();
    const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
    for (const m of movements.data ?? []) {
      if (!isSettled(m.direction as never, m.status) || !m.occurs_on) continue;
      const d = new Date(m.occurs_on);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = fmt.format(d);
      const row = byMonth.get(key) ?? { month: label, receita: 0, despesa: 0 };
      const v = Number(m.amount ?? 0);
      if (m.direction === "in") row.receita += v;
      else row.despesa += v;
      byMonth.set(key, row);
    }
    const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    let accR = 0, accE = 0;
    return sorted.map(([, row]) => {
      accR += row.receita;
      accE += row.despesa;
      return { ...row, acumulado: accR - accE };
    });
  }, [movements.data]);

  const topCompanies = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lectures.data ?? []) {
      const name = (l as { companies?: { legal_name?: string } | null }).companies?.legal_name ?? "Sem empresa";
      map.set(name, (map.get(name) ?? 0) + Number((l as { actual_audience?: number | null }).actual_audience ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [lectures.data]);

  const topAgents = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lectures.data ?? []) {
      const name = (l as { agents?: { full_name?: string } | null }).agents?.full_name ?? "—";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [lectures.data]);

  const statusMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lectures.data ?? []) {
      const k = l.status ?? "sem_status";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [lectures.data]);

  const seasonProgress = useMemo(() => {
    const s = season.data;
    if (!s?.starts_on || !s?.ends_on) return null;
    const start = new Date(s.starts_on).getTime();
    const end = new Date(s.ends_on).getTime();
    const now = Date.now();
    if (end <= start) return null;
    const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
    const daysTotal = Math.round((end - start) / 86400000);
    const daysLeft = Math.max(0, Math.round((end - now) / 86400000));
    return { pct, daysTotal, daysLeft };
  }, [season.data]);

  const nextLecture = useMemo(() => {
    const now = Date.now();
    return (lectures.data ?? [])
      .filter((l) => l.scheduled_at && new Date(l.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0] ?? null;
  }, [lectures.data]);

        organization_id: organizationId,
        season_id: id,
        revenue: fin.revenue,
        expenses: fin.expenses,
        profit: fin.profit,
        lectures_count: (lectures.data ?? []).length,
        companies_count: companiesCount,
        agents_count: agentsCount,
        stock_movements_count: (stockMov.data ?? []).length,
        people_impacted: peopleImpacted,
        payload: { lectures: (lectures.data ?? []).length, projects: (projects.data ?? []).length, campaigns: (campaigns.data ?? []).length },
        created_by: user.id,
        updated_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Snapshot capturado");
      qc.invalidateQueries({ queryKey: ["season-snapshots", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (season.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!season.data) return <div className="text-sm text-muted-foreground">Temporada não encontrada.</div>;

  return (
    <div className="space-y-8">
      <Link to="/app/temporadas" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Temporadas
      </Link>

      <PageHeader
        eyebrow="Temporada"
        title={season.data.name}
        description={season.data.description ?? `${formatDate(season.data.starts_on)} → ${formatDate(season.data.ends_on)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <ArchiveButton table="seasons" id={id} label="esta temporada" listQueryKey="seasons" backTo="/app/temporadas" />
            <Button variant="navy" className="rounded-full" onClick={() => takeSnapshot.mutate()} disabled={takeSnapshot.isPending}>
              <Camera className="mr-1.5 h-4 w-4" /> Capturar snapshot
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Status" text={seasonStatusLabel(season.data.status)} />
        <Summary label="Receita liquidada" text={formatCurrency(fin.revenue)} />
        <Summary label="Despesa liquidada" text={formatCurrency(fin.expenses)} muted />
        <Summary label="Resultado" text={formatCurrency(fin.profit)} />
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-full bg-card/40 p-1">
          {[
            ["visao","Visão geral"],["palestras","Palestras"],["empresas","Empresas"],
            ["agendistas","Agendistas"],["financeiro","Financeiro"],["estoque","Estoque"],
            ["projetos","Projetos"],["campanhas","Campanhas"],["snapshots","Snapshots"],
            ["timeline","Timeline"],["notas","Notas"],["anexos","Anexos"],
          ].map(([v,l]) => <TabsTrigger key={v} value={v} className="rounded-full text-xs">{l}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="visao" className="mt-6 grid gap-3 md:grid-cols-3">
          <Stat label="Palestras" value={(lectures.data ?? []).length} />
          <Stat label="Pessoas impactadas" value={peopleImpacted} />
          <Stat label="Empresas únicas" value={companiesCount} />
          <Stat label="Agendistas envolvidos" value={agentsCount} />
          <Stat label="Projetos" value={(projects.data ?? []).length} />
          <Stat label="Campanhas" value={(campaigns.data ?? []).length} />
        </TabsContent>

        <TabsContent value="palestras" className="mt-6">
          <SimpleList rows={(lectures.data ?? []).map((l) => ({
            id: l.id,
            primary: l.title,
            secondary: [(l as { companies?: { legal_name?: string } | null }).companies?.legal_name, [l.city, l.state].filter(Boolean).join(" / ")].filter(Boolean).join(" · "),
            right: l.status ?? "—",
            to: `/app/palestras/${l.id}`,
          }))} empty="Sem palestras nesta temporada." />
        </TabsContent>

        <TabsContent value="empresas" className="mt-6">
          <SimpleList rows={Array.from(new Map((lectures.data ?? []).map((l) => {
            const c = (l as { companies?: { legal_name?: string } | null }).companies;
            return [c?.legal_name ?? "—", { id: c?.legal_name ?? "—", primary: c?.legal_name ?? "Sem empresa", secondary: "", right: "" }];
          })).values())} empty="Sem empresas vinculadas via palestras." />
        </TabsContent>

        <TabsContent value="agendistas" className="mt-6">
          <SimpleList rows={Array.from(new Map((lectures.data ?? []).map((l) => {
            const a = (l as { agents?: { full_name?: string } | null }).agents;
            return [a?.full_name ?? "—", { id: a?.full_name ?? "—", primary: a?.full_name ?? "Sem agendista", secondary: "", right: "" }];
          })).values())} empty="Sem agendistas vinculados via palestras." />
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6">
          <SimpleList rows={(movements.data ?? []).map((m) => ({
            id: m.id,
            primary: m.description ?? m.category ?? "Lançamento",
            secondary: `${m.direction === "in" ? "Entrada" : "Saída"} · ${formatDate(m.occurs_on)}`,
            right: formatCurrency(Number(m.amount ?? 0)),
          }))} empty="Sem lançamentos financeiros nesta temporada." />
        </TabsContent>

        <TabsContent value="estoque" className="mt-6">
          <SimpleList rows={(stockMov.data ?? []).map((m) => ({
            id: m.id,
            primary: (m as { stock_items?: { name?: string } | null }).stock_items?.name ?? "Item",
            secondary: `${m.kind ?? "—"} · ${formatDate(m.occurs_at)}`,
            right: String(m.quantity ?? "—"),
          }))} empty="Sem movimentações de estoque." />
        </TabsContent>

        <TabsContent value="projetos" className="mt-6">
          <SimpleList rows={(projects.data ?? []).map((p) => ({
            id: p.id, primary: p.name, secondary: `${formatDate(p.starts_on)} → ${formatDate(p.ends_on)}`,
            right: p.status ?? "—", to: `/app/projetos/${p.id}`,
          }))} empty="Sem projetos nesta temporada." />
        </TabsContent>

        <TabsContent value="campanhas" className="mt-6">
          <SimpleList rows={(campaigns.data ?? []).map((c) => ({
            id: c.id, primary: c.name, secondary: `${formatDate(c.starts_on)} → ${formatDate(c.ends_on)}`,
            right: c.status ?? "—", to: `/app/campanhas/${c.id}`,
          }))} empty="Sem campanhas nesta temporada." />
        </TabsContent>

        <TabsContent value="snapshots" className="mt-6 space-y-3">
          {(snapshots.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum snapshot capturado.</p>
          ) : (
            (snapshots.data ?? []).map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-card/40 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Snapshot</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.taken_at)}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Receita" value={formatCurrency(Number(s.revenue))} />
                  <Stat label="Despesas" value={formatCurrency(Number(s.expenses))} />
                  <Stat label="Lucro" value={formatCurrency(Number(s.profit))} />
                  <Stat label="Impactadas" value={s.people_impacted ?? 0} />
                  <Stat label="Palestras" value={s.lectures_count ?? 0} />
                  <Stat label="Empresas" value={s.companies_count ?? 0} />
                  <Stat label="Agendistas" value={s.agents_count ?? 0} />
                  <Stat label="Mov. estoque" value={s.stock_movements_count ?? 0} />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          {organizationId && user && <TimelineTab entityType="season" entityId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="notas" className="mt-6">
          {organizationId && user && <NotesTab entityType="season" entityId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="anexos" className="mt-6">
          {organizationId && user && <AttachmentsTab entityType="season" entityId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <SeasonFormDialog open={editOpen} onOpenChange={setEditOpen} organizationId={organizationId} userId={user.id}
          initial={season.data} />
      )}
    </div>
  );
}

function Summary({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-3 font-serif text-xl ${muted ? "text-muted-foreground" : "text-foreground"}`}>{text}</p>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-lg text-foreground">{typeof value === "number" ? new Intl.NumberFormat("pt-BR").format(value) : value}</p>
    </div>
  );
}
type RowItem = { id: string; primary: string; secondary?: string; right?: string; to?: string };
function SimpleList({ rows, empty }: { rows: RowItem[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {rows.map((r, i) => {
        const inner = (
          <div className={`flex items-center justify-between gap-3 px-5 py-3 ${i ? "border-t border-border" : ""} bg-card/30 hover:bg-card/50`}>
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{r.primary}</p>
              {r.secondary && <p className="truncate text-[11px] text-muted-foreground">{r.secondary}</p>}
            </div>
            {r.right && <Badge variant="outline" className="font-normal">{r.right}</Badge>}
          </div>
        );
        return r.to ? (
          <Link key={r.id + i} to={r.to}>{inner}</Link>
        ) : (
          <div key={r.id + i}>{inner}</div>
        );
      })}
    </div>
  );
}
