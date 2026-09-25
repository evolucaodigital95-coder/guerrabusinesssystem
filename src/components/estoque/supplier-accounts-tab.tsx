import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, FileDown, FileSpreadsheet, FileText, Pencil, Trash2, Wallet, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SettlementFormDialog } from "@/components/estoque/settlement-form-dialog";
import {
  aggregateBySupplier, aggregateBooks, aggregateCompanies, totalsFromAggregates,
  type Movement, type Batch, type Item, type Lecture, type Company, type Settlement,
} from "@/lib/supplier-accounts";
import {
import { useDocBrand } from "@/hooks/use-doc-brand";
  exportSupplierPDF, exportSupplierXLSX, exportSupplierCSV,
} from "@/lib/supplier-report-export";

type Season = { id: string; name: string };

const ALL = "__all__";

export function SupplierAccountsTab({
  organizationId, userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const getDocBrand = useDocBrand();
  const [seasonId, setSeasonId] = useState<string>(ALL);
  const [settleOpen, setSettleOpen] = useState(false);
  const [editing, setEditing] = useState<Settlement | null>(null);
  const [defaults, setDefaults] = useState<{ supplier?: string; seasonId?: string | null } | undefined>();
  const [confirmDel, setConfirmDel] = useState<Settlement | null>(null);

  const seasons = useQuery({
    queryKey: ["seasons-select", organizationId],
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("seasons").select("id, name")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Season[];
    },
  });

  const movements = useQuery({
    queryKey: ["stock-movements-supplier", organizationId],
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, stock_item_id, batch_id, kind, direction, status, quantity, unit_cost, total_cost, season_id, lecture_id, occurs_on")
        .eq("organization_id", organizationId).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const batches = useQuery({
    queryKey: ["inventory-batches-supplier", organizationId],
    queryFn: async (): Promise<Batch[]> => {
      const { data, error } = await supabase
        .from("inventory_batches").select("id, stock_item_id, supplier, unit_cost")
        .eq("organization_id", organizationId).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Batch[];
    },
  });

  const items = useQuery({
    queryKey: ["stock-items-supplier", organizationId],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("stock_items").select("id, name, supplier, unit, category")
        .eq("organization_id", organizationId).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const lectures = useQuery({
    queryKey: ["lectures-supplier", organizationId],
    queryFn: async (): Promise<Lecture[]> => {
      const { data, error } = await supabase
        .from("lectures").select("id, title, company_id, season_id")
        .eq("organization_id", organizationId).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Lecture[];
    },
  });

  const companies = useQuery({
    queryKey: ["companies-supplier", organizationId],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase
        .from("companies").select("id, legal_name")
        .eq("organization_id", organizationId).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const settlements = useQuery({
    queryKey: ["supplier-settlements", organizationId],
    queryFn: async (): Promise<Settlement[]> => {
      const { data, error } = await supabase
        .from("supplier_settlements")
        .select("id, supplier, season_id, amount_paid, paid_on, payment_method, receipt_number, notes, created_by, created_at")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_settlements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acerto excluído");
      qc.invalidateQueries({ queryKey: ["supplier-settlements"] });
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao excluir"),
  });

  const filteredSeasonId = seasonId === ALL ? null : seasonId;

  const aggregates = useMemo(() => aggregateBySupplier({
    movements: movements.data ?? [],
    batches: batches.data ?? [],
    items: items.data ?? [],
    settlements: settlements.data ?? [],
    seasonId: filteredSeasonId,
  }), [movements.data, batches.data, items.data, settlements.data, filteredSeasonId]);

  const totals = useMemo(() => totalsFromAggregates(aggregates), [aggregates]);

  const filteredSettlements = useMemo(() => {
    const rows = settlements.data ?? [];
    return filteredSeasonId ? rows.filter((s) => s.season_id === filteredSeasonId) : rows;
  }, [settlements.data, filteredSeasonId]);

  const seasonName =
    filteredSeasonId
      ? seasons.data?.find((s) => s.id === filteredSeasonId)?.name ?? "Temporada"
      : "Todas as temporadas";

  const buildReport = (supplier: string) => {
    const a = aggregates.find((x) => x.supplier === supplier);
    if (!a) return null;
    const books = aggregateBooks({
      movements: movements.data ?? [], batches: batches.data ?? [], items: items.data ?? [],
      seasonId: filteredSeasonId, supplier,
    });
    const comp = aggregateCompanies({
      movements: movements.data ?? [], batches: batches.data ?? [], items: items.data ?? [],
      lectures: lectures.data ?? [], companies: companies.data ?? [],
      seasonId: filteredSeasonId, supplier,
    });
    const sett = (settlements.data ?? []).filter(
      (s) => s.supplier === supplier && (!filteredSeasonId || s.season_id === filteredSeasonId),
    );
    return { supplier, seasonName, aggregate: a, books, companies: comp, settlements: sett };
  };

  const loading =
    movements.isLoading || batches.isLoading || items.isLoading ||
    lectures.isLoading || companies.isLoading || settlements.isLoading;

  return (
    <div className="space-y-6">
      {/* Cabeçalho / filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger className="rounded-full">
                <SelectValue placeholder="Temporada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as temporadas</SelectItem>
                {(seasons.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="navy" className="rounded-full"
          onClick={() => { setEditing(null); setDefaults({ seasonId: filteredSeasonId }); setSettleOpen(true); }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Registrar acerto
        </Button>
      </div>

      {/* KPIs financeiros */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Valor Comprado" value={formatCurrency(totals.purchased)} />
        <Kpi label="Valor Utilizado" value={formatCurrency(totals.used)} />
        <Kpi label="Capital em Estoque" value={formatCurrency(totals.inStock)} />
        <Kpi label="Já Acertado" value={formatCurrency(totals.settled)} />
        <Kpi
          label="Saldo a Acertar"
          value={formatCurrency(totals.balance)}
          highlight={totals.balance > 0.005}
        />
      </div>

      {/* Tabela por fornecedor */}
      <div className="rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border/60 p-4">
          <h3 className="font-serif text-lg">Fornecedores — {seasonName}</h3>
          <p className="text-xs text-muted-foreground">
            Cada linha permite exportar o relatório executivo daquele fornecedor.
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Calculando…</div>
        ) : aggregates.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma movimentação nesta temporada.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-right">Comprado</th>
                  <th className="px-4 py-3 text-right">Utilizado</th>
                  <th className="px-4 py-3 text-right">Em Estoque</th>
                  <th className="px-4 py-3 text-right">Pago</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((r) => (
                  <tr key={r.supplier} className="border-t border-border/40">
                    <td className="px-4 py-3 font-medium">{r.supplier}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.purchased)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.used)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.inStock)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.settled)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.balance > 0.005 ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                          <AlertTriangle className="mr-1 h-3 w-3" />{formatCurrency(r.balance)}
                        </Badge>
                      ) : (
                        <span className="text-emerald-400">{formatCurrency(r.balance)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => { setEditing(null); setDefaults({ supplier: r.supplier, seasonId: filteredSeasonId }); setSettleOpen(true); }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 px-2">
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={async () => { const rep = buildReport(r.supplier); if (rep) exportSupplierPDF({ ...rep, brand: await getDocBrand() }); }}>
                              <FileText className="mr-2 h-3.5 w-3.5" /> PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { const rep = buildReport(r.supplier); if (rep) exportSupplierXLSX(rep); }}>
                              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { const rep = buildReport(r.supplier); if (rep) exportSupplierCSV(rep); }}>
                              <FileDown className="mr-2 h-3.5 w-3.5" /> CSV
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detalhes por livro e por empresa (agregado geral) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BookBreakdown
          seasonId={filteredSeasonId}
          movements={movements.data ?? []}
          batches={batches.data ?? []}
          items={items.data ?? []}
        />
        <CompanyBreakdown
          seasonId={filteredSeasonId}
          movements={movements.data ?? []}
          batches={batches.data ?? []}
          items={items.data ?? []}
          lectures={lectures.data ?? []}
          companies={companies.data ?? []}
        />
      </div>

      {/* Histórico de acertos */}
      <div className="rounded-2xl border border-border bg-card/40">
        <div className="border-b border-border/60 p-4">
          <h3 className="font-serif text-lg">Histórico dos acertos</h3>
        </div>
        {filteredSettlements.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum acerto registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">Temporada</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-left">Forma</th>
                  <th className="px-4 py-3 text-left">Observação</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.map((s) => {
                  const sName = s.season_id
                    ? seasons.data?.find((x) => x.id === s.season_id)?.name ?? "—"
                    : "—";
                  return (
                    <tr key={s.id} className="border-t border-border/40">
                      <td className="px-4 py-3">{new Date(s.paid_on + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-medium">{s.supplier}</td>
                      <td className="px-4 py-3 text-muted-foreground">{sName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(s.amount_paid))}</td>
                      <td className="px-4 py-3">{s.payment_method ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.notes ?? s.receipt_number ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm" variant="ghost" className="h-8 px-2"
                            onClick={() => { setEditing(s); setDefaults(undefined); setSettleOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-8 px-2 text-destructive"
                            onClick={() => setConfirmDel(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SettlementFormDialog
        open={settleOpen}
        onOpenChange={(v) => { setSettleOpen(v); if (!v) { setEditing(null); setDefaults(undefined); } }}
        organizationId={organizationId}
        userId={userId}
        defaults={defaults}
        initial={editing}
      />
      <AlertDialog open={!!confirmDel} onOpenChange={(v: boolean) => { if (!v) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">Excluir acerto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove apenas o registro de acerto. Estoque e livro razão não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              className="bg-rose-600 hover:bg-rose-700"
              onClick={(e) => { e.preventDefault(); if (confirmDel) del.mutate(confirmDel.id); }}
            >
              {del.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card/40"}`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 font-serif text-xl tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function BookBreakdown({
  seasonId, movements, batches, items,
}: {
  seasonId: string | null;
  movements: Movement[]; batches: Batch[]; items: Item[];
}) {
  const rows = useMemo(
    () => aggregateBooks({ movements, batches, items, seasonId }).slice(0, 20),
    [movements, batches, items, seasonId],
  );
  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <div className="border-b border-border/60 p-4">
        <h3 className="font-serif text-lg">Top livros / materiais utilizados</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem utilização registrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Livro</th>
                <th className="px-4 py-3 text-right">Qtd</th>
                <th className="px-4 py-3 text-right">Custo unit.</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId} className="border-t border-border/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.supplier}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.quantity}{r.unit ? ` ${r.unit}` : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.avgUnitCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(r.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyBreakdown({
  seasonId, movements, batches, items, lectures, companies,
}: {
  seasonId: string | null;
  movements: Movement[]; batches: Batch[]; items: Item[];
  lectures: Lecture[]; companies: Company[];
}) {
  const rows = useMemo(
    () => aggregateCompanies({ movements, batches, items, lectures, companies, seasonId }).slice(0, 20),
    [movements, batches, items, lectures, companies, seasonId],
  );
  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <div className="border-b border-border/60 p-4">
        <h3 className="font-serif text-lg">Empresas que mais consumiram materiais</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Sem consumo por empresa.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.supplier}-${r.companyId ?? "n"}-${i}`} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{r.companyName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.supplier}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(r.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
