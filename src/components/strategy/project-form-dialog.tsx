import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUS } from "@/lib/strategy";
import { useOrgMembers } from "@/hooks/use-org-members";

export type ProjectRow = {
  id?: string;
  name: string;
  description: string | null;
  status: string | null;
  season_id: string | null;
  campaign_id: string | null;
  owner_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
};

const NONE = "__none__";

export function ProjectFormDialog({
  open, onOpenChange, organizationId, userId, initial,
  defaultSeasonId, defaultCampaignId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  initial?: ProjectRow | null;
  defaultSeasonId?: string | null;
  defaultCampaignId?: string | null;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<ProjectRow>({
    name: "", description: "", status: "planejamento",
    season_id: null, campaign_id: null, owner_id: null,
    starts_on: null, ends_on: null,
  });

  useEffect(() => {
    if (open) {
      setF({
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        status: initial?.status ?? "planejamento",
        season_id: initial?.season_id ?? defaultSeasonId ?? null,
        campaign_id: initial?.campaign_id ?? defaultCampaignId ?? null,
        owner_id: initial?.owner_id ?? null,
        starts_on: initial?.starts_on ?? null,
        ends_on: initial?.ends_on ?? null,
      });
    }
  }, [open, initial, defaultSeasonId, defaultCampaignId]);

  const seasons = useQuery({
    queryKey: ["seasons", organizationId, "select"],
    enabled: !!organizationId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons").select("id, name").eq("organization_id", organizationId)
        .is("archived_at", null).order("starts_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaigns = useQuery({
    queryKey: ["campaigns", organizationId, "select", f.season_id],
    enabled: !!organizationId && open,
    queryFn: async () => {
      let q = supabase.from("campaigns").select("id, name, season_id")
        .eq("organization_id", organizationId).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (f.season_id) q = q.eq("season_id", f.season_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useOrgMembers(organizationId);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: organizationId,
        name: f.name.trim(),
        description: f.description?.trim() || null,
        status: f.status,
        season_id: f.season_id,
        campaign_id: f.campaign_id,
        owner_id: f.owner_id,
        starts_on: f.starts_on || null,
        ends_on: f.ends_on || null,
        updated_by: userId,
      };
      if (initial?.id) {
        const { error } = await supabase.from("projects").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Projeto atualizado" : "Projeto criado");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", initial?.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {initial?.id ? "Editar projeto" : "Novo projeto"}
          </DialogTitle>
          <DialogDescription>Iniciativa específica vinculada à temporada e/ou campanha.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Temporada</Label>
              <Select value={f.season_id ?? NONE} onValueChange={(v) => setF({ ...f, season_id: v === NONE ? null : v, campaign_id: null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem temporada</SelectItem>
                  {(seasons.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Campanha</Label>
              <Select value={f.campaign_id ?? NONE} onValueChange={(v) => setF({ ...f, campaign_id: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem campanha</SelectItem>
                  {(campaigns.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={f.owner_id ?? NONE} onValueChange={(v) => setF({ ...f, owner_id: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem responsável</SelectItem>
                {(members.data ?? []).map((m: { user_id: string; full_name: string | null; email: string | null }) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name ?? m.email ?? m.user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={f.starts_on ?? ""} onChange={(e) => setF({ ...f, starts_on: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim</Label>
              <Input type="date" value={f.ends_on ?? ""} onChange={(e) => setF({ ...f, ends_on: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "planejamento"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
