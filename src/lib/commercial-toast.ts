import { toast } from "sonner";
import { commercialErrorMessage } from "@/lib/platform";

/**
 * Ponto central: qualquer erro de bloqueio comercial vindo do banco
 * (limite, recurso fora do plano, assinatura bloqueada) é mostrado
 * em linguagem de cliente, sem códigos técnicos.
 */
let installed = false;
export function installCommercialToast() {
  if (installed) return;
  installed = true;
  const original = toast.error;
  const patched = ((message: unknown, data?: unknown) => {
    const text =
      typeof message === "string"
        ? message
        : message instanceof Error
          ? message.message
          : null;
    const friendly = commercialErrorMessage(text);
    return (original as (m: unknown, d?: unknown) => string | number)(friendly ?? message, data);
  }) as typeof toast.error;
  (toast as { error: typeof toast.error }).error = patched;
}
