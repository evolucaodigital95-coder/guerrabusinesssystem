import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  MOVEMENT_KINDS, RESERVATION_STATUS, movementDirection, type MovementKind,
} from "@/lib/stock";

const NONE = "__none__";

export type MovementRow = {
  id?: string;
  stock_item_id?: string | null;
  batch_id?: string | null;
  kind?: string | null;
  status?: string | null;
  quantity?: number | string | null;
  unit_cost?: number | string | null;
  occurs_on?: string | null;
  occurs_at?: string | null;
  lecture_id?: string | null;
  season_id?: string | null;
  project_id?: string | null;
  reason?: string | null;
  notes?: string | null;
};

export function MovementFormDialog({
  open, onOpenChange, organizationId, userId, stockItemId, lockedItem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  /** Quando aberto a partir do detalhe, o item vem fixado. */
  stockItemId?: string;
  lockedItem?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const [f, setF] = useState<MovementRow>({
    stock_item_id: stockItemId ?? null,
    kind: "saida",
    status: "utilizado",
    quantity: "",
    occurs_on: today,
    occurs_at: `${today}T${nowTime}`,
  });
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["stock-items-select", organizationId],
    enabled: !lockedItem,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items").select("id, name, unit")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentItem = useQuery({
    queryKey: ["stock-item-cost", f.stock_item_id],
    enabled: !!f.stock_item_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit, average_cost, purchase_price")
        .eq("id", f.stock_item_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const batches = useQuery({
    queryKey: ["stock-batches-select", f.stock_item_id],
    enabled: !!f.stock_item_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("id, code, received_on, quantity, unit_cost")
        .eq("stock_item_id", f.stock_item_id!)
        .is("archived_at", null)
        .order("received_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const lectures = useQuery({
    queryKey: ["stock-lectures-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures").select("id, title")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const seasons = useQuery({
    queryKey: ["stock-seasons-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons").select("id, name")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const projects = useQuery({
    queryKey: ["stock-projects-select", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("id, name")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!f.stock_item_id) throw new Error("Selecione o item.");
      const qty = Number(f.quantity);
      if (!qty || qty <= 0) throw new Error("Informe a quantidade.");
      const kind = (f.kind ?? "saida") as MovementKind;
      const unitCost = f.unit_cost !== "" && f.unit_cost != null ? Number(f.unit_cost) : null;
      const status =
        kind === "reserva" ? (f.status ?? "reservado") :
        kind === "cancelamento" ? "cancelado" :
        f.status || null;

      const { error } = await supabase.from("stock_movements").insert({
        organization_id: organizationId,
        stock_item_id: f.stock_item_id,
        batch_id: f.batch_id || null,
        kind,
        direction: movementDirection(kind),
        status,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: unitCost != null ? unitCost * qty : null,
        occurs_on: f.occurs_on || today,
        occurs_at: f.occurs_at ? new Date(f.occurs_at).toISOString() : new Date().toISOString(),
        lecture_id: f.lecture_id || null,
        season_id: f.season_id || null,
        project_id: f.project_id || null,
        reason: f.reason?.trim() || null,
        notes: f.notes?.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      if (f.stock_item_id) qc.invalidateQueries({ queryKey: ["stock-item", f.stock_item_id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof MovementRow>(k: K, v: MovementRow[K]) { setF((p) => ({ ...p, [k]: v })); }
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  const kind = (f.kind ?? "saida") as MovementKind;
  const isReserva = kind === "reserva";
  const selectedBatch = (batches.data ?? []).find((b) => b.id === f.batch_id);
  const estimatedUnitCost = Number(
    f.unit_cost || selectedBatch?.unit_cost || currentItem.data?.average_cost || currentItem.data?.purchase_price || 0,
  );
  const estimatedTotal = estimatedUnitCost * Number(f.quantity || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova movimentação</DialogTitle>
          <DialogDescription>
            Entrada, saída, reserva, baixa, devolução, ajuste ou cancelamento. Tudo fica registrado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {!lockedItem && (
            <div className="space-y-1.5 md:col-span-3">
              <Label>Item *</Label>
              <Select value={f.stock_item_id ?? ""} onValueChange={(v) => { set("stock_item_id", v); set("batch_id", null); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar item" /></SelectTrigger>
                <SelectContent>
                  {(items.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}{i.unit ? ` · ${i.unit}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={kind} onValueChange={(v) => {
              const next = v as MovementKind;
              setF((p) => ({
                ...p,
                kind: next,
                status: next === "reserva" ? "reservado" : next === "cancelamento" ? "cancelado" : "utilizado",
              }));
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOVEMENT_KINDS.map((k) => <SelectItem key={k.key} value={k.key}>{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade *</Label>
            <Input type="number" step="0.001" min="0" value={f.quantity ?? ""} onChange={(e) => set("quantity", e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>Valor unitário</Label>
            <Input
              type="number"
              step="0.01"
              value={f.unit_cost ?? ""}
              onChange={(e) => set("unit_cost", e.target.value)}
              placeholder={estimatedUnitCost ? `Auto: ${money(estimatedUnitCost)}` : "Auto pelo lote/item"}
            />
            {kind !== "entrada" && estimatedTotal > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Custo estimado que entrará no fechamento: {money(estimatedTotal)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={f.occurs_on ?? ""} onChange={(e) => set("occurs_on", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Data/hora exata</Label>
            <Input type="datetime-local" value={f.occurs_at ?? ""} onChange={(e) => set("occurs_at", e.target.value)} />
          </div>

          {isReserva && (
            <div className="space-y-1.5 md:col-span-3">
              <Label>Status da reserva</Label>
              <Select value={f.status ?? "reservado"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESERVATION_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Lote</Label>
            <Select value={f.batch_id ?? NONE} onValueChange={(v) => set("batch_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sem lote" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem lote</SelectItem>
                {(batches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.code ?? b.id.slice(0, 6)} · {b.received_on ?? "—"} · {b.quantity ?? 0}{b.unit_cost ? ` · ${money(Number(b.unit_cost))}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Palestra</Label>
            <Select value={f.lecture_id ?? NONE} onValueChange={(v) => set("lecture_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(lectures.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Temporada</Label>
            <Select value={f.season_id ?? NONE} onValueChange={(v) => set("season_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(seasons.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Projeto</Label>
            <Select value={f.project_id ?? NONE} onValueChange={(v) => set("project_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {(projects.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Motivo</Label>
            <Input value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function money(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
