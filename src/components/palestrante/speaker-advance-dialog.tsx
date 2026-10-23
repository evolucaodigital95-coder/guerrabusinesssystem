import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ADVANCE_SOURCES, ADVANCE_STATUS } from "@/lib/finance-engine";

export type SpeakerAdvanceRow = {
  id?: string;
  amount?: number | string | null;
  granted_on?: string | null;
  granted_time?: string | null;
  source?: string | null;
  paid_by_label?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  status?: string | null;
  amount_amortized?: number | string | null;
};

/** Adiantamentos do PALESTRANTE — gravados com agent_id NULL, isolados da conta do agendista. */
export function SpeakerAdvanceDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  initial?: SpeakerAdvanceRow;
}) {
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);

  const [f, setF] = useState<SpeakerAdvanceRow>(
    initial ?? {
      amount: "",
      granted_on: today,
      granted_time: now,
      source: "Caixa",
      status: "aberto",
      amount_amortized: 0,
    },
  );
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!f.amount || Number(f.amount) <= 0) throw new Error("Informe o valor.");
      const payload = {
        organization_id: organizationId,
        agent_id: null,
        amount: Number(f.amount),
        granted_on: f.granted_on || today,
        granted_time: f.granted_time || null,
        source: f.source || "Outro",
        paid_by_label: f.paid_by_label?.trim() || null,
        receipt_url: f.receipt_url?.trim() || null,
        notes: f.notes?.trim() || null,
        status: f.status || "aberto",
        amount_amortized: Number(f.amount_amortized || 0),
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("advances").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("advances")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Adiantamento atualizado" : "Adiantamento registrado");
      qc.invalidateQueries({ queryKey: ["cfp-speaker-advances"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof SpeakerAdvanceRow>(k: K, v: SpeakerAdvanceRow[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar adiantamento do palestrante" : "Novo adiantamento do palestrante"}
          </DialogTitle>
          <DialogDescription>
            Lançamento exclusivo da conta do palestrante — não afeta a conta corrente dos
            agendistas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <Input
              type="number"
              step="0.01"
              value={f.amount ?? ""}
              onChange={(e) => set("amount", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input
              type="date"
              value={f.granted_on ?? ""}
              onChange={(e) => set("granted_on", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input
              type="time"
              value={f.granted_time ?? ""}
              onChange={(e) => set("granted_time", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={f.source ?? "Caixa"} onValueChange={(v) => set("source", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADVANCE_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável pelo pagamento</Label>
            <Input
              value={f.paid_by_label ?? ""}
              onChange={(e) => set("paid_by_label", e.target.value)}
              placeholder="Ex.: Caixa GBS"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "aberto"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADVANCE_STATUS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Já amortizado</Label>
            <Input
              type="number"
              step="0.01"
              value={f.amount_amortized ?? 0}
              onChange={(e) => set("amount_amortized", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Comprovante (URL)</Label>
            <Input
              value={f.receipt_url ?? ""}
              onChange={(e) => set("receipt_url", e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
