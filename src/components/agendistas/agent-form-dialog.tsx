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

export type AgentRow = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  pix_key?: string | null;
  pix_kind?: string | null;
  status?: string | null;
  address?: string | null;
  notes?: string | null;
};

const PIX_KINDS = ["CPF", "CNPJ", "Telefone", "E-mail", "Aleatória"] as const;
const STATUS = ["ativo", "inativo"] as const;

export function AgentFormDialog({
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
  initial?: AgentRow;
}) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState<AgentRow>(initial ?? { status: "ativo" });
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!f.full_name?.trim()) throw new Error("Informe o nome do agendista.");
      const payload = {
        organization_id: organizationId,
        full_name: f.full_name.trim(),
        email: f.email?.trim() || null,
        phone: f.phone?.trim() || null,
        cpf: f.cpf?.trim() || null,
        pix_key: f.pix_key?.trim() || null,
        pix_kind: f.pix_kind || null,
        status: f.status || "ativo",
        address: f.address?.trim() || null,
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("agents").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agents").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Agendista atualizado" : "Agendista cadastrado");
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["agent", initial!.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  function set<K extends keyof AgentRow>(k: K, v: AgentRow[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar agendista" : "Novo agendista"}
          </DialogTitle>
          <DialogDescription>
            Cada agendista tem ID próprio, conta corrente, adiantamentos e snapshots de palestras.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome *</Label>
            <Input
              value={f.full_name ?? ""}
              onChange={(e) => set("full_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={f.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <Input
              value={f.cpf ?? ""}
              onChange={(e) => set("cpf", e.target.value)}
              placeholder="opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo PIX</Label>
            <Select value={f.pix_kind ?? "CPF"} onValueChange={(v) => set("pix_kind", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIX_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chave PIX</Label>
            <Input value={f.pix_key ?? ""} onChange={(e) => set("pix_key", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Endereço</Label>
            <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
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
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
