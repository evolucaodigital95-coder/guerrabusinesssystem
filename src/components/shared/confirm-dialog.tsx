import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Diálogo padrão de confirmação. Substitui `window.confirm()` para
 * manter a linguagem visual do GBS e evitar bloqueio de UI nativo.
 *
 * Uso:
 * <ConfirmDialog
 *   title="Fechar palestra?"
 *   description="Um snapshot permanente será gerado."
 *   confirmLabel="Fechar palestra"
 *   onConfirm={() => close.mutate()}
 *   trigger={<Button>Fechar</Button>}
 * />
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  trigger,
  destructive = false,
  pending = false,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  trigger: ReactNode;
  destructive?: boolean;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-2xl">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className={destructive ? "bg-rose-600 hover:bg-rose-700" : undefined}
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
              setOpen(false);
            }}
          >
            {pending ? "Processando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
