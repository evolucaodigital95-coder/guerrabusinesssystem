import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
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
import { useAutomation } from "@/hooks/use-automation";
import { formatCurrency } from "@/lib/crm";
import { movementDirection, movementKindLabel } from "@/lib/stock";

export type EditableMovement = {
  id: string;
  stock_item_id: string | null;
  kind: string | null;
  direction: string | null;
  status: string | null;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  occurs_on: string | null;
  reason: string | null;
  notes: string | null;
  lecture_id: string | null;
  reversed_at?: string | null;
};

const NONE = "__none__";

/**
 * Correção rastreável de uma movimentação já lançada.
 * — Edição: grava o novo valor; o gatilho de auditoria (audit_log) preserva
 *   valor anterior, valor novo, usuário e data.
 * — Estorno: não apaga nada; marca a movimentação como `estornado`, devolvendo
 *   a quantidade ao estoque e removendo o custo dos cálculos da palestra.
 */
export function MovementEditDialog({
  open, onOpenChange, organizationId, userId, movement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  movement: EditableMovement | null;
}) {
  const qc = useQueryClient();
  const { emit } = useAutomation();

  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [occursOn, setOccursOn] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lectureId, setLectureId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [confirmReverse, setConfirmReverse] = useState(false);

  useEffect(() => {
    if (open && movement) {
      setQty(movement.quantity != null ? String(movement.quantity) : "");
      setUnitCost(movement.unit_cost != null ? String(movement.unit_cost) : "");
      setOccursOn(movement.occurs_on ?? new Date().toISOString().slice(0, 10));
      setReason(movement.reason ?? "");
      setNotes(movement.notes ?? "");
      setLectureId(movement.lecture_id ?? null);
      setReversalReason("");
      setConfirmReverse(false);
    }
  }, [open, movement]);

  const lectures = useQuery({
    queryKey: ["stock-lectures-select", organizationId],
    enabled: open && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures").select("id, title, scheduled_at")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dir = movement ? (movement.direction ?? movementDirection(movement.kind)) : "in";
  const isReversed = movement?.status === "estornado";

  const newTotal = useMemo(() => {
    const q = Number(qty || 0);
    const u = Number(unitCost || 0);
    return q * u;
  }, [qty, unitCost]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["stock-movements"] });
    qc.invalidateQueries({ queryKey: ["stock-items"] });
    qc.invalidateQueries({ queryKey: ["stock-item-metrics"] });
    qc.invalidateQueries({ queryKey: ["stock-item"] });
    qc.invalidateQueries({ queryKey: ["stock-batches"] });
    qc.invalidateQueries({ queryKey: ["stock-movements-all-form"] });
    if (movement?.lecture_id) {
      qc.invalidateQueries({ queryKey: ["fechamento-stock", movement.lecture_id] });
      qc.invalidateQueries({ queryKey: ["lecture-stock", movement.lecture_id] });
    }
    if (lectureId) {
      qc.invalidateQueries({ queryKey: ["fechamento-stock", lectureId] });
      qc.invalidateQueries({ queryKey: ["lecture-stock", lectureId] });
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!movement) return;
      const q = Number(qty);
      if (!q || q <= 0) throw new Error("Informe uma quantidade positiva.");
      const u = unitCost === "" ? null : Number(unitCost);
      if (u != null && u < 0) throw new Error("Preço inválido.");

      const { error } = await supabase
        .from("stock_movements")
        .update({
          quantity: q,
          unit_cost: u,
          total_cost: u != null ? Number((u * q).toFixed(2)) : null,
          occurs_on: occursOn || null,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
          lecture_id: lectureId,
          updated_by: userId,
        })
        .eq("id", movement.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação corrigida");
      invalidate();
      void emit("stock.movement.created", {
        entityType: "stock_item",
        entityId: movement?.stock_item_id ?? null,
        lectureId: lectureId ?? null,
        summary: "Movimentação de estoque corrigida",
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const reverse = useMutation({
    mutationFn: async () => {
      if (!movement) return;
      if (!reversalReason.trim()) throw new Error("Informe o motivo do estorno.");
      const { error } = await supabase
        .from("stock_movements")
        .update({
          status: "estornado",
          reversed_at: new Date().toISOString(),
          reversed_by: userId,
          reversal_reason: reversalReason.trim(),
          updated_by: userId,
        })
        .eq("id", movement.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação estornada — histórico preservado");
      invalidate();
      void emit("stock.movement.created", {
        entityType: "stock_item",
        entityId: movement?.stock_item_id ?? null,
        lectureId: movement?.lecture_id ?? null,
        summary: "Movimentação de estoque estornada",
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            Corrigir movimentação · {movementKindLabel(movement?.kind)}
          </DialogTitle>
          <DialogDescription>
            Nada é apagado. Toda correção guarda valor anterior, valor novo, usuário e data.
            Se a movimentação foi lançada por engano, use <strong>Estornar</strong>.
          </DialogDescription>
        </DialogHeader>

        {isReversed ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-300">
            Esta movimentação está <strong>estornada</strong> e não afeta mais estoque, custo ou palestra.
          </div>
        ) : (
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input type="number" step="0.001" min="0" value={qty} onChange={(e) => setQty(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Custo unitário</Label>
              <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Novo total: {formatCurrency(newTotal)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={occursOn} onChange={(e) => setOccursOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Palestra vinculada</Label>
              <Select value={lectureId ?? NONE} onValueChange={(v) => setLectureId(v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {(lectures.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Motivo</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dir === "in" ? "Fornecedor / origem" : "Motivo da saída"} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="navy" disabled={save.isPending}>
                {save.isPending ? "Salvando…" : "Salvar correção"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {!isReversed && (
          <div className="mt-2 rounded-xl border border-border bg-background/40 p-4">
            {!confirmReverse ? (
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmReverse(true)}>
                <Undo2 className="mr-1.5 h-4 w-4" /> Estornar movimentação
              </Button>
            ) : (
              <div className="space-y-2">
                <Label>Motivo do estorno *</Label>
                <Input value={reversalReason} onChange={(e) => setReversalReason(e.target.value)} placeholder="Ex.: lançamento em duplicidade" />
                <p className="text-[11px] text-muted-foreground">
                  A quantidade volta ao estoque e o custo deixa de impactar a palestra. O registro permanece marcado como ESTORNADA.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReverse(false)}>Cancelar</Button>
                  <Button type="button" size="sm" disabled={reverse.isPending} onClick={() => reverse.mutate()}>
                    {reverse.isPending ? "Estornando…" : "Confirmar estorno"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
