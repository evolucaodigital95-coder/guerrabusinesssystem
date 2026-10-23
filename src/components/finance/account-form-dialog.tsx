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
import { ACCOUNT_KINDS, ACCOUNT_STATUS } from "@/lib/finance";

export type AccountRow = {
  id?: string;
  name?: string | null;
  kind?: string | null;
  status?: string | null;
  currency?: string | null;
  notes?: string | null;
};

export function AccountFormDialog({
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
  initial?: AccountRow;
}) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState<AccountRow>(
    initial ?? { name: "", kind: "Caixa", status: "ativa", currency: "BRL", notes: "" },
  );
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name?.trim()) throw new Error("Informe o nome.");
      const payload = {
        organization_id: organizationId,
        name: f.name.trim(),
        kind: f.kind || null,
        status: f.status || "ativa",
        currency: f.currency || "BRL",
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("accounts").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("accounts")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Conta atualizada" : "Conta criada");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  function set<K extends keyof AccountRow>(k: K, v: AccountRow[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar conta" : "Nova conta financeira"}
          </DialogTitle>
          <DialogDescription>
            Contas são usadas para classificar movimentos do Livro Razão. O saldo é calculado a
            partir dos movimentos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={f.kind ?? "Caixa"} onValueChange={(v) => set("kind", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "ativa"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
