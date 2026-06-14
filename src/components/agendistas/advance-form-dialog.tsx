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
import { ADVANCE_SOURCES, ADVANCE_STATUS } from "@/lib/finance-engine";

export type AdvanceRow = {
  id?: string;
  agent_id?: string | null;
  amount?: number | string | null;
  granted_on?: string | null;
  granted_time?: string | null;
  source?: string | null;
  paid_by_label?: string | null;
  paid_by_user_id?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  status?: string | null;
  lecture_id?: string | null;
  amount_amortized?: number | string | null;
};

const NONE = "__none__";

export function AdvanceFormDialog({
  open, onOpenChange, organizationId, userId, agentId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  agentId: string;
  initial?: AdvanceRow;
}) {
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);

  const [f, setF] = useState<AdvanceRow>(
    initial ?? {
      amount: "",
      granted_on: today,
      granted_time: now,
      source: "PIX",
      status: "aberto",
      amount_amortized: 0,
    },
  );
  const queryClient = useQueryClient();

  const lectures = useQuery({
    queryKey: ["agent-lectures-select", organizationId, agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures").select("id, title")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!f.amount || Number(f.amount) <= 0) throw new Error("Informe o valor.");
      const payload = {
        organization_id: organizationId,
        agent_id: agentId,
        amount: Number(f.amount),
        granted_on: f.granted_on || today,
        granted_time: f.granted_time || null,
        source: f.source || "Outro",
        paid_by_label: f.paid_by_label?.trim() || null,
        receipt_url: f.receipt_url?.trim() || null,
        notes: f.notes?.trim() || null,
        status: f.status || "aberto",
        lecture_id: f.lecture_id || null,
        amount_amortized: Number(f.amount_amortized || 0),
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("advances").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advances").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Adiantamento atualizado" : "Adiantamento registrado");
      queryClient.invalidateQueries({ queryKey: ["advances", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent-statement", agentId] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }
  function set<K extends keyof AdvanceRow>(k: K, v: AdvanceRow[K]) { setF((p) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar adiantamento" : "Novo adiantamento"}
          </DialogTitle>
          <DialogDescription>
            Adiantamentos entram automaticamente na conta corrente do agendista e podem ser abatidos no fechamento das palestras.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <Input type="number" step="0.01" value={f.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={f.granted_on ?? ""} onChange={(e) => set("granted_on", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input type="time" value={f.granted_time ?? ""} onChange={(e) => set("granted_time", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={f.source ?? "PIX"} onValueChange={(v) => set("source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADVANCE_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável pelo pagamento</Label>
            <Input value={f.paid_by_label ?? ""} onChange={(e) => set("paid_by_label", e.target.value)} placeholder="Ex.: Gustavo" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "aberto"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADVANCE_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Palestra vinculada (opcional)</Label>
            <Select value={f.lecture_id ?? NONE} onValueChange={(v) => set("lecture_id", v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {(lectures.data ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Já amortizado</Label>
            <Input type="number" step="0.01" value={f.amount_amortized ?? 0} onChange={(e) => set("amount_amortized", e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Comprovante (URL)</Label>
            <Input value={f.receipt_url ?? ""} onChange={(e) => set("receipt_url", e.target.value)} placeholder="link para o comprovante" />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
