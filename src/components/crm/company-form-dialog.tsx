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
import { COMPANY_STATUS, LIFECYCLE_STAGES } from "@/lib/crm";
import { useOrgMembers } from "@/hooks/use-org-members";

type CompanyRow = {
  id?: string;
  legal_name?: string | null;
  trade_name?: string | null;
  document?: string | null;
  segment?: string | null;
  employees_count?: number | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  zip?: string | null;
  website?: string | null;
  instagram?: string | null;
  notes?: string | null;
  status?: string | null;
  lifecycle_stage?: string | null;
  owner_id?: string | null;
};

export function CompanyFormDialog({
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
  initial?: CompanyRow & { id?: string };
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<CompanyRow>(initial ?? { status: "ativo", lifecycle_stage: "lead" });
  const queryClient = useQueryClient();
  const members = useOrgMembers(organizationId);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.legal_name?.trim()) throw new Error("Informe a Razão Social.");
      const payload = {
        organization_id: organizationId,
        legal_name: form.legal_name.trim(),
        trade_name: form.trade_name?.trim() || null,
        document: form.document?.trim() || null,
        segment: form.segment?.trim() || null,
        employees_count: form.employees_count ?? null,
        city: form.city?.trim() || null,
        state: form.state?.trim() || null,
        address: form.address?.trim() || null,
        zip: form.zip?.trim() || null,
        website: form.website?.trim() || null,
        instagram: form.instagram?.trim() || null,
        notes: form.notes?.trim() || null,
        status: form.status || "ativo",
        lifecycle_stage: form.lifecycle_stage || "lead",
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("companies").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Empresa atualizada" : "Empresa cadastrada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      if (isEdit) queryClient.invalidateQueries({ queryKey: ["company", initial!.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  function set<K extends keyof CompanyRow>(k: K, v: CompanyRow[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar empresa" : "Nova empresa"}
          </DialogTitle>
          <DialogDescription>
            Cadastro principal do CRM. Você pode adicionar contatos, leads e oportunidades depois.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="legal_name">Razão social *</Label>
            <Input id="legal_name" value={form.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trade_name">Nome fantasia</Label>
            <Input id="trade_name" value={form.trade_name ?? ""} onChange={(e) => set("trade_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document">CNPJ</Label>
            <Input id="document" value={form.document ?? ""} onChange={(e) => set("document", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="segment">Segmento</Label>
            <Input id="segment" value={form.segment ?? ""} onChange={(e) => set("segment", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employees">Nº de funcionários</Label>
            <Input id="employees" type="number" min={0} value={form.employees_count ?? ""} onChange={(e) => set("employees_count", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">Estado</Label>
            <Input id="state" maxLength={2} value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">CEP</Label>
            <Input id="zip" value={form.zip ?? ""} onChange={(e) => set("zip", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Site</Label>
            <Input id="website" placeholder="https://" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="instagram">Instagram</Label>
            <Input id="instagram" placeholder="@" value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status ?? "ativo"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANY_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Etapa do relacionamento</Label>
            <Select value={form.lifecycle_stage ?? "lead"} onValueChange={(v) => set("lifecycle_stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFECYCLE_STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
