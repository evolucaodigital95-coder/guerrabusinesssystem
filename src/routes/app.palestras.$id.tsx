import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Pencil, Plus, MapPin, Users, Calendar, Building2, UserCircle2,
  ShieldCheck, History as HistoryIcon, Paperclip, Package, Wallet, Activity,
  Calculator, Info, ExternalLink, Lock,
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
import { NotesTab } from "@/components/shared/notes-tab";
import { ArchiveButton } from "@/components/shared/archive-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalcBreakdown } from "@/components/finance/calc-breakdown";
import { calculateLecture, selectRule, BUCKET_LABEL, type RuleSnapshot, type ExpenseBucket, type LectureExpenseInput } from "@/lib/finance-engine";
import { paymentMethodLabel } from "@/lib/finance";
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
        .select("id, direction, status, category, description, amount, expected_amount, occurs_on, payment_method, card_fee_amount, net_amount")
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
        .select("id, direction, kind, status, quantity, unit_cost, total_cost, reason, occurs_on, notes, stock_items:stock_item_id ( id, name, unit )")
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
        .select("id, agent_amount, gustavo_amount, net_profit, gross_revenue, total_expenses, total_advances, total_card_fees, total_stock_cost, closed_at")
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
        .select("id, kind, title, body, occurs_at, created_at, created_by, profiles:created_by ( full_name, email )")
        .eq("entity_type", "lecture").eq("entity_id", id)
        .is("archived_at", null).order("occurs_at", { ascending: false });
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
            <ArchiveButton table="lectures" id={id} label="esta palestra" listQueryKey="lectures" backTo="/app/palestras" />
          </div>
        }
      />

      {/* Cabeçalho com vínculos */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {company?.id ? (
          <Link to="/app/crm/$id" params={{ id: company.id }}>
            <RelCard icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={company?.legal_name ?? "—"} />
          </Link>
        ) : (
          <RelCard icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value="—" />
        )}
        <RelCard icon={<UserCircle2 className="h-3.5 w-3.5" />} label="Contato" value={contact?.full_name ?? "—"} />
        {agent?.id ? (
          <Link to="/app/agendistas/$id" params={{ id: agent.id }}>
            <RelCard icon={<Users className="h-3.5 w-3.5" />} label="Agendista" value={agent?.full_name ?? "—"} />
          </Link>
        ) : (
          <RelCard icon={<Users className="h-3.5 w-3.5" />} label="Agendista" value="—" />
        )}
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
          <TabsTrigger value="fechamento"><Calculator className="mr-1.5 h-3.5 w-3.5" />Fechamento Financeiro</TabsTrigger>

          <TabsTrigger value="estoque"><Package className="mr-1.5 h-3.5 w-3.5" />Estoque</TabsTrigger>
          <TabsTrigger value="impacto">Pessoas impactadas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
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
                      {formatDate(ev.occurs_at)} · {lectureTimelineLabel(ev.kind)}{profile ? ` · ${profile.full_name ?? profile.email}` : ""}
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
                <Field label="Taxas cartão" value={formatCurrency(Number(snapshot.data.total_card_fees ?? 0))} />
                <Field label="Materiais" value={formatCurrency(Number(snapshot.data.total_stock_cost ?? 0))} />
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

        <TabsContent value="fechamento" className="space-y-4">
          {organizationId && user && (
            <FechamentoFinanceiroTab
              lectureId={id}
              organizationId={organizationId}
              userId={user.id}
              grossRevenueDefault={Number(l.gross_revenue ?? 0)}
              agentId={agent?.id ?? null}
              seasonId={season?.id ?? null}
            />
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
                    <th className="px-4 py-3 text-right font-medium">Custo</th>
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
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {s.direction === "out" ? formatCurrency(Number(s.total_cost ?? 0)) : "—"}
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

        <TabsContent value="notas">
          {organizationId && user && (
            <NotesTab entityType="lecture" entityId={id} organizationId={organizationId} userId={user.id} />
          )}
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
        occurs_at: new Date(`${occurredAt}T12:00:00`).toISOString(),
        created_by: userId, updated_by: userId,
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

function RelCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="h-full rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:bg-card/70">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{icon}{label}</p>
      <p className="mt-2 truncate text-sm text-foreground">{value}</p>
    </div>
  );
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

/* ============================================================
 * Fechamento Financeiro — motor automático e auditável.
 * ============================================================ */

const TAX_CATEGORIES = ["Impostos", "Taxa", "Taxas"];
const COST_CATEGORIES = ["Operacional", "Viagem", "Tecnologia", "Marketing", "Folha"];
const EXCLUDED_CATEGORIES = ["Adiantamento", "Comissão"]; // tratados separadamente
const CANCEL_STATUS = ["cancelado", "cancelada"];

function bucketOf(category: string | null | undefined): ExpenseBucket {
  const c = (category ?? "").trim();
  if (TAX_CATEGORIES.includes(c)) return "tax";
  if (COST_CATEGORIES.includes(c)) return "cost";
  return "expense";
}

type EnrichedExpense = LectureExpenseInput & {
  id: string;
  source: "financial_movement" | "stock_movement";
  category?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  docRoute?: string;
  docLabel?: string;
};

function FechamentoFinanceiroTab({
  lectureId, organizationId, userId, grossRevenueDefault, agentId, seasonId,
}: {
  lectureId: string;
  organizationId: string;
  userId: string;
  grossRevenueDefault: number;
  agentId: string | null;
  seasonId: string | null;
}) {
  const qc = useQueryClient();

  const movements = useQuery({
    queryKey: ["fechamento-movements", lectureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, direction, status, category, description, amount, expected_amount, occurs_on, occurs_time, created_at, created_by, account_id, payment_method, card_brand_id, card_installments, card_fee_percent, card_fee_amount, net_amount, accounts:account_id ( id, name ), card_brands:card_brand_id ( id, name, kind )")
        .eq("lecture_id", lectureId).is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stockMoves = useQuery({
    queryKey: ["fechamento-stock", lectureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, direction, quantity, reason, occurs_on, notes, kind, unit_cost, total_cost, created_at, created_by, stock_items:stock_item_id ( id, name, unit, average_cost )")
        .eq("lecture_id", lectureId).is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const lectureAdvances = useQuery({
    queryKey: ["fechamento-advances", lectureId, agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advances")
        .select("id, amount, amount_amortized, granted_on, granted_time, source, paid_by_label, status, lecture_id, notes, created_at, created_by")
        .eq("agent_id", agentId!).is("archived_at", null)
        .neq("status", "cancelado");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rules = useQuery({
    queryKey: ["financial_rules", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_rules")
        .select("*").eq("organization_id", organizationId)
        .is("archived_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const snapshot = useQuery({
    queryKey: ["fechamento-snapshot", lectureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecture_financial_snapshots")
        .select("id, agent_id, agent_amount, gustavo_amount, net_profit, gross_revenue, total_expenses, total_advances, total_card_fees, total_stock_cost, rule_snapshot, inputs, breakdown, closed_at, closed_by")
        .eq("lecture_id", lectureId).is("archived_at", null)
        .order("closed_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Profiles for transparency
  const actorIds = useMemo(() => {
    const s = new Set<string>();
    (movements.data ?? []).forEach((m) => m.created_by && s.add(m.created_by));
    (stockMoves.data ?? []).forEach((m) => m.created_by && s.add(m.created_by));
    (lectureAdvances.data ?? []).forEach((m) => m.created_by && s.add(m.created_by));
    if (snapshot.data?.closed_by) s.add(snapshot.data.closed_by);
    return Array.from(s);
  }, [movements.data, stockMoves.data, lectureAdvances.data, snapshot.data]);

  const profiles = useQuery({
    queryKey: ["profiles-by-ids", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      if (error) throw error;
      const m = new Map<string, { full_name: string | null; email: string | null }>();
      (data ?? []).forEach((p) => m.set(p.id, { full_name: p.full_name, email: p.email }));
      return m;
    },
  });
  const actorName = (uid: string | null | undefined) => {
    if (!uid) return "Sistema";
    const p = profiles.data?.get(uid);
    return p?.full_name || p?.email || "Usuário";
  };

  // Receitas (in)
  const receitas = useMemo(() => {
    return (movements.data ?? [])
      .filter((m) => m.direction === "in" && !CANCEL_STATUS.includes(m.status ?? ""))
      .map((m) => ({
        id: m.id,
        description: m.description ?? "Receita",
        amount: Number(m.amount ?? m.expected_amount ?? 0),
        cardFeeAmount: Number(m.card_fee_amount ?? 0),
        cardFeePercent: Number(m.card_fee_percent ?? 0),
        netAmount: Number(m.net_amount ?? m.amount ?? m.expected_amount ?? 0),
        paymentMethod: m.payment_method,
        cardBrand: (m.card_brands as { name?: string } | null)?.name ?? null,
        installments: m.card_installments,
        date: m.occurs_on,
        category: m.category,
        status: m.status,
        createdAt: m.created_at,
        createdBy: m.created_by,
        docRoute: "/app/financeiro",
        docLabel: "Abrir financeiro",
      }));
  }, [movements.data]);

  const cardFees = useMemo(() => {
    return receitas
      .filter((r) => r.cardFeeAmount > 0)
      .map((r) => ({
        movement_id: r.id,
        description: r.description,
        brand: r.cardBrand ?? paymentMethodLabel(r.paymentMethod),
        installments: r.installments,
        percent: r.cardFeePercent,
        amount: r.cardFeeAmount,
        date: r.date,
      }));
  }, [receitas]);

  const grossRevenue = useMemo(() => {
    const fromMov = receitas.reduce((s, r) => s + r.amount, 0);
    return fromMov > 0 ? fromMov : grossRevenueDefault;
  }, [receitas, grossRevenueDefault]);

  // Expenses (financial out) categorized
  const expensesFromMovs: EnrichedExpense[] = useMemo(() => {
    return (movements.data ?? [])
      .filter((m) =>
        m.direction === "out"
        && !CANCEL_STATUS.includes(m.status ?? "")
        && !EXCLUDED_CATEGORIES.includes(m.category ?? "")
      )
      .map((m) => ({
        id: m.id,
        source: "financial_movement" as const,
        description: m.description,
        amount: Number(m.amount ?? m.expected_amount ?? 0),
        date: m.occurs_on,
        category: m.category,
        bucket: bucketOf(m.category),
        createdAt: m.created_at,
        createdBy: m.created_by,
        docRoute: "/app/financeiro",
        docLabel: "Abrir financeiro",
      }));
  }, [movements.data]);

  // Stock consumed (out)
  const expensesFromStock: EnrichedExpense[] = useMemo(() => {
    return (stockMoves.data ?? [])
      .filter((m) => m.direction === "out")
      .map((m) => {
        const item = m.stock_items as { id?: string; name?: string; unit?: string; average_cost?: number | null } | null;
        const qty = Number(m.quantity ?? 0);
        const cost =
          Number(m.total_cost ?? 0)
          || qty * Number(m.unit_cost ?? 0)
          || qty * Number(item?.average_cost ?? 0);
        return {
          id: m.id,
          source: "stock_movement" as const,
          description: `${item?.name ?? "Item"} · ${qty} ${item?.unit ?? ""}`.trim(),
          amount: cost,
          date: m.occurs_on,
          bucket: "stock" as const,
          createdAt: m.created_at,
          createdBy: m.created_by,
          docRoute: item?.id ? `/app/estoque/${item.id}` : "/app/estoque",
          docLabel: "Abrir item",
        };
      })
      .filter((e) => e.amount > 0);
  }, [stockMoves.data]);

  const expenses: EnrichedExpense[] = useMemo(
    () => [...expensesFromMovs, ...expensesFromStock],
    [expensesFromMovs, expensesFromStock],
  );

  // Advances: linked to this lecture + open advances of the agent
  const advancesForCalc = useMemo(() => {
    return (lectureAdvances.data ?? [])
      .filter((a) => a.lecture_id === lectureId || (a.status !== "abatido_total" && a.lecture_id === null))
      .map((a) => ({
        id: a.id,
        amount: Math.max(0, Number(a.amount ?? 0) - Number(a.amount_amortized ?? 0)),
        granted_on: a.granted_on,
        source: a.source,
        notes: a.notes,
        createdAt: a.created_at,
        createdBy: a.created_by,
      }))
      .filter((a) => a.amount > 0);
  }, [lectureAdvances.data, lectureId]);

  // Rule
  const activeRule: RuleSnapshot = useMemo(() => selectRule({
    rules: (rules.data ?? []) as unknown as Parameters<typeof selectRule>[0]["rules"],
    agentId, seasonId,
  }), [rules.data, agentId, seasonId]);

  // Snapshot wins when closed (frozen rule + frozen breakdown)
  const isClosed = !!snapshot.data;
  const calc = useMemo(() => {
    if (isClosed && snapshot.data?.breakdown) {
      return snapshot.data.breakdown as ReturnType<typeof calculateLecture>;
    }
    return calculateLecture({
      grossRevenue,
        cardFees,
      expenses,
      advances: advancesForCalc,
      rule: activeRule,
    });
  }, [isClosed, snapshot.data, grossRevenue, cardFees, expenses, advancesForCalc, activeRule]);

  const close = useMutation({
    mutationFn: async () => {
      if (!grossRevenue) throw new Error("Defina a receita bruta da palestra antes de fechar.");
      if (!agentId) throw new Error("Vincule um agendista antes de fechar.");

      const breakdown = calculateLecture({
        grossRevenue, cardFees, expenses, advances: advancesForCalc, rule: activeRule,
      });

      const { error: insErr } = await supabase.from("lecture_financial_snapshots").insert({
        organization_id: organizationId,
        lecture_id: lectureId,
        agent_id: agentId,
        rule_id: activeRule.id ?? null,
        rule_snapshot: JSON.parse(JSON.stringify(activeRule)),
        inputs: JSON.parse(JSON.stringify({ grossRevenue, cardFees, expenses, advances: advancesForCalc })),
        breakdown: JSON.parse(JSON.stringify(breakdown)),
        gross_revenue: grossRevenue,
        total_expenses: breakdown.totals.totalExpenses,
        total_advances: breakdown.totals.totalAdvances,
        total_card_fees: breakdown.totals.totalCardFees,
        total_stock_cost: breakdown.totals.totalStock,
        net_profit: breakdown.totals.netProfit,
        gustavo_amount: breakdown.totals.gustavoAmount,
        agent_amount: breakdown.totals.agentAmount,
        closed_by: userId,
      });
      if (insErr) throw insErr;

      // Amortiza adiantamentos abertos
      for (const a of advancesForCalc) {
        const original = (lectureAdvances.data ?? []).find((x) => x.id === a.id);
        if (!original) continue;
        const newAmortized = Number(original.amount_amortized ?? 0) + a.amount;
        const fullyAmortized = newAmortized >= Number(original.amount ?? 0);
        await supabase.from("advances").update({
          amount_amortized: newAmortized,
          status: fullyAmortized ? "abatido_total" : "abatido_parcial",
          updated_by: userId,
        }).eq("id", a.id);
      }

      await supabase.from("lectures").update({
        financial_status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
      }).eq("id", lectureId);
    },
    onSuccess: () => {
      toast.success("Fechamento concluído. Snapshot salvo permanentemente.");
      qc.invalidateQueries({ queryKey: ["fechamento-snapshot", lectureId] });
      qc.invalidateQueries({ queryKey: ["fechamento-advances", lectureId, agentId] });
      qc.invalidateQueries({ queryKey: ["lecture-snapshot", lectureId] });
      qc.invalidateQueries({ queryKey: ["lecture", lectureId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao fechar"),
  });

  const loading = movements.isLoading || stockMoves.isLoading || lectureAdvances.isLoading || rules.isLoading || snapshot.isLoading;
  if (loading) return <p className="text-sm text-muted-foreground">Carregando motor financeiro…</p>;

  const ruleInUse: RuleSnapshot = isClosed
    ? (snapshot.data!.rule_snapshot as RuleSnapshot)
    : activeRule;

  return (
    <div className="space-y-5">
      {/* Cabeçalho do motor */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Motor Financeiro</p>
          <p className="mt-1 font-serif text-xl text-foreground">
            {isClosed ? "Fechamento concluído" : "Fechamento em aberto"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Regra: <span className="text-foreground">{ruleInUse.name ?? "—"}</span> ·
            Gustavo {pctStr(ruleInUse.gustavo_share)} · Agendista {pctStr(ruleInUse.agent_share)}
            {ruleInUse.fee_percent || ruleInUse.fee_fixed ? ` · Taxa ${pctStr(ruleInUse.fee_percent)}${ruleInUse.fee_fixed ? ` + ${formatCurrency(ruleInUse.fee_fixed)}` : ""}` : ""}
          </p>
          {isClosed && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" /> Snapshot congelado em {formatDate(snapshot.data!.closed_at)} por {actorName(snapshot.data!.closed_by)}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CalcBreakdown
            title="Cálculo do fechamento"
            subtitle={`Regra: ${ruleInUse.name ?? "—"}`}
            lines={calc.lines}
            footer={isClosed
              ? <>Snapshot permanente — não muda mesmo se a regra for alterada.</>
              : <>Pré-cálculo dinâmico — torna-se permanente após o fechamento.</>}
            trigger={
              <Button variant="outline" size="sm" className="rounded-full">
                <Calculator className="mr-1.5 h-4 w-4" /> Ver Cálculo
              </Button>
            }
          />
          {!isClosed && (
            <Button
              variant="navy" size="sm" className="rounded-full"
              disabled={close.isPending || !grossRevenue || !agentId}
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Fechar palestra e gerar snapshot permanente?")) {
                  close.mutate();
                }
              }}
            >
              <Lock className="mr-1.5 h-4 w-4" /> Fechar palestra
            </Button>
          )}
        </div>
      </div>

      {/* KPIs do cálculo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <CalcKPI label="Receita bruta" value={calc.totals.grossRevenue} accent="positive" />
        <CalcKPI label="Taxas cartão" value={-calc.totals.totalCardFees} accent="negative" />
        <CalcKPI label="Materiais" value={-calc.totals.totalStock} accent="negative" />
        <CalcKPI label="Total saídas" value={-(calc.totals.totalExpenses + calc.totals.totalAdvances + calc.totals.fee + calc.totals.totalCardFees)} accent="negative" />
        <CalcKPI label="Lucro líquido" value={calc.totals.netProfit} accent={calc.totals.netProfit >= 0 ? "positive" : "negative"} />
        <CalcKPI label="Gustavo" value={calc.totals.gustavoAmount} accent="muted" />
        <CalcKPI label="Agendista" value={calc.totals.agentAmount} accent="gold" />
      </div>

      {/* Receitas */}
      <FechamentoSection
        title="Receitas"
        subtitle="Lançamentos de entrada vinculados a esta palestra"
        emptyText="Nenhuma receita vinculada."
        rows={receitas.map((r) => ({
          id: r.id,
          date: r.date,
          description: r.description,
          tag: r.category ?? "Receita",
          amount: r.amount,
          positive: true,
          origin: {
            actorName: actorName(r.createdBy),
            createdAt: r.createdAt,
              reason: [
                r.status ? `Status: ${r.status}` : null,
                r.paymentMethod ? `Forma: ${paymentMethodLabel(r.paymentMethod)}` : null,
                r.cardFeeAmount > 0 ? `Taxa cartão: ${formatCurrency(r.cardFeeAmount)} · líquido ${formatCurrency(r.netAmount)}` : null,
              ].filter(Boolean).join(" · ") || null,
            docRoute: r.docRoute, docLabel: r.docLabel,
          },
        }))}
        totalLabel="Total de receitas"
        total={calc.totals.grossRevenue}
      />

      {/* Buckets de despesa */}
      {(["tax", "cost", "stock", "expense"] as ExpenseBucket[]).map((bucket) => {
        const rows = expenses.filter((e) => (e.bucket ?? "expense") === bucket);
        const total =
          bucket === "tax" ? calc.totals.totalTaxes :
          bucket === "cost" ? calc.totals.totalCosts :
          bucket === "stock" ? calc.totals.totalStock :
          calc.totals.totalOtherExpenses;
        return (
          <FechamentoSection
            key={bucket}
            title={BUCKET_LABEL[bucket]}
            subtitle={
              bucket === "tax" ? "Impostos e taxas debitados da receita" :
              bucket === "cost" ? "Custos operacionais, viagem, tecnologia" :
              bucket === "stock" ? "Itens consumidos no estoque (custo médio)" :
              "Demais despesas vinculadas"
            }
            emptyText={`Nenhum lançamento em ${BUCKET_LABEL[bucket]}.`}
            rows={rows.map((e) => ({
              id: e.id,
              date: e.date ?? null,
              description: e.description ?? "—",
              tag: e.source === "stock_movement" ? "Estoque" : (e.category ?? "Despesa"),
              amount: e.amount,
              positive: false,
              origin: {
                actorName: actorName(e.createdBy),
                createdAt: e.createdAt ?? null,
                reason: e.source === "stock_movement" ? "Consumo registrado no estoque" : (e.category ? `Categoria: ${e.category}` : null),
                docRoute: e.docRoute, docLabel: e.docLabel,
              },
            }))}
            totalLabel={`Subtotal ${BUCKET_LABEL[bucket]}`}
            total={total}
          />
        );
      })}

      {/* Adiantamentos */}
      <FechamentoSection
        title="Adiantamentos do agendista"
        subtitle={agentId ? "Adiantamentos em aberto que serão amortizados neste fechamento" : "Vincule um agendista para listar adiantamentos."}
        emptyText="Nenhum adiantamento aplicável."
        rows={advancesForCalc.map((a) => ({
          id: a.id,
          date: a.granted_on,
          description: `Adiantamento${a.source ? ` · ${a.source}` : ""}`,
          tag: "Adiantamento",
          amount: a.amount,
          positive: false,
          origin: {
            actorName: actorName(a.createdBy),
            createdAt: a.createdAt,
            reason: a.notes ?? null,
            docRoute: agentId ? `/app/agendistas/${agentId}` : undefined,
            docLabel: agentId ? "Abrir agendista" : undefined,
          },
        }))}
        totalLabel="Subtotal adiantamentos"
        total={calc.totals.totalAdvances}
      />
    </div>
  );
}

/* ----- helpers do fechamento ----- */

function pctStr(v: number) {
  return `${Math.round((v || 0) * 1000) / 10}%`;
}

type FechRow = {
  id: string;
  date: string | null;
  description: string;
  tag: string;
  amount: number;
  positive: boolean;
  origin: {
    actorName: string;
    createdAt: string | null;
    reason: string | null;
    docRoute?: string;
    docLabel?: string;
  };
};

function FechamentoSection({
  title, subtitle, rows, emptyText, totalLabel, total,
}: {
  title: string; subtitle?: string; rows: FechRow[]; emptyText: string;
  totalLabel: string; total: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/70 px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <p className="font-serif text-lg text-foreground tabular-nums">
          {formatCurrency(total)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Data</th>
              <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
              <th className="px-4 py-2.5 text-left font-medium">Categoria</th>
              <th className="px-4 py-2.5 text-right font-medium">Valor</th>
              <th className="px-4 py-2.5 text-right font-medium">Origem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/70 hover:bg-muted/20">
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(r.date)}</td>
                <td className="px-4 py-2.5 text-foreground">{r.description}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="font-normal">{r.tag}</Badge>
                </td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums", r.positive ? "text-emerald-600" : "text-rose-600")}>
                  {r.positive ? "+" : "−"} {formatCurrency(Math.abs(r.amount))}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs">
                        <Info className="mr-1 h-3.5 w-3.5" /> Ver origem
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 text-xs">
                      <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Origem do valor</p>
                      <dl className="space-y-1.5">
                        <OriginRow label="Usuário responsável" value={r.origin.actorName} />
                        <OriginRow label="Lançado em" value={r.origin.createdAt ? `${formatDate(r.origin.createdAt)} · ${new Date(r.origin.createdAt).toTimeString().slice(0, 5)}` : "—"} />
                        <OriginRow label="Data do movimento" value={r.date ? formatDate(r.date) : "—"} />
                        {r.origin.reason && <OriginRow label="Motivo" value={r.origin.reason} />}
                      </dl>
                      {r.origin.docRoute && (
                        <Link to={r.origin.docRoute} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--gold)] hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> {r.origin.docLabel ?? "Documento"}
                        </Link>
                      )}
                    </PopoverContent>
                  </Popover>
                </td>
              </tr>
            ))}
            <tr className="border-t border-border/80 bg-muted/30 font-medium">
              <td className="px-4 py-2.5 text-muted-foreground" colSpan={3}>{totalLabel}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground" colSpan={2}>{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function OriginRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground break-words">{value}</dd>
    </div>
  );
}

function CalcKPI({ label, value, accent }: { label: string; value: number; accent: "positive" | "negative" | "muted" | "gold" }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-3 font-serif text-xl tabular-nums",
        accent === "positive" && "text-emerald-600",
        accent === "negative" && "text-rose-600",
        accent === "muted" && "text-foreground",
        accent === "gold" && "text-[var(--gold)]",
      )}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
