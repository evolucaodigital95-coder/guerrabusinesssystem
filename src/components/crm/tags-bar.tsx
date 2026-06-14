import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Tag = { id: string; name: string; color: string | null };

export function TagsBar({
  entityType,
  entityId,
  organizationId,
  userId,
}: {
  entityType: string;
  entityId: string;
  organizationId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const attached = useQuery({
    queryKey: ["taggings", entityType, entityId],
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from("taggings")
        .select("tag_id, tags:tag_id ( id, name, color )")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.tags as unknown as Tag)
        .filter(Boolean);
    },
  });

  const allTags = useQuery({
    queryKey: ["org-tags", organizationId],
    enabled: open,
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function attachTag(tagId: string) {
    const { error } = await supabase.from("taggings").insert({
      organization_id: organizationId,
      tag_id: tagId,
      entity_type: entityType,
      entity_id: entityId,
      created_by: userId,
      updated_by: userId,
    });
    if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
  }

  const add = useMutation({
    mutationFn: async (input: { tagId?: string; newName?: string }) => {
      let tagId = input.tagId;
      if (!tagId && input.newName) {
        const trimmed = input.newName.trim();
        if (!trimmed) throw new Error("Informe um nome.");
        const existing = (allTags.data ?? []).find(
          (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) tagId = existing.id;
        else {
          const { data, error } = await supabase
            .from("tags")
            .insert({
              organization_id: organizationId,
              name: trimmed,
              created_by: userId,
              updated_by: userId,
            })
            .select("id")
            .single();
          if (error) throw error;
          tagId = data.id;
        }
      }
      if (!tagId) throw new Error("Selecione ou crie uma tag.");
      await attachTag(tagId);
    },
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["taggings", entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ["org-tags", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("taggings")
        .delete()
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["taggings", entityType, entityId] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate({ newName: name });
  }

  const attachedIds = new Set((attached.data ?? []).map((t) => t.id));
  const suggestions = (allTags.data ?? []).filter((t) => !attachedIds.has(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(attached.data ?? []).map((t) => (
        <Badge key={t.id} variant="secondary" className="gap-1 pl-2 pr-1 font-normal">
          <TagIcon className="h-3 w-3 opacity-60" />
          {t.name}
          <button
            type="button"
            onClick={() => remove.mutate(t.id)}
            className="ml-0.5 grid h-4 w-4 place-items-center rounded-full hover:bg-foreground/10"
            aria-label="Remover tag"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-xs">
            <Plus className="mr-1 h-3 w-3" /> Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <form onSubmit={submit} className="flex items-center gap-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nova ou existente…"
              className="h-9"
            />
            <Button type="submit" size="sm" variant="navy" disabled={add.isPending}>
              Adicionar
            </Button>
          </form>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Existentes
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => add.mutate({ tagId: t.id })}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
