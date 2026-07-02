import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cada "Entrada" cria um lote E uma movimentação de tipo "entrada"
 * ligada ao lote. Assim mantemos rastreabilidade total.
 */
export function BatchFormDialog({
  open, onOpenChange, organizationId, userId, stockItemId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  stockItemId: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    code: "",
    initial_quantity: "",
    unit_cost: "",
    received_on: today,
    supplier: "",
    proof_url: "",
    notes: "",
  });
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const qty = Number(f.initial_quantity);
      if (!qty || qty <= 0) throw new Error("Informe uma quantidade positiva.");
      const unitCost = f.unit_cost ? Number(f.unit_cost) : null;

      const { data: batch, error: bErr } = await supabase
        .from("inventory_batches")
        .insert({
          organization_id: organizationId,
          stock_item_id: stockItemId,
          code: f.code.trim() || null,
          initial_quantity: qty,
          quantity: qty,
          unit_cost: unitCost,
          received_on: f.received_on,
          supplier: f.supplier.trim() || null,
          proof_url: f.proof_url.trim() || null,
          notes: f.notes.trim() || null,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const { error: mErr } = await supabase.from("stock_movements").insert({
        organization_id: organizationId,
        stock_item_id: stockItemId,
        batch_id: batch.id,
        kind: "entrada",
        direction: "in",
        quantity: qty,
        unit_cost: unitCost,
        total_cost: unitCost != null ? unitCost * qty : null,
        occurs_on: f.received_on,
        occurs_at: new Date(`${f.received_on}T00:00:00`).toISOString(),
        reason: "Entrada por lote",
        notes: f.notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      toast.success("Entrada registrada");
      qc.invalidateQueries({ queryKey: ["stock-batches", stockItemId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", stockItemId] });
      qc.invalidateQueries({ queryKey: ["stock-item", stockItemId] });
      qc.invalidateQueries({ queryKey: ["stock-item-metrics", stockItemId] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof typeof f>(k: K, v: string) { setF((p) => ({ ...p, [k]: v })); }
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nova entrada (lote)</DialogTitle>
          <DialogDescription>
            Cada entrada gera um lote rastreável e uma movimentação de "entrada" no histórico.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Quantidade *</Label>
            <Input type="number" step="0.001" min="0" value={f.initial_quantity} onChange={(e) => set("initial_quantity", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Valor unitário</Label>
            <Input type="number" step="0.01" value={f.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Código do lote</Label>
            <Input value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de entrada</Label>
            <Input type="date" value={f.received_on} onChange={(e) => set("received_on", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Fornecedor</Label>
            <Input value={f.supplier} onChange={(e) => set("supplier", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Comprovante (URL)</Label>
            <Input value={f.proof_url} onChange={(e) => set("proof_url", e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Registrar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
