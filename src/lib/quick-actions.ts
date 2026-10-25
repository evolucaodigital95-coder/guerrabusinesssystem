import { useEffect, useRef } from "react";

/**
 * Ações rápidas (botão flutuante e ⌘K): a ação é registrada, a navegação
 * acontece, e a página de destino abre o formulário certo ao montar.
 */
export type QuickAction =
  | "palestra"
  | "lancamento"
  | "entrada-estoque"
  | "saida-estoque"
  | "empresa"
  | "inventario"
  | "venda-evento"
  | "nova-conta"
  | "novo-material";

let pending: QuickAction | null = null;
const listeners = new Set<() => void>();

export function requestQuickAction(action: QuickAction) {
  pending = action;
  listeners.forEach((l) => l());
}

/** Executa `run` quando `action` for solicitada (mesmo vindo de outra página). */
export function useQuickAction(action: QuickAction, run: () => void) {
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const check = () => {
      if (pending === action) {
        pending = null;
        runRef.current();
      }
    };
    check();
    listeners.add(check);
    return () => {
      listeners.delete(check);
    };
  }, [action]);
}
