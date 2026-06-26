import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bot\u00e3o padr\u00e3o de "Arquivar" para p\u00e1ginas de detalhe.
 * Faz soft-delete (archived_at = now), invalida a listagem
 * e redireciona o usu\u00e1rio para a rota da lista.
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
  const [open, setOpen] = useState(false);

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
      setOpen(false);
      navigate({ to: backTo });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao arquivar"),
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={className ?? "rounded-full text-muted-foreground"}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
      </Button>

      <AlertDialog open={open} onOpenChange={(v) => !archive.isPending && setOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-2xl">Arquivar {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro deixar\u00e1 de aparecer nas listagens, mas ser\u00e1 preservado para
              auditoria e poder\u00e1 ser restaurado posteriormente. Esta a\u00e7\u00e3o n\u00e3o exclui
              dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={archive.isPending}
              onClick={(e) => {
                e.preventDefault();
                archive.mutate();
              }}
            >
              {archive.isPending ? "Arquivando\u2026" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
