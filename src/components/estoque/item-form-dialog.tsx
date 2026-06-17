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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { STOCK_CATEGORIES, STOCK_ITEM_STATUS, STOCK_UNITS } from "@/lib/stock";

export type ItemRow = {
  id?: string;
  name?: string | null;
  category?: string | null;
  sku?: string | null;
  description?: string | null;
  photo_url?: string | null;
  min_quantity?: number | string | null;
  unit?: string | null;
  purchase_price?: number | string | null;
  average_cost?: number | string | null;
  supplier?: string | null;
  location?: string | null;
  status?: string | null;
  notes?: string | null;
};

export function ItemFormDialog({
  open, onOpenChange, organizationId, userId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  initial?: ItemRow;
}) {
  const isEdit = !!initial?.id;
  const [f, setF] = useState<ItemRow>(
    initial ?? {
      name: "",
      category: "Materiais",
      unit: "un",
      status: "ativo",
    },
  );
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      if (!f.name?.trim()) throw new Error("Informe o nome do item.");
      const payload = {
        organization_id: organizationId,
        name: f.name.trim(),
        category: f.category || null,
        sku: f.sku?.trim() || null,
        description: f.description?.trim() || null,
        photo_url: f.photo_url?.trim() || null,
        min_quantity: f.min_quantity !== "" && f.min_quantity != null ? Number(f.min_quantity) : null,
        unit: f.unit || null,
        purchase_price: f.purchase_price !== "" && f.purchase_price != null ? Number(f.purchase_price) : null,
        average_cost: f.average_cost !== "" && f.average_cost != null ? Number(f.average_cost) : null,
        supplier: f.supplier?.trim() || null,
        location: f.location?.trim() || null,
        status: f.status || "ativo",
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("stock_items").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_items").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Item atualizado" : "Item criado");
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["stock-item", initial!.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function set<K extends keyof ItemRow>(k: K, v: ItemRow[K]) { setF((p) => ({ ...p, [k]: v })); }
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar item" : "Novo item de estoque"}
          </DialogTitle>
          <DialogDescription>
            Cadastre um item rastreável. Quantidade e valor médio são calculados pelas movimentações e lotes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>SKU / Código</Label>
            <Input value={f.sku ?? ""} onChange={(e) => set("sku", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={f.category ?? "Materiais"} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={f.unit ?? "un"} onValueChange={(v) => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_ITEM_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Quantidade mínima</Label>
            <Input type="number" step="0.001" value={f.min_quantity ?? ""} onChange={(e) => set("min_quantity", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor de compra</Label>
            <Input type="number" step="0.01" value={f.purchase_price ?? ""} onChange={(e) => set("purchase_price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor médio (manual)</Label>
            <Input type="number" step="0.01" value={f.average_cost ?? ""} onChange={(e) => set("average_cost", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Fornecedor padrão</Label>
            <Input value={f.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Localização</Label>
            <Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Foto (URL)</Label>
            <Input value={f.photo_url ?? ""} onChange={(e) => set("photo_url", e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Descrição</Label>
            <Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
