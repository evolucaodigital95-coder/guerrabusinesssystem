import { useEffect, useState } from "react";
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
import { useAutomation } from "@/hooks/use-automation";
import { PAYMENT_METHODS } from "@/lib/supplier-accounts";

type Season = { id: string; name: string };

export function SettlementFormDialog({
  open, onOpenChange, organizationId, userId, defaults, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  defaults?: { supplier?: string; seasonId?: string | null };
  initial?: {
    id: string;
    supplier: string;
    season_id: string | null;
    amount_paid: number | string;
    paid_on: string;
    payment_method: string | null;
    receipt_number: string | null;
    notes: string | null;
  } | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [supplier, setSupplier] = useState("");
  const [seasonId, setSeasonId] = useState<string>("__none__");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>("PIX");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setSupplier(initial.supplier);
      setSeasonId(initial.season_id ?? "__none__");
      setAmount(String(initial.amount_paid ?? ""));
      setPaidOn(initial.paid_on ?? today);
      setMethod(initial.payment_method ?? "PIX");
      setReceipt(initial.receipt_number ?? "");
      setNotes(initial.notes ?? "");
    } else {
      setSupplier(defaults?.supplier ?? "");
      setSeasonId(defaults?.seasonId ?? "__none__");
      setAmount("");
      setPaidOn(today);
      setMethod("PIX");
      setReceipt("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const seasons = useQuery({
    queryKey: ["seasons-select", organizationId],
    enabled: open && !!organizationId,
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Season[];
    },
  });

  const qc = useQueryClient();
  const { emit } = useAutomation();

  const save = useMutation({
    mutationFn: async () => {
      const trimmedSupplier = supplier.trim();
      const value = Number(amount);
      if (!trimmedSupplier) throw new Error("Informe o fornecedor.");
      if (!Number.isFinite(value) || value <= 0) throw new Error("Valor pago deve ser maior que zero.");
      const payload = {
        organization_id: organizationId,
        supplier: trimmedSupplier,
        season_id: seasonId === "__none__" ? null : seasonId,
        amount_paid: value,
        paid_on: paidOn || today,
        payment_method: method || null,
        receipt_number: receipt.trim() || null,
        notes: notes.trim() || null,
        updated_by: userId,
      };
      if (initial?.id) {
        const { error } = await supabase.from("supplier_settlements").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("supplier_settlements")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Acerto atualizado" : "Acerto registrado");
      qc.invalidateQueries({ queryKey: ["supplier-settlements"] });
      void emit("supplier.settlement.created", {
        entityType: "stock_item",
        entityId: null,
        seasonId: seasonId === "__none__" ? null : seasonId,
        summary: `Acerto com fornecedor ${supplier.trim()}`,
      });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {initial?.id ? "Editar acerto" : "Registrar acerto com fornecedor"}
          </DialogTitle>
          <DialogDescription>
            Somente movimenta a prestação de contas. Não altera estoque, palestras nem o livro razão.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Input required value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Editora Guerra" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Temporada</Label>
              <Select value={seasonId} onValueChange={setSeasonId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem temporada</SelectItem>
                  {(seasons.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor pago (R$)</Label>
              <Input required type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Número do comprovante (opcional)</Label>
            <Input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Ex.: NF 12345 / TED 998877" />
          </div>

          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : initial?.id ? "Salvar alterações" : "Registrar acerto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
