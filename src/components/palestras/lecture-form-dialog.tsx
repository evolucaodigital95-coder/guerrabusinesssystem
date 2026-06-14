import { useEffect, useState, type FormEvent } from "react";
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
import { LECTURE_STATUS } from "@/lib/lectures";

export type LectureRow = {
  id?: string;
  title?: string | null;
  theme?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  agent_id?: string | null;
  season_id?: string | null;
  campaign_id?: string | null;
  project_id?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  scheduled_at?: string | null; // date only for the input
  scheduled_time?: string | null;
  expected_audience?: number | string | null;
  actual_audience?: number | string | null;
  status?: string | null;
  gross_revenue?: number | string | null;
  notes?: string | null;
};

const NONE = "__none__";

export function LectureFormDialog({
  open, onOpenChange, organizationId, userId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationId: string;
  userId: string;
  initial?: LectureRow;
}) {
  const isEdit = !!initial?.id;
  const today = new Date().toISOString().slice(0, 10);
  const initialDate = initial?.scheduled_at ? initial.scheduled_at.slice(0, 10) : today;

  const [f, setF] = useState<LectureRow>({
    title: "",
    status: "lead",
    scheduled_at: initialDate,
    ...initial,
    scheduled_at: initialDate,
  });
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setF({ title: "", status: "lead", scheduled_at: initialDate, ...initial, scheduled_at: initialDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const companies = useQuery({
    queryKey: ["lectures-companies-select", organizationId],
    queryFn: async () => (await supabase.from("companies").select("id, legal_name").eq("organization_id", organizationId).is("archived_at", null).order("legal_name")).data ?? [],
  });
  const contacts = useQuery({
    queryKey: ["lectures-contacts-select", organizationId, f.company_id],
    queryFn: async () => {
      let q = supabase.from("contacts").select("id, full_name, company_id")
        .eq("organization_id", organizationId).is("archived_at", null).order("full_name");
      if (f.company_id) q = q.eq("company_id", f.company_id);
      return (await q).data ?? [];
    },
  });
  const agents = useQuery({
    queryKey: ["lectures-agents-select", organizationId],
    queryFn: async () => (await supabase.from("agents").select("id, full_name").eq("organization_id", organizationId).is("archived_at", null).order("full_name")).data ?? [],
  });
  const seasons = useQuery({
    queryKey: ["lectures-seasons-select", organizationId],
    queryFn: async () => (await supabase.from("seasons").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("starts_on", { ascending: false })).data ?? [],
  });
  const campaigns = useQuery({
    queryKey: ["lectures-campaigns-select", organizationId],
    queryFn: async () => (await supabase.from("campaigns").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });
  const projects = useQuery({
    queryKey: ["lectures-projects-select", organizationId],
    queryFn: async () => (await supabase.from("projects").select("id, name").eq("organization_id", organizationId).is("archived_at", null).order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!f.title?.trim()) throw new Error("Informe o nome da palestra.");
      const scheduledAt = f.scheduled_at
        ? new Date(`${f.scheduled_at}T${(f.scheduled_time || "00:00").slice(0, 5)}:00`).toISOString()
        : null;
      const payload = {
        organization_id: organizationId,
        title: f.title.trim(),
        theme: f.theme?.trim() || null,
        company_id: f.company_id || null,
        contact_id: f.contact_id || null,
        agent_id: f.agent_id || null,
        season_id: f.season_id || null,
        campaign_id: f.campaign_id || null,
        project_id: f.project_id || null,
        city: f.city?.trim() || null,
        state: f.state?.trim() || null,
        address: f.address?.trim() || null,
        scheduled_at: scheduledAt,
        scheduled_time: f.scheduled_time || null,
        expected_audience: f.expected_audience ? Number(f.expected_audience) : null,
        actual_audience: f.actual_audience ? Number(f.actual_audience) : null,
        status: f.status || "lead",
        gross_revenue: f.gross_revenue ? Number(f.gross_revenue) : null,
        notes: f.notes?.trim() || null,
        updated_by: userId,
      };
      if (isEdit) {
        const { error } = await supabase.from("lectures").update(payload).eq("id", initial!.id!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lectures").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Palestra atualizada" : "Palestra criada");
      qc.invalidateQueries({ queryKey: ["lectures"] });
      if (isEdit) qc.invalidateQueries({ queryKey: ["lecture", initial!.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }
  function set<K extends keyof LectureRow>(k: K, v: LectureRow[K]) { setF((p) => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEdit ? "Editar palestra" : "Nova palestra"}
          </DialogTitle>
          <DialogDescription>
            A palestra conecta empresa, contato, agendista, temporada, projeto, financeiro e estoque.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome da palestra *</Label>
            <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={f.status ?? "lead"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LECTURE_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Tema</Label>
            <Input value={f.theme ?? ""} onChange={(e) => set("theme", e.target.value)} />
          </div>

          <SelectField label="Empresa" value={f.company_id} onChange={(v) => set("company_id", v)}
            options={(companies.data ?? []).map((c) => ({ value: c.id, label: c.legal_name }))} />
          <SelectField label="Contato" value={f.contact_id} onChange={(v) => set("contact_id", v)}
            options={(contacts.data ?? []).map((c) => ({ value: c.id, label: c.full_name }))} />
          <SelectField label="Agendista" value={f.agent_id} onChange={(v) => set("agent_id", v)}
            options={(agents.data ?? []).map((a) => ({ value: a.id, label: a.full_name }))} />

          <SelectField label="Temporada" value={f.season_id} onChange={(v) => set("season_id", v)}
            options={(seasons.data ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label="Campanha" value={f.campaign_id} onChange={(v) => set("campaign_id", v)}
            options={(campaigns.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          <SelectField label="Projeto" value={f.project_id} onChange={(v) => set("project_id", v)}
            options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />

          <div className="space-y-1.5">
            <Label>Data</Label>
            <Input type="date" value={f.scheduled_at ?? ""} onChange={(e) => set("scheduled_at", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hora</Label>
            <Input type="time" value={f.scheduled_time ?? ""} onChange={(e) => set("scheduled_time", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Receita bruta (R$)</Label>
            <Input type="number" step="0.01" value={f.gross_revenue ?? ""} onChange={(e) => set("gross_revenue", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Input value={f.state ?? ""} onChange={(e) => set("state", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input value={f.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Público previsto</Label>
            <Input type="number" value={f.expected_audience ?? ""} onChange={(e) => set("expected_audience", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Público real</Label>
            <Input type="number" value={f.actual_audience ?? ""} onChange={(e) => set("actual_audience", e.target.value)} />
          </div>
          <div className="space-y-1.5"></div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <DialogFooter className="md:col-span-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : isEdit ? "Salvar" : "Criar palestra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Nenhum(a)</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
