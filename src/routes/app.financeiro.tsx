import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ArrowDownRight, ArrowUpRight, Pencil, Trash2, Paperclip, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/page-shell";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import {
  MOVEMENT_DIRECTIONS, MOVEMENT_CATEGORIES, statusLabel, isSettled,
  FINANCE_TIMELINE_KINDS, ACCOUNT_KINDS, paymentMethodLabel,
} from "@/lib/finance";
import { MovementFormDialog, type MovementRow } from "@/components/finance/movement-form-dialog";
import { AccountFormDialog, type AccountRow } from "@/components/finance/account-form-dialog";
import { AttachmentsTab } from "@/components/crm/attachments-tab";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/financeiro")({
  validateSearch: (search) => ({
    lancamento: typeof search.lancamento === "string" ? search.lancamento : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Financeiro — GBS" },
      { name: "description", content: "Livro Razão, contas e movimentos." },
    ],
  }),
  component: FinancePage,
});

type Movement = {
  id: string;
  direction: string | null;
  status: string | null;
  category: string | null;
  description: string | null;
  amount: number | null;
  expected_amount: number | null;
  expected_date: string | null;
  settled_at: string | null;
  occurs_on: string | null;
  occurs_time: string | null;
  account_id: string | null;
  company_id: string | null;
  lecture_id: string | null;
  agent_id: string | null;
  season_id: string | null;
  project_id: string | null;
  payment_method: string | null;
  card_brand_id: string | null;
  card_installments: number | null;
  card_fee_percent: number | null;
  card_fee_amount: number | null;
  net_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  accounts: { id: string; name: string; kind: string | null } | null;
  companies: { id: string; legal_name: string } | null;
  lectures: { id: string; title: string } | null;
  agents: { id: string; full_name: string } | null;
  seasons: { id: string; name: string } | null;
  projects: { id: string; name: string } | null;
  card_brands: { id: string; name: string; kind: string | null } | null;
};

type Account = {
  id: string;
  name: string;
  kind: string | null;
  status: string | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
};

const ALL = "__all__";

