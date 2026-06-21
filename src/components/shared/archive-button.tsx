import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Botão padrão de "Arquivar" para páginas de detalhe.
 * Faz soft-delete (archived_at = now), invalida a listagem
 * e redireciona o usuário para a rota da lista.
 */
export function ArchiveButton({
  table,
  id,
  label = "este registro",
  listQueryKey,
  backTo,
  className,
}: {
  table:
    | "companies"
    | "agents"
    | "lectures"
    | "seasons"
    | "campaigns"
    | "projects"
    | "stock_items"
    | "contacts"
    | "financial_movements";
  id: string;
  label?: string;
  listQueryKey: string;
  backTo: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const archive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from(table)
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivado com sucesso");
      qc.invalidateQueries({ queryKey: [listQueryKey] });
      navigate({ to: backTo });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao arquivar"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className ?? "rounded-full text-muted-foreground"}
      disabled={archive.isPending}
      onClick={() => {
        if (typeof window !== "undefined" && window.confirm(`Arquivar ${label}?`)) {
          archive.mutate();
        }
      }}
    >
      <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
    </Button>
  );
}
