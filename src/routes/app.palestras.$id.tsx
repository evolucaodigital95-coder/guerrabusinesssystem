import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, Plus, MapPin, Users, Calendar, Building2, UserCircle2,
  ShieldCheck, History as HistoryIcon, Paperclip, Package, Wallet, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { LECTURE_STATUS, LECTURE_TIMELINE_KINDS, lectureStatusLabel, lectureTimelineLabel } from "@/lib/lectures";
import { LectureFormDialog, type LectureRow } from "@/components/palestras/lecture-form-dialog";
import { AttachmentsTab } from "@/components/crm/attachments-tab";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/palestras/$id")({
  head: () => ({
    meta: [
      { title: "Palestra — GBS" },
      { name: "description", content: "Resumo, timeline, financeiro, estoque e auditoria da palestra." },
    ],
  }),
  component: PalestraDetail,
});

function PalestraDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const [edit, setEdit] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [audienceDraft, setAudienceDraft] = useState<string>("");
  const qc = useQueryClient();

  const lecture = useQuery({
    queryKey: ["lecture", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select(`
          *,
          companies:company_id ( id, legal_name, trade_name ),
          contacts:contact_id ( id, full_name, email, phone ),
          agents:agent_id ( id, full_name ),
          seasons:season_id ( id, name ),
          campaigns:campaign_id ( id, name ),
          projects:project_id ( id, name )
        `).eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const movements = useQuery({
    queryKey: ["lecture-movements", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, direction, status, category, description, amount, expected_amount, occurs_on")
        .eq("lecture_id", id).is("archived_at", null)
        .order("occurs_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stock = useQuery({
    queryKey: ["lecture-stock", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, direction, quantity, reason, occurs_on, notes, stock_items:stock_item_id ( id, name, unit )")
        .eq("lecture_id", id).is("archived_at", null)
        .order("occurs_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshot = useQuery({
    queryKey: ["lecture-snapshot", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecture_financial_snapshots")
        .select("id, agent_amount, gustavo_amount, net_profit, gross_revenue, total_expenses, total_advances, closed_at")
        .eq("lecture_id", id).is("archived_at", null).order("closed_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["lecture-timeline", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timeline_events")
        .select("id, kind, title, body, occurred_at, created_at, actor_id, profiles:actor_id ( full_name, email )")
        .eq("entity_type", "lecture").eq("entity_id", id)
        .is("archived_at", null).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const audit = useQuery({
    queryKey: ["lecture-audit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, entity_type, entity_id, action, diff, created_at, actor_id, profiles:actor_id ( full_name, email )")
        .eq("entity_id", id).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("lectures").update({ status, updated_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["lecture", id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const saveAudience = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase.from("lectures").update({ actual_audience: value, updated_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Público real atualizado"); qc.invalidateQueries({ queryKey: ["lecture", id] }); setAudienceDraft(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const finance = useMemo(() => {
    const list = movements.data ?? [];
    const income = list.filter((m) => m.direction === "in").reduce((s, m) => s + Number(m.amount ?? m.expected_amount ?? 0), 0);
    const expense = list.filter((m) => m.direction === "out").reduce((s, m) => s + Number(m.amount ?? m.expected_amount ?? 0), 0);
    return { income, expense, count: list.length };
  }, [movements.data]);

  if (lecture.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!lecture.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/palestras" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Palestra não encontrada.</p>
      </div>
    );
  }

  const l = lecture.data;
  const company = l.companies as { id?: string; legal_name?: string; trade_name?: string } | null;
  const contact = l.contacts as { id?: string; full_name?: string; email?: string; phone?: string } | null;
  const agent = l.agents as { id?: string; full_name?: string } | null;
  const season = l.seasons as { id?: string; name?: string } | null;
  const campaign = l.campaigns as { id?: string; name?: string } | null;
  const project = l.projects as { id?: string; name?: string } | null;

  return (
    <div className="space-y-8">
      <Link to="/app/palestras" className="inline-flex items-center text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Palestras
      </Link>

      <PageHeader
        eyebrow={company?.legal_name ?? "Sem empresa"}
        title={l.title}
        description={l.theme ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Select value={l.status ?? "lead"} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="w-[220px] rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LECTURE_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-full" onClick={() => setEdit(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
          </div>
        }
      />

      {/* Cabeçalho com vínculos */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <RelCard icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={company?.legal_name ?? "—"} to={company?.id ? "/app/crm/$id" : undefined} params={company?.id ? { id: company.id } : undefined} />
        <RelCard icon={<UserCircle2 className="h-3.5 w-3.5" />} label="Contato" value={contact?.full_name ?? "—"} />
        <RelCard icon={<Users className="h-3.5 w-3.5" />} label="Agendista" value={agent?.full_name ?? "—"} to={agent?.id ? "/app/agendistas/$id" : undefined} params={agent?.id ? { id: agent.id } : undefined} />
        <RelCard icon={<Calendar className="h-3.5 w-3.5" />} label="Temporada" value={season?.name ?? "—"} />
        <RelCard icon={<Activity className="h-3.5 w-3.5" />} label="Campanha" value={campaign?.name ?? "—"} />
        <RelCard icon={<Activity className="h-3.5 w-3.5" />} label="Projeto" value={project?.name ?? "—"} />
      </div>

      {/* Cards executivos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Data" value={`${formatDate(l.scheduled_at)}${l.scheduled_time ? ` · ${l.scheduled_time.slice(0,5)}` : ""}`} />
        <KPI label="Local" value={[l.city, l.state].filter(Boolean).join(" / ") || "—"} icon={<MapPin className="h-3.5 w-3.5" />} />
        <KPI label="Público real / previsto" value={`${l.actual_audience ?? "—"} / ${l.expected_audience ?? "—"}`} icon={<Users className="h-3.5 w-3.5" />} />
        <KPI label="Receita bruta" value={formatCurrency(Number(l.gross_revenue ?? 0))} />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/40">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="financeiro"><Wallet className="mr-1.5 h-3.5 w-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="estoque"><Package className="mr-1.5 h-3.5 w-3.5" />Estoque</TabsTrigger>
          <TabsTrigger value="impacto">Pessoas impactadas</TabsTrigger>
          <TabsTrigger value="anexos"><Paperclip className="mr-1.5 h-3.5 w-3.5" />Anexos</TabsTrigger>
          <TabsTrigger value="auditoria"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {l.notes && (
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Observações</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{l.notes}</p>
            </div>
          )}
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Endereço completo</p>
            <p className="mt-2 text-sm text-foreground">{l.address ?? "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{[l.city, l.state].filter(Boolean).join(" — ") || "Sem localização definida"}</p>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => setEventOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Registrar evento
            </Button>
          </div>
          {(events.data ?? []).length === 0 ? (
            <Empty title="Sem eventos" subtitle="Registre os marcos: contato, negociação, fechamento, pagamento, palestra, fotos, depoimento, pós-venda." />
          ) : (
            <ol className="relative space-y-5 border-l border-border pl-6">
              {(events.data ?? []).map((ev) => {
                const profile = ev.profiles as { full_name?: string; email?: string } | null;
                return (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[27px] top-2 h-2 w-2 rounded-full" style={{ background: "var(--gold)" }} />
                    <p className="text-sm text-foreground">{ev.title ?? lectureTimelineLabel(ev.kind)}</p>
                    {ev.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{ev.body}</p>}
                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatDate(ev.occurred_at)} · {lectureTimelineLabel(ev.kind)}{profile ? ` · ${profile.full_name ?? profile.email}` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI label="Receitas vinculadas" value={formatCurrency(finance.income)} />
            <KPI label="Despesas vinculadas" value={formatCurrency(finance.expense)} />
            <KPI label="Lançamentos" value={String(finance.count)} />
          </div>
          {snapshot.data && (
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Snapshot de fechamento</p>
              <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm">
                <Field label="Lucro líquido" value={formatCurrency(Number(snapshot.data.net_profit))} />
                <Field label="Gustavo" value={formatCurrency(Number(snapshot.data.gustavo_amount))} />
                <Field label="Agendista" value={formatCurrency(Number(snapshot.data.agent_amount))} accent="gold" />
                <Field label="Fechada em" value={formatDate(snapshot.data.closed_at)} />
              </div>
            </div>
          )}
          {(movements.data ?? []).length === 0 ? (
            <Empty title="Sem lançamentos vinculados" subtitle="Vincule receitas, despesas, custos e comprovantes a esta palestra no módulo Financeiro." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Descrição</th>
                    <th className="px-4 py-3 text-left font-medium">Categoria</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(movements.data ?? []).map((m) => {
                    const isIn = m.direction === "in";
                    const value = m.amount ?? m.expected_amount;
                    return (
                      <tr key={m.id} className="border-t border-border/70">
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(m.occurs_on)}</td>
                        <td className="px-4 py-3 text-foreground">{m.description ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.category ?? "—"}</td>
                        <td className={cn("px-4 py-3 text-right tabular-nums", isIn ? "text-emerald-600" : "text-rose-600")}>
                          {isIn ? "+" : "−"} {formatCurrency(Number(value ?? 0))}
                        </td>
                        <td className="px-4 py-3"><Badge variant="outline" className="font-normal">{m.status ?? "—"}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="estoque" className="space-y-4">
          {(stock.data ?? []).length === 0 ? (
            <Empty title="Sem movimentações de estoque" subtitle="Reservas, consumos e baixas vinculadas à palestra aparecem aqui." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Motivo</th>
                    <th className="px-4 py-3 text-right font-medium">Quantidade</th>
                  </tr>
                </thead>
                <tbody>
                  {(stock.data ?? []).map((s) => {
                    const item = s.stock_items as { name?: string; unit?: string } | null;
                    return (
                      <tr key={s.id} className="border-t border-border/70">
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(s.occurs_on)}</td>
                        <td className="px-4 py-3 text-foreground">{item?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.reason ?? "—"}</td>
                        <td className={cn("px-4 py-3 text-right tabular-nums", s.direction === "in" ? "text-emerald-600" : "text-rose-600")}>
                          {s.direction === "in" ? "+" : "−"} {Number(s.quantity ?? 0)} {item?.unit ?? ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="impacto" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Pessoas impactadas nesta palestra</p>
            <p className="mt-3 font-serif text-4xl text-foreground tabular-nums">{l.actual_audience ?? "—"}</p>
            <p className="mt-2 text-xs text-muted-foreground">Previsto: {l.expected_audience ?? "—"}</p>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-[0.22em]">Atualizar público real</Label>
                <Input
                  type="number" className="mt-1 w-40"
                  value={audienceDraft} onChange={(e) => setAudienceDraft(e.target.value)}
                  placeholder={String(l.actual_audience ?? "")}
                />
              </div>
              <Button variant="navy" className="rounded-full" disabled={!audienceDraft || saveAudience.isPending}
                onClick={() => saveAudience.mutate(Number(audienceDraft))}>
                Salvar
              </Button>
            </div>
            <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Estrutura preparada para somar automaticamente por: dia · semana · mês · temporada · ano · histórico.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="anexos">
          {organizationId && user && (
            <AttachmentsTab entityType="lecture" entityId={id} organizationId={organizationId} userId={user.id} />
          )}
        </TabsContent>

        <TabsContent value="auditoria">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Trilha completa — nada é apagado
            </p>
            {(audit.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {(audit.data ?? []).map((ev) => {
                  const profile = ev.profiles as { full_name?: string; email?: string } | null;
                  const diff = ev.diff as { changes?: Record<string, { old: unknown; new: unknown }> } | null;
                  return (
                    <li key={ev.id} className="rounded-xl border border-border/70 bg-background/40 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm text-foreground">
                          <HistoryIcon className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />
                          <span className="capitalize">{ev.action}</span> · {ev.entity_type}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {profile?.full_name ?? profile?.email ?? "Sistema"} · {formatDate(ev.created_at)}
                        </p>
                      </div>
                      {diff?.changes && (
                        <ul className="mt-2 space-y-1 text-xs">
                          {Object.entries(diff.changes).map(([k, v]) => (
                            <li key={k} className="text-muted-foreground">
                              <span className="text-foreground">{k}:</span> <span className="line-through opacity-60">{String(v.old ?? "—")}</span> → {String(v.new ?? "—")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <>
          <LectureFormDialog
            open={edit} onOpenChange={setEdit}
            organizationId={organizationId} userId={user.id}
            initial={l as LectureRow}
          />
          <EventDialog
            open={eventOpen} onOpenChange={setEventOpen}
            organizationId={organizationId} userId={user.id} lectureId={id}
          />
        </>
      )}
    </div>
  );
}

function EventDialog({ open, onOpenChange, organizationId, userId, lectureId }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  organizationId: string; userId: string; lectureId: string;
}) {
  const [kind, setKind] = useState<string>("first_contact");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timeline_events").insert({
        organization_id: organizationId,
        entity_type: "lecture", entity_id: lectureId,
        kind, title: title.trim() || lectureTimelineLabel(kind),
        body: body.trim() || null,
        occurred_at: new Date(`${occurredAt}T12:00:00`).toISOString(),
        actor_id: userId, created_by: userId, updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      qc.invalidateQueries({ queryKey: ["lecture-timeline", lectureId] });
      setTitle(""); setBody(""); setKind("first_contact");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) { e.preventDefault(); create.mutate(); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Registrar evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LECTURE_TIMELINE_KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lectureTimelineLabel(kind)} />
          </div>
          <div className="space-y-1.5">
            <Label>Detalhes</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Quando</Label>
            <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={create.isPending}>Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RelCard({ icon, label, value, to, params }: {
  icon: React.ReactNode; label: string; value: string;
  to?: string; params?: Record<string, string>;
}) {
  const content = (
    <div className="h-full rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:bg-card/70">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 truncate text-sm text-foreground">{value}</p>
    </div>
  );
  if (to && params) {
    return <Link to={to} params={params}>{content}</Link>;
  }
  return content;
}

function KPI({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{icon}{label}</p>
      <p className="mt-3 font-serif text-xl text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: "gold" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 tabular-nums", accent === "gold" ? "text-[var(--gold)]" : "text-foreground")}>{value}</p>
    </div>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-12 text-center">
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
