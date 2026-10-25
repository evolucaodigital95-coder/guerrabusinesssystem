import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Minus,
  Layers,
  Package,
  AlertTriangle,
  MapPin,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditHistory } from "@/components/shared/audit-history";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { calcOnHand, isVoidMovement, movementKindLabel, reservationStatusLabel } from "@/lib/stock";
import { ItemFormDialog, type ItemRow } from "@/components/estoque/item-form-dialog";
import { BatchFormDialog } from "@/components/estoque/batch-form-dialog";
import { MovementFormDialog } from "@/components/estoque/movement-form-dialog";
import {
  MovementEditDialog,
  type EditableMovement,
} from "@/components/estoque/movement-edit-dialog";
import { AttachmentsTab } from "@/components/shared/attachments-tab";
import { NotesTab } from "@/components/shared/notes-tab";
import { ArchiveButton } from "@/components/shared/archive-button";

export const Route = createFileRoute("/app/estoque/$id")({
  head: () => ({
    meta: [
      { title: "Item de estoque — GBS" },
      {
        name: "description",
        content: "Detalhe do item: saldo, lotes, movimentações, anexos e notas.",
      },
    ],
  }),
  component: ItemDetail,
});

type Movement = {
  id: string;
  kind: string | null;
  direction: string | null;
  status: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  occurs_on: string | null;
  occurs_at: string | null;
  reason: string | null;
  notes: string | null;
  batch_id: string | null;
  lecture_id: string | null;
  season_id: string | null;
  project_id: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  lectures: { id: string; title: string } | null;
};

type Batch = {
  id: string;
  code: string | null;
  initial_quantity: number | null;
  quantity: number | null;
  unit_cost: number | null;
  received_on: string | null;
  supplier: string | null;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
};

type StockMetrics = {
  total_purchased: number | null;
  total_used: number | null;
  total_used_cost: number | null;
  last_movement_at: string | null;
};

function ItemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const [editOpen, setEditOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [mvtOpen, setMvtOpen] = useState(false);
  const [mvtType, setMvtType] = useState<"entrada" | "saida_palestra">("entrada");
  const [editingMvt, setEditingMvt] = useState<EditableMovement | null>(null);

  const item = useQuery({
    queryKey: ["stock-item", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select(
          "id, name, sku, category, unit, status, min_quantity, average_cost, purchase_price, supplier, location, description, notes, photo_url, organization_id, created_at, updated_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const movements = useQuery({
    queryKey: ["stock-movements", id],
    enabled: !!id,
    queryFn: async (): Promise<Movement[]> => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("stock_movements")
          .select(
            `
          id, kind, direction, status, quantity, unit_cost, total_cost,
          occurs_on, occurs_at, reason, notes,
          batch_id, lecture_id, season_id, project_id,
          reversed_at, reversal_reason,
          lectures:lecture_id ( id, title )
        `,
          )

          .eq("stock_item_id", id)
          .is("archived_at", null)
          .order("occurs_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
      );
      if (error) throw error;
      return (data ?? []) as unknown as Movement[];
    },
  });

  const batches = useQuery({
    queryKey: ["stock-batches", id],
    enabled: !!id,
    queryFn: async (): Promise<Batch[]> => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("inventory_batches")
          .select(
            "id, code, initial_quantity, quantity, unit_cost, received_on, supplier, proof_url, notes, created_at",
          )
          .eq("stock_item_id", id)
          .is("archived_at", null)
          .order("received_on", { ascending: false, nullsFirst: false }),
      );
      if (error) throw error;
      return (data ?? []) as Batch[];
    },
  });

  const metrics = useQuery({
    queryKey: ["stock-item-metrics", id],
    enabled: !!id,
    queryFn: async (): Promise<StockMetrics | null> => {
      const { data, error } = await supabase
        .from("stock_item_metrics")
        .select("total_purchased, total_used, total_used_cost, last_movement_at")
        .eq("stock_item_id", id)
        .maybeSingle();
      if (error) throw error;
      return data as StockMetrics | null;
    },
  });

  const balance = useMemo(() => calcOnHand(movements.data ?? []), [movements.data]);

  // Palestras vinculadas (reservas + utilizações)
  const lectureGroups = useMemo(() => {
    const groups = new Map<string, { title: string; reserved: number; used: number }>();
    for (const m of movements.data ?? []) {
      if (!m.lectures) continue;
      const g = groups.get(m.lectures.id) ?? { title: m.lectures.title, reserved: 0, used: 0 };
      const q = Number(m.quantity ?? 0);
      if (isVoidMovement(m.status, m.kind)) continue;
      if (m.kind === "reserva" && m.status !== "utilizado") g.reserved += q;
      else if (m.direction === "out") g.used += q;
      groups.set(m.lectures.id, g);
    }
    return Array.from(groups.entries()).map(([id, v]) => ({ id, ...v }));
  }, [movements.data]);

  if (item.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!item.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate({ to: "/app/estoque" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <p className="text-muted-foreground">Item não encontrado.</p>
      </div>
    );
  }

  const it = item.data;
  const min = Number(it.min_quantity ?? 0);
  const low = min > 0 && balance.onHand <= min;
  const cost = Number(it.average_cost ?? it.purchase_price ?? 0);
  const stockValue = balance.onHand * cost;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/app/estoque"
          className="inline-flex items-center text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Estoque
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMvtType("entrada");
              setMvtOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Entrada
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMvtType("saida_palestra");
              setMvtOpen(true);
            }}
          >
            <Minus className="mr-1.5 h-4 w-4" /> Saída
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setBatchOpen(true)}
          >
            <Layers className="mr-1.5 h-4 w-4" /> Lote
          </Button>

          <ArchiveButton
            table="stock_items"
            id={id}
            label="este item"
            listQueryKey="stock-items"
            backTo="/app/estoque"
          />
          <Button variant="brand" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <PageHeader
        eyebrow={it.category ?? "Item"}
        title={it.name}
        description={it.description ?? "—"}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-2xl border border-border bg-card/40 p-5">
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-background/40 flex items-center justify-center">
            {it.photo_url ? (
              <img src={it.photo_url} alt={it.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Field label="SKU" value={it.sku ?? "—"} />
            <Field label="Unidade" value={it.unit ?? "—"} />
            <Field label="Status" value={it.status ?? "ativo"} />
            <Field label="Mínimo" value={min ? String(min) : "—"} />
            <Field label="Valor compra" value={formatCurrency(it.purchase_price)} />
            <Field label="Valor médio" value={formatCurrency(it.average_cost)} />
            <Field
              label="Fornecedor"
              value={it.supplier ?? "—"}
              icon={<Truck className="h-3 w-3" />}
            />
            <Field
              label="Localização"
              value={it.location ?? "—"}
              icon={<MapPin className="h-3 w-3" />}
            />
          </dl>
        </div>

        <div className="lg:col-span-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 self-start">
          <BigStat
            label="Em estoque"
            value={`${balance.onHand}${it.unit ? ` ${it.unit}` : ""}`}
            highlight={low}
          />
          <BigStat label="Reservado" value={String(balance.reserved)} muted />
          <BigStat label="Disponível" value={String(balance.available)} />
          <BigStat
            label="Total comprado"
            value={`${Number(metrics.data?.total_purchased ?? 0)}${it.unit ? ` ${it.unit}` : ""}`}
          />
          <BigStat
            label="Total utilizado"
            value={`${Number(metrics.data?.total_used ?? 0)}${it.unit ? ` ${it.unit}` : ""}`}
          />
          <BigStat
            label="Última movimentação"
            value={metrics.data?.last_movement_at ? formatDate(metrics.data.last_movement_at) : "—"}
            muted
          />
          <BigStat label="Lotes ativos" value={String((batches.data ?? []).length)} muted />
          <BigStat label="Movimentações" value={String((movements.data ?? []).length)} muted />
          <BigStat label="Valor em estoque" value={formatCurrency(stockValue)} />

          {(low || !it.supplier) && (
            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-1.5">
              {low && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Estoque abaixo do mínimo
                </Badge>
              )}
              {!it.supplier && (
                <Badge variant="outline" className="text-muted-foreground">
                  Sem fornecedor padrão
                </Badge>
              )}
              {(movements.data ?? []).length === 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  Sem movimentação
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="movimentos" className="space-y-4">
        <TabsList className="rounded-full">
          <TabsTrigger value="movimentos">Movimentações</TabsTrigger>
          <TabsTrigger value="lotes">Lotes</TabsTrigger>
          <TabsTrigger value="palestras">Palestras</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentos">
          {(movements.data ?? []).length === 0 ? (
            <Empty
              title="Nenhuma movimentação"
              hint="Registre uma entrada, saída ou reserva para iniciar o histórico."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo / Palestra</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movements.data ?? []).map((m) => {
                    const voided = isVoidMovement(m.status, m.kind);
                    return (
                      <TableRow key={m.id} className={voided ? "opacity-55" : undefined}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {m.occurs_at ? formatDate(m.occurs_at) : formatDate(m.occurs_on)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {movementKindLabel(m.kind)}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          <span
                            className={
                              voided
                                ? "line-through text-muted-foreground"
                                : m.direction === "in"
                                  ? "text-emerald-300"
                                  : "text-foreground"
                            }
                          >
                            {m.direction === "in" ? "+" : "−"}
                            {m.quantity}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`text-xs ${voided ? "line-through text-muted-foreground" : ""}`}
                        >
                          {formatCurrency(m.total_cost)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {m.lectures ? (
                            <Link
                              to="/app/palestras/$id"
                              params={{ id: m.lectures.id }}
                              className="hover:underline"
                            >
                              {m.lectures.title}
                            </Link>
                          ) : (
                            (m.reason ?? "—")
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {reservationStatusLabel(m.status)}
                          {m.reversal_reason && (
                            <div className="text-[10px] text-amber-500/80">{m.reversal_reason}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() =>
                              setEditingMvt({ ...m, stock_item_id: id } as EditableMovement)
                            }
                          >
                            <Pencil className="mr-1 h-3 w-3" /> {voided ? "Ver" : "Corrigir"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lotes">
          {(batches.data ?? []).length === 0 ? (
            <Empty title="Nenhum lote" hint="Cada entrada de estoque gera um lote rastreável." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Inicial</TableHead>
                    <TableHead>Disponível</TableHead>
                    <TableHead>Custo un.</TableHead>
                    <TableHead>Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batches.data ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(b.received_on)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {b.code ?? b.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {b.initial_quantity ?? b.quantity ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{b.quantity ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatCurrency(b.unit_cost)}</TableCell>
                      <TableCell className="text-xs">{b.supplier ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="palestras">
          {lectureGroups.length === 0 ? (
            <Empty
              title="Nenhuma palestra vinculada"
              hint="Reserve ou utilize este item em uma palestra para vê-la aqui."
            />
          ) : (
            <ul className="space-y-2">
              {lectureGroups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card/40 px-5 py-4"
                >
                  <Link
                    to="/app/palestras/$id"
                    params={{ id: g.id }}
                    className="font-medium hover:underline"
                  >
                    {g.title}
                  </Link>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      Reservado{" "}
                      <strong className="text-foreground tabular-nums">{g.reserved}</strong>
                    </span>
                    <span>
                      Utilizado <strong className="text-foreground tabular-nums">{g.used}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="anexos">
          {organizationId && user && (
            <AttachmentsTab
              entityType="stock_item"
              entityId={id}
              organizationId={organizationId}
              userId={user.id}
            />
          )}
        </TabsContent>

        <TabsContent value="notas">
          {organizationId && user && (
            <NotesTab
              entityType="stock_item"
              entityId={id}
              organizationId={organizationId}
              userId={user.id}
            />
          )}
        </TabsContent>
        <TabsContent value="historico">
          <AuditHistory
            organizationId={it.organization_id}
            entityIds={[it.id, ...(movements.data ?? []).map((m) => m.id)]}
          />
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <>
          <ItemFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            organizationId={organizationId}
            userId={user.id}
            initial={it as ItemRow}
          />
          <BatchFormDialog
            open={batchOpen}
            onOpenChange={setBatchOpen}
            organizationId={organizationId}
            userId={user.id}
            stockItemId={id}
          />
          <MovementFormDialog
            key={mvtType}
            open={mvtOpen}
            onOpenChange={setMvtOpen}
            organizationId={organizationId}
            userId={user.id}
            stockItemId={id}
            lockedItem
            defaultType={mvtType}
          />
          <MovementEditDialog
            open={!!editingMvt}
            onOpenChange={(v) => !v && setEditingMvt(null)}
            organizationId={organizationId}
            userId={user.id}
            movement={editingMvt}
          />
        </>
      )}
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
        {icon}
        {value}
      </dd>
    </div>
  );
}

function BigStat({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border ${highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card/40"} p-5`}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-3 font-serif text-2xl tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/20 px-8 py-12 text-center">
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
