import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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
import { formatDate, TIMELINE_KINDS, timelineKindLabel } from "@/lib/crm";
import type { EntityType } from "@/lib/entities";

type TimelineRow = {
  id: string;
  kind: string | null;
  title: string | null;
  body: string | null;
  occurs_at: string;
  created_by: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

/**
 * Timeline única — `public.timeline_events` por (entity_type, entity_id).
 * Cada registro guarda data/hora, autor (created_by), tipo, descrição
 * e referência à entidade — atendendo ao padrão único do sistema.
 */
export function TimelineTab({
  entityType,
  entityId,
  organizationId,
  userId,
}: {
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ["timeline", entityType, entityId];

  const events = useQuery({
    queryKey: key,
    queryFn: async (): Promise<TimelineRow[]> => {
      const { data, error } = await supabase
        .from("timeline_events")
        .select(
          "id, kind, title, body, occurs_at, created_by, profiles:created_by ( full_name, email )",
        )
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("archived_at", null)
        .order("occurs_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TimelineRow[];
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          variant="navy"
          size="sm"
          className="rounded-full"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Registrar evento
        </Button>
      </div>

      {!events.data || events.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/20 px-8 py-14 text-center">
          <h3 className="font-serif text-xl text-foreground">Sem eventos</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Registre o primeiro evento desta entidade.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-5 border-l border-border pl-6">
          {events.data.map((e) => {
            const author = e.profiles?.full_name ?? e.profiles?.email ?? null;
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-[var(--navy)]" />
                <p className="text-sm text-foreground">
                  {e.title ?? timelineKindLabel(e.kind)}
                </p>
                {e.body && <p className="text-xs text-muted-foreground">{e.body}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDate(e.occurs_at)}
                  {author ? ` · ${author}` : ""}
                  {e.kind ? ` · ${timelineKindLabel(e.kind)}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <TimelineEventDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        organizationId={organizationId}
        userId={userId}
        onSaved={() => qc.invalidateQueries({ queryKey: key })}
      />
    </div>
  );
}

function TimelineEventDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  organizationId,
  userId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  userId: string;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    kind: "meeting",
    title: "",
    body: "",
    occurs_at: new Date().toISOString().slice(0, 16),
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timeline_events").insert({
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        kind: f.kind,
        title: f.title.trim() || timelineKindLabel(f.kind),
        body: f.body.trim() || null,
        occurs_at: f.occurs_at ? new Date(f.occurs_at).toISOString() : new Date().toISOString(),
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      setF({
        kind: "meeting",
        title: "",
        body: "",
        occurs_at: new Date().toISOString().slice(0, 16),
      });
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Registrar evento</DialogTitle>
          <DialogDescription>Adicione um evento à timeline desta entidade.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="grid gap-3"
        >
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMELINE_KINDS.map((k) => (
                  <SelectItem key={k.key} value={k.key}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quando</Label>
            <Input
              type="datetime-local"
              value={f.occurs_at}
              onChange={(e) => setF({ ...f, occurs_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={f.title}
              onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="Opcional — usa o tipo se vazio"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Detalhes</Label>
            <Textarea
              rows={3}
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
