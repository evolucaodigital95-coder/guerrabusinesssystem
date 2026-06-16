import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/crm";
import type { EntityType } from "@/lib/entities";

type Note = {
  id: string;
  body: string;
  created_at: string;
  created_by: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

/**
 * Notas privadas — componente único usado por todas as entidades.
 * Persistido em `public.notes` (entity_type + entity_id).
 */
export function NotesTab({
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
  const [body, setBody] = useState("");
  const key = ["notes", entityType, entityId];

  const list = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, body, created_at, created_by, profiles:created_by ( full_name, email )")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Note[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Escreva uma nota.");
      const { error } = await supabase.from("notes").insert({
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        body: body.trim(),
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <Textarea
          rows={3}
          placeholder="Adicionar uma nota privada…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-3 flex justify-end">
          <Button
            variant="navy"
            size="sm"
            onClick={() => add.mutate()}
            disabled={add.isPending || !body.trim()}
          >
            {add.isPending ? "Salvando…" : "Adicionar nota"}
          </Button>
        </div>
      </div>
      {list.data && list.data.length > 0 ? (
        <ul className="space-y-3">
          {list.data.map((n) => {
            const author = n.profiles?.full_name ?? n.profiles?.email ?? null;
            return (
              <li key={n.id} className="rounded-2xl border border-border bg-card/30 p-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDate(n.created_at)}
                  {author ? ` · ${author}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
      )}
    </div>
  );
}
