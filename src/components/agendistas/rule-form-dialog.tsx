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
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export type RuleRow = {
  id?: string;
  name?: string;
  scope?: string;
  agent_id?: string | null;
  season_id?: string | null;
  gustavo_share?: number | string;
  agent_share?: number | string;
  fee_percent?: number | string;
  fee_fixed?: number | string;
  effective_from?: string | null;
  effective_to?: string | null;
  is_default?: boolean;
  notes?: string | null;
};

export function RuleFormDialog({
  open, onOpenChange, organizationId, userId, agentId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  agentId?: string | null;
  initial?: RuleRow;
}) {
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<RuleRow>(
    initial ?? {
      name: "50 / 50",
      scope: agentId ? "agent" : "organization",
      agent_id: agentId ?? null,
      gustavo_share: 0.5,
      agent_share: 0.5,
      fee_percent: 0,
      fee_fixed: 0,
      effective_from: today,
      is_default: !agentId,
    },
  );
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const gShare = Number(f.gustavo_share || 0);
      const aShare = Number(f.agent_share || 0);
      if (Math.abs(gShare + aShare - 1) > 0.01) {
        throw new Error("A soma dos percentuais Gustavo + Agendista deve ser 100%.");
      }
      const payload = {
        organization_id: organizationId,
        name: f.name?.trim() || "Regra",
        scope: f.scope || "organization",
        agent_id: f.scope === "agent" ? (f.agent_id ?? agentId ?? null) : null,
        season_id: f.scope === "season" ? f.season_id ?? null : null,
        gustavo_share: gShare,
        agent_share: aShare,
        fee_percent: Number(f.fee_percent || 0),
        fee_fixed: Number(f.fee_fixed || 0),
        effective_from: f.effective_from || today,
        effective_to: f.effective_to || null,
        is_default: !!f.is_default,
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("financial_rules").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_rules").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Regra atualizada" : "Regra criada");
      qc.invalidateQueries({ queryKey: ["financial_rules"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }
  function set<K extends keyof RuleRow>(k: K, v: RuleRow[K]) { setF((p) => ({ ...p, [k]: v })); }

  // helper para entrada em %
  function pctVal(v: number | string | undefined) {
    const n = Number(v ?? 0);
    return Math.round(n * 10000) / 100;
  }
  function fromPct(s: string) {
    const n = Number(s);
    return isFinite(n) ? n / 100 : 0;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar regra financeira" : "Nova regra financeira"}
          </DialogTitle>
          <DialogDescription>
            Regras parametrizadas. Mudanças futuras não afetam palestras já fechadas — o snapshot é congelado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome</Label>
            <Input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Escopo</Label>
            <Select value={f.scope ?? "organization"} onValueChange={(v) => set("scope", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="organization">Organização</SelectItem>
                <SelectItem value="agent">Agendista</SelectItem>
                <SelectItem value="season">Temporada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={!!f.is_default} onCheckedChange={(v) => set("is_default", v)} id="def" />
              <Label htmlFor="def" className="text-sm">Regra padrão</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>% Gustavo</Label>
            <Input type="number" step="0.01" value={pctVal(f.gustavo_share)} onChange={(e) => set("gustavo_share", fromPct(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>% Agendista</Label>
            <Input type="number" step="0.01" value={pctVal(f.agent_share)} onChange={(e) => set("agent_share", fromPct(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Taxa %</Label>
            <Input type="number" step="0.01" value={pctVal(f.fee_percent)} onChange={(e) => set("fee_percent", fromPct(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Taxa fixa (R$)</Label>
            <Input type="number" step="0.01" value={f.fee_fixed ?? 0} onChange={(e) => set("fee_fixed", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Vigência início</Label>
            <Input type="date" value={f.effective_from ?? ""} onChange={(e) => set("effective_from", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vigência fim (opcional)</Label>
            <Input type="date" value={f.effective_to ?? ""} onChange={(e) => set("effective_to", e.target.value)} />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