function FinancePage() {
  const { user } = useSession();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const navigate = useNavigate({ from: Route.fullPath });
  const { lancamento } = Route.useSearch();
  const [openMov, setOpenMov] = useState(false);
  const [openAcc, setOpenAcc] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MovementRow | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [fDirection, setFDirection] = useState<string>(ALL);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [fAccount, setFAccount] = useState<string>(ALL);
  const [fCategory, setFCategory] = useState<string>(ALL);
  const [fCompany, setFCompany] = useState<string>(ALL);
  const [fAgent, setFAgent] = useState<string>(ALL);
  const [fSeason, setFSeason] = useState<string>(ALL);
  const [fProject, setFProject] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (lancamento) setSelectedId(lancamento);
  }, [lancamento]);

  const accounts = useQuery({
    queryKey: ["accounts", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, kind, status, currency, notes, created_at")
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const movements = useQuery({
    queryKey: ["movements", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select(`
          id, direction, status, category, description, amount, expected_amount,
          expected_date, settled_at, occurs_on, occurs_time,
          account_id, company_id, lecture_id, agent_id, season_id, project_id,
          payment_method, card_brand_id, card_installments, card_fee_percent, card_fee_amount, net_amount, notes,
          created_at, updated_at,
          accounts:account_id ( id, name, kind ),
          companies:company_id ( id, legal_name ),
          lectures:lecture_id ( id, title ),
          agents:agent_id ( id, full_name ),
          seasons:season_id ( id, name ),
          projects:project_id ( id, name ),
          card_brands:card_brand_id ( id, name, kind )
        `)
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("occurs_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const filtered = useMemo(() => {
    let list = movements.data ?? [];
    if (fDirection !== ALL) list = list.filter((m) => m.direction === fDirection);
    if (fStatus !== ALL) list = list.filter((m) => m.status === fStatus);
    if (fAccount !== ALL) list = list.filter((m) => m.account_id === fAccount);
    if (fCategory !== ALL) list = list.filter((m) => m.category === fCategory);
    if (dateFrom) list = list.filter((m) => (m.occurs_on ?? "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (m.occurs_on ?? "") <= dateTo);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        [
          m.description, m.category, m.notes,
          paymentMethodLabel(m.payment_method), m.card_brands?.name,
          m.accounts?.name, m.companies?.legal_name, m.lectures?.title,
          m.amount != null ? String(m.amount) : "",
          m.expected_amount != null ? String(m.expected_amount) : "",
          m.occurs_on, m.settled_at, m.expected_date,
        ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [movements.data, search, fDirection, fStatus, fAccount, fCategory, dateFrom, dateTo]);

  const totals = useMemo(() => {
    const t = { inSettled: 0, outSettled: 0, inPlanned: 0, outPlanned: 0 };
    for (const m of filtered) {
      const settled = isSettled(m.direction as "in" | "out", m.status);
      const v = Number(m.amount ?? 0);
      const e = Number(m.expected_amount ?? 0);
      if (m.direction === "in") {
        if (settled) t.inSettled += v;
        else t.inPlanned += e || v;
      } else if (m.direction === "out") {
        if (settled) t.outSettled += v;
        else t.outPlanned += e || v;
      }
    }
    return t;
  }, [filtered]);

  const openMovement = (id: string) => {
    setSelectedId(id);
    navigate({ search: { lancamento: id } });
  };

  const closeMovement = () => {
    setSelectedId(null);
    navigate({ search: { lancamento: undefined } });
  };

  const selected = selectedId ? filtered.find((m) => m.id === selectedId) ?? movements.data?.find((m) => m.id === selectedId) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Financeiro"
        title="Livro Razão"
        description="Toda informação financeira é derivada de movimentos. Nada é apagado — apenas arquivado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setEditingAccount(null); setOpenAcc(true); }} disabled={!organizationId}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova conta
            </Button>
            <Button variant="navy" className="rounded-full" onClick={() => { setEditing(null); setOpenMov(true); }} disabled={!organizationId}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo lançamento
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList className="bg-card/40">
          <TabsTrigger value="ledger">Movimentos</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-6">
          {/* Totals */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Entradas realizadas" value={formatCurrency(totals.inSettled)} accent="positive" />
            <SummaryCard label="Saídas realizadas" value={formatCurrency(totals.outSettled)} accent="negative" />
            <SummaryCard label="Entradas previstas" value={formatCurrency(totals.inPlanned)} muted />
            <SummaryCard label="Saídas previstas" value={formatCurrency(totals.outPlanned)} muted />
          </div>

          {/* Filters */}
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar valor, empresa, palestra, categoria, conta…" className="rounded-full pl-9" />
              </div>
              <div className="md:col-span-2">
                <Select value={fDirection} onValueChange={setFDirection}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os tipos</SelectItem>
                    {MOVEMENT_DIRECTIONS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os status</SelectItem>
                    {["previsto", "parcial", "recebido", "cancelado", "prevista", "paga", "cancelada"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={fAccount} onValueChange={setFAccount}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Conta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as contas</SelectItem>
                    {(accounts.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Select value={fCategory} onValueChange={setFCategory}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as categorias</SelectItem>
                    {MOVEMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-full" />
              </div>
              <div className="md:col-span-2">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-full" />
              </div>
            </div>
          </div>

          {/* Table */}
          {orgLoading || movements.isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
              <h3 className="font-serif text-2xl text-foreground">Nenhum lançamento</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {(movements.data?.length ?? 0) > 0 ? "Ajuste os filtros." : "Crie o primeiro lançamento do Livro Razão."}
              </p>
              <Button variant="navy" className="mt-6 rounded-full" onClick={() => { setEditing(null); setOpenMov(true); }} disabled={!organizationId}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo lançamento
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Data</th>
                    <th className="px-4 py-3 text-left font-medium">Descrição</th>
                    <th className="px-4 py-3 text-left font-medium">Categoria</th>
                    <th className="px-4 py-3 text-left font-medium">Conta</th>
                    <th className="px-4 py-3 text-left font-medium">Empresa</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => {
                    const isIn = m.direction === "in";
                    const settled = isSettled(m.direction as "in" | "out", m.status);
                    const value = settled ? m.amount : m.expected_amount;
                    return (
                      <tr
                        key={m.id}
                         onClick={() => openMovement(m.id)}
                        className="cursor-pointer border-t border-border/70 transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          <div>{formatDate(m.occurs_on)}</div>
                          {m.occurs_time && <div className="text-[10px] uppercase tracking-[0.18em]">{m.occurs_time.slice(0, 5)}</div>}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "grid h-6 w-6 place-items-center rounded-full",
                              isIn ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600",
                            )}>
                              {isIn ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            </span>
                            <span className="font-medium text-foreground">{m.description ?? "—"}</span>
                          </div>
                          {m.lectures?.title && <p className="mt-1 pl-8 text-xs text-muted-foreground">{m.lectures.title}</p>}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{m.category ?? "—"}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{m.accounts?.name ?? "—"}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{m.companies?.legal_name ?? "—"}</td>
        <td className={cn(
                          "px-4 py-3 align-top text-right font-medium tabular-nums",
                          isIn ? "text-emerald-600" : "text-rose-600",
                        )}>
          <div>{isIn ? "+" : "−"} {formatCurrency(Number(value ?? 0))}</div>
          {isIn && Number(m.card_fee_amount ?? 0) > 0 && (
            <div className="text-[10px] font-normal text-muted-foreground">
              líquido {formatCurrency(Number(m.net_amount ?? 0))}
            </div>
          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-block cursor-default"
                            aria-label="Status (indicador visual)"
                          >
                            <Badge variant="outline" className="font-normal pointer-events-none select-none">
                              {statusLabel(m.direction as "in" | "out", m.status)}
                            </Badge>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsTab
            accounts={accounts.data ?? []}
            loading={accounts.isLoading}
            onEdit={(a) => { setEditingAccount(a); setOpenAcc(true); }}
            onNew={() => { setEditingAccount(null); setOpenAcc(true); }}
          />
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <>
          <MovementFormDialog
            open={openMov}
            onOpenChange={(v) => { setOpenMov(v); if (!v) setEditing(null); }}
            organizationId={organizationId}
            userId={user.id}
            initial={editing ?? undefined}
          />
          <AccountFormDialog
            open={openAcc}
            onOpenChange={(v) => { setOpenAcc(v); if (!v) setEditingAccount(null); }}
            organizationId={organizationId}
            userId={user.id}
            initial={editingAccount ?? undefined}
          />
        </>
      )}

      {organizationId && user && (
        <MovementSheet
          movement={selected ?? null}
          organizationId={organizationId}
          userId={user.id}
          onClose={closeMovement}
          onEdit={(m) => { closeMovement(); setEditing(m); setOpenMov(true); }}
        />
      )}
    </div>
  );
}

/* ---------------- Summary card ---------------- */

function SummaryCard({ label, value, accent, muted }: { label: string; value: string; accent?: "positive" | "negative"; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-3 font-serif text-2xl tabular-nums",
        accent === "positive" && "text-emerald-600",
        accent === "negative" && "text-rose-600",
        muted && "text-muted-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}

/* ---------------- Accounts tab ---------------- */

function AccountsTab({
  accounts, loading, onEdit, onNew,
}: { accounts: Account[]; loading: boolean; onEdit: (a: Account) => void; onNew: () => void }) {
  if (loading) return <ListSkeleton />;
  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
        <h3 className="font-serif text-2xl text-foreground">Nenhuma conta cadastrada</h3>
        <p className="mt-2 text-sm text-muted-foreground">Crie contas como Caixa, Banco, PIX, InfinitePay, Cartão, Sócios.</p>
        <Button variant="navy" className="mt-6 rounded-full" onClick={onNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova conta
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => onEdit(a)}
          className="rounded-2xl border border-border bg-card/40 p-5 text-left transition-colors hover:bg-card/70"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{a.name}</p>
              {a.kind && <p className="mt-0.5 text-xs text-muted-foreground">{a.kind}</p>}
            </div>
            <Badge variant={a.status === "ativa" ? "secondary" : "outline"} className="font-normal">
              {a.status ?? "ativa"}
            </Badge>
          </div>
          {a.notes && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>}
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{ACCOUNT_KINDS.includes(a.kind as (typeof ACCOUNT_KINDS)[number]) ? a.kind : "Conta"} · {a.currency ?? "BRL"}</p>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Movement detail sheet ---------------- */

function MovementSheet({
  movement, organizationId, userId, onClose, onEdit,
}: {
  movement: Movement | null;
  organizationId: string;
  userId: string;
  onClose: () => void;
  onEdit: (m: Movement) => void;
}) {
  const queryClient = useQueryClient();

  const archive = useMutation({
    mutationFn: async () => {
      if (!movement) return;
      const { error } = await supabase.from("financial_movements")
        .update({ archived_at: new Date().toISOString(), updated_by: userId }).eq("id", movement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento arquivado");
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const hardDelete = useMutation({
    mutationFn: async () => {
      if (!movement) return;
      const { error } = await supabase.from("financial_movements").delete().eq("id", movement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const settle = useMutation({
    mutationFn: async () => {
      if (!movement) return;
      const newStatus = movement.direction === "in" ? "recebido" : "paga";
      const newAmount = movement.amount ?? movement.expected_amount;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("financial_movements").update({
        status: newStatus,
        amount: newAmount,
        settled_at: movement.settled_at ?? today,
        updated_by: userId,
      }).eq("id", movement.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liquidação registrada");
      queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const attachmentEvents = useQuery({
    queryKey: ["movement-attachment-events", movement?.id],
    enabled: !!movement,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, created_at")
        .eq("entity_type", "financial_movement")
        .eq("entity_id", movement!.id)
        .is("archived_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const timeline = useMemo(() => {
    if (!movement) return [] as { at: string; title: string; subtitle?: string }[];
    const items: { at: string; title: string; subtitle?: string }[] = [];
    const isIn = movement.direction === "in";
    items.push({
      at: movement.created_at,
      title: isIn ? "Receita criada" : "Despesa criada",
      subtitle: movement.description ?? undefined,
    });
    (attachmentEvents.data ?? []).forEach((a) => {
      items.push({ at: a.created_at, title: "Comprovante anexado" });
    });
    if (isSettled(movement.direction as "in" | "out", movement.status)) {
      items.push({
        at: movement.settled_at ?? movement.updated_at,
        title: isIn ? "Pagamento recebido" : "Pagamento efetuado",
        subtitle: formatCurrency(Number(movement.amount ?? 0)),
      });
    }
    if (movement.status === "cancelado" || movement.status === "cancelada") {
      items.push({ at: movement.updated_at, title: "Lançamento cancelado" });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [movement, attachmentEvents.data]);

  const open = !!movement;
  if (!movement) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const isIn = movement.direction === "in";
  const settled = isSettled(movement.direction as "in" | "out", movement.status);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetDescription className="text-[10px] uppercase tracking-[0.22em]">
            {isIn ? "Receita" : "Despesa"} · {movement.category ?? "—"}
          </SheetDescription>
          <SheetTitle className="font-serif text-2xl">{movement.description ?? "—"}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Valor previsto" value={formatCurrency(Number(movement.expected_amount ?? 0))} />
              <Field
                label={isIn ? "Valor recebido" : "Valor pago"}
                value={formatCurrency(Number(movement.amount ?? 0))}
                accent={isIn ? "positive" : "negative"}
              />
              <Field label="Data prevista" value={formatDate(movement.expected_date)} />
              <Field label={isIn ? "Recebido em" : "Pago em"} value={formatDate(movement.settled_at)} />
              <Field label="Data efetiva" value={`${formatDate(movement.occurs_on)}${movement.occurs_time ? ` ${movement.occurs_time.slice(0, 5)}` : ""}`} />
              <Field label="Status" value={statusLabel(movement.direction as "in" | "out", movement.status)} />
              <Field label="Conta" value={movement.accounts?.name ?? "—"} />
              <Field label="Forma" value={paymentMethodLabel(movement.payment_method)} />
              {isIn && Number(movement.card_fee_amount ?? 0) > 0 && (
                <>
                  <Field label="Bandeira" value={movement.card_brands?.name ?? "—"} />
                  <Field label="Parcelas" value={`${movement.card_installments ?? 1}x`} />
                  <Field label="Juros cartão" value={`${Number(movement.card_fee_percent ?? 0).toLocaleString("pt-BR")}%`} accent="negative" />
                  <Field label="Taxa descontada" value={formatCurrency(Number(movement.card_fee_amount ?? 0))} accent="negative" />
                  <Field label="Valor líquido" value={formatCurrency(Number(movement.net_amount ?? 0))} accent="positive" />
                </>
              )}
              <FieldLink
                label="Empresa"
                value={movement.companies?.legal_name ?? (movement.company_id ? "Registro arquivado" : "—")}
                to={movement.companies?.id ? { route: "/app/crm/$id", id: movement.companies.id } : undefined}
                onNavigate={onClose}
              />
              <FieldLink
                label="Palestra"
                value={movement.lectures?.title ?? (movement.lecture_id ? "Registro arquivado" : "—")}
                to={movement.lectures?.id ? { route: "/app/palestras/$id", id: movement.lectures.id } : undefined}
                onNavigate={onClose}
              />
              <FieldLink
                label="Agendista"
                value={movement.agents?.full_name ?? (movement.agent_id ? "Registro arquivado" : "—")}
                to={movement.agents?.id ? { route: "/app/agendistas/$id", id: movement.agents.id } : undefined}
                onNavigate={onClose}
              />
              <FieldLink
                label="Temporada"
                value={movement.seasons?.name ?? (movement.season_id ? "Registro arquivado" : "—")}
                to={movement.seasons?.id ? { route: "/app/temporadas/$id", id: movement.seasons.id } : undefined}
                onNavigate={onClose}
              />
              <FieldLink
                label="Projeto"
                value={movement.projects?.name ?? (movement.project_id ? "Registro arquivado" : "—")}
                to={movement.projects?.id ? { route: "/app/projetos/$id", id: movement.projects.id } : undefined}
                onNavigate={onClose}
              />

            </div>
            {movement.notes && (
              <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">{movement.notes}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(movement)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            {!settled && (
              <Button variant="navy" size="sm" onClick={() => settle.mutate()} disabled={settle.isPending}>
                {isIn ? "Marcar como recebido" : "Marcar como pago"}
              </Button>
            )}
            <ConfirmDialog
              title="Arquivar este lançamento?"
              description="O registro deixará de aparecer nas listagens, mas será preservado para auditoria."
              confirmLabel="Arquivar"
              pending={archive.isPending}
              onConfirm={() => archive.mutate()}
              trigger={
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
                </Button>
              }
            />
            <ConfirmDialog
              title="Excluir permanentemente?"
              description="Esta ação remove o lançamento definitivamente do Livro Razão e não pode ser desfeita. Prefira arquivar sempre que possível."
              confirmLabel="Excluir definitivamente"
              pending={hardDelete.isPending}
              onConfirm={() => hardDelete.mutate()}
              trigger={
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                </Button>
              }
            />
          </div>

          <Tabs defaultValue="attachments">
            <TabsList className="bg-card/40">
              <TabsTrigger value="attachments">
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Comprovantes
              </TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="attachments" className="mt-4">
              <AttachmentsTab
                entityType="financial_movement"
                entityId={movement.id}
                organizationId={organizationId}
                userId={userId}
              />
            </TabsContent>
            <TabsContent value="timeline" className="mt-4">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem eventos.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-6">
                  {timeline.map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-[var(--navy)]" />
                      <p className="text-sm text-foreground">{e.title}</p>
                      {e.subtitle && <p className="text-xs text-muted-foreground">{e.subtitle}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {formatDate(e.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Eventos previstos: {FINANCE_TIMELINE_KINDS.map((k) => k.label).join(" · ")}
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-sm text-foreground tabular-nums",
        accent === "positive" && "text-emerald-600",
        accent === "negative" && "text-rose-600",
      )}>
        {value}
      </p>
    </div>
  );
}

type LinkTarget =
  | { route: "/app/crm/$id"; id: string }
  | { route: "/app/palestras/$id"; id: string }
  | { route: "/app/agendistas/$id"; id: string }
  | { route: "/app/temporadas/$id"; id: string }
  | { route: "/app/projetos/$id"; id: string };

function FieldLink({ label, value, to, onNavigate }: { label: string; value: string; to?: LinkTarget; onNavigate?: () => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {to ? (
        <Link to={to.route} params={{ id: to.id }} onClick={() => onNavigate?.()} className="mt-1 block text-sm text-foreground underline-offset-2 hover:underline">
          {value}
        </Link>
      ) : (
        <p className="mt-1 text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}

