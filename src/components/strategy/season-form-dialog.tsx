import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEASON_STATUS } from "@/lib/strategy";

export type SeasonRow = {
  id?: string;
  name: string;
  description: string | null;
  status: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

export function SeasonFormDialog({
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
  initial?: SeasonRow | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<SeasonRow>({
    name: "",
    description: "",
    status: "planejamento",
    starts_on: null,
    ends_on: null,
  });

  useEffect(() => {
    if (open) {
      setF({
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        status: initial?.status ?? "planejamento",
        starts_on: initial?.starts_on ?? null,
        ends_on: initial?.ends_on ?? null,
      });
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: organizationId,
        name: f.name.trim(),
        description: f.description?.trim() || null,
        status: f.status,
        starts_on: f.starts_on || null,
        ends_on: f.ends_on || null,
        updated_by: userId,
      };
      if (initial?.id) {
        const { error } = await supabase.from("seasons").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("seasons").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Temporada atualizada" : "Temporada criada");
      qc.invalidateQueries({ queryKey: ["seasons"] });
      qc.invalidateQueries({ queryKey: ["season", initial?.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {initial?.id ? "Editar temporada" : "Nova temporada"}
          </DialogTitle>
          <DialogDescription>
            Ciclo comercial que organiza palestras, campanhas, projetos e financeiro.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={f.description ?? ""}
              onChange={(e) => setF({ ...f, description: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="date"
                value={f.starts_on ?? ""}
                onChange={(e) => setF({ ...f, starts_on: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Encerramento</Label>
              <Input
                type="date"
                value={f.ends_on ?? ""}
                onChange={(e) => setF({ ...f, ends_on: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={f.status ?? "planejamento"}
              onValueChange={(v) => setF({ ...f, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASON_STATUS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
