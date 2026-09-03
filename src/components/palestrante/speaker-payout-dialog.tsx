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
import { PAYMENT_METHODS } from "@/lib/finance";

/** Retirada / pagamento ao PALESTRANTE — lançado no razão como saída "Pró-labore" sem agendista. */
export function SpeakerPayoutDialog({
  open, onOpenChange, organizationId, userId, speakerName, maxAmount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  speakerName: string;
  maxAmount: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const [f, setF] = useState({
    amount: "",
    occurs_on: today,
    occurs_time: now,
    payment_method: "pix",
    account_id: "",
    notes: "",
    receipt_url: "",
    override: false,
  });
  const qc = useQueryClient();

  const accounts = useQuery({
    queryKey: ["accounts-select", organizationId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts").select("id, name, kind")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(f.amount);
      if (!amount || amount <= 0) throw new Error("Informe o valor da retirada.");
      if (amount > maxAmount + 0.009 && !f.override) {
        throw new Error(`Valor acima do saldo disponível (${maxAmount.toFixed(2)}). Marque a confirmação para prosseguir.`);
      }
      const { error } = await supabase.from("financial_movements").insert({
        organization_id: organizationId,
        direction: "out",
        category: "Pró-labore",
        description: `Retirada do palestrante · ${speakerName}`,
        amount,
        occurs_on: f.occurs_on || today,
        occurs_time: f.occurs_time || null,
        status: "paga",
        agent_id: null,
        account_id: f.account_id || null,
        payment_method: f.payment_method,
        notes: [f.notes, f.receipt_url ? `Comprovante: ${f.receipt_url}` : null].filter(Boolean).join(" · ") || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Retirada registrada");
      qc.invalidateQueries({ queryKey: ["cfp-speaker-payouts"] });
      onOpenChange(false);
      setF((p) => ({ ...p, amount: "", notes: "", receipt_url: "", override: false }));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao registrar"),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  const willOverdraft = Number(f.amount || 0) > maxAmount + 0.009;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar retirada do palestrante</DialogTitle>
          <DialogDescription>
            {speakerName} · Saldo disponível{" "}
            <strong>{maxAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor</Label>
              <Input type="number" step="0.01" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={f.occurs_on} onChange={(e) => setF({ ...f, occurs_on: e.target.value })} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={f.occurs_time} onChange={(e) => setF({ ...f, occurs_time: e.target.value })} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Conta de origem</Label>
              <Select value={f.account_id} onValueChange={(v) => setF({ ...f, account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                <SelectContent>
                  {(accounts.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} · {a.kind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Comprovante (URL)</Label>
              <Input type="url" placeholder="https://…" value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Observação</Label>
              <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          {willOverdraft && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
              <input type="checkbox" checked={f.override} onChange={(e) => setF({ ...f, override: e.target.checked })} />
              <span>Esta retirada excede o saldo atual do palestrante. Confirmo o ajuste (fica registrado em auditoria).</span>
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>Registrar retirada</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
