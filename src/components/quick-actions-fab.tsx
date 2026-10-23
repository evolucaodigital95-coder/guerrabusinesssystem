import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Mic, PackageMinus, PackagePlus, Plus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestQuickAction, type QuickAction } from "@/lib/quick-actions";

export const QUICK_ACTIONS: {
  action: QuickAction;
  label: string;
  hint: string;
  to: string;
  icon: typeof Plus;
}[] = [
  {
    action: "palestra",
    label: "Nova palestra",
    hint: "Agenda, financeiro e estoque juntos",
    to: "/app/palestras",
    icon: Mic,
  },
  {
    action: "lancamento",
    label: "Novo lançamento",
    hint: "Entrada ou saída no Livro Razão",
    to: "/app/financeiro",
    icon: Wallet,
  },
  {
    action: "entrada-estoque",
    label: "Entrada de estoque",
    hint: "Compra ou recebimento de material",
    to: "/app/estoque",
    icon: PackagePlus,
  },
  {
    action: "saida-estoque",
    label: "Saída para palestra",
    hint: "Material usado em uma palestra",
    to: "/app/estoque",
    icon: PackageMinus,
  },
  {
    action: "empresa",
    label: "Nova empresa",
    hint: "Cliente ou prospect no CRM",
    to: "/app/crm",
    icon: Building2,
  },
];

/** Botão flutuante "+" com as ações mais usadas. */
export function QuickActionsFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function run(a: (typeof QUICK_ACTIONS)[number]) {
    setOpen(false);
    navigate({ to: a.to }).then(() => requestQuickAction(a.action));
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[oklch(0.2_0.01_60/0.25)] backdrop-blur-[2px] animate-in fade-in-0"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3 md:right-8 md:bottom-8">
        {open && (
          <ul className="flex flex-col items-end gap-2" role="menu">
            {QUICK_ACTIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <li
                  key={a.action}
                  className="reveal"
                  style={{ "--i": QUICK_ACTIONS.length - 1 - i } as CSSProperties}
                >
                  <button
                    role="menuitem"
                    onClick={() => run(a)}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card py-2 pr-2 pl-4 text-left shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-x-1 hover:border-clay/40"
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{a.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                    </span>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-clay/10 text-clay transition-colors group-hover:bg-clay group-hover:text-clay-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar ações rápidas" : "Ações rápidas"}
          aria-expanded={open}
          className={cn(
            "shine grid h-14 w-14 place-items-center rounded-full bg-clay text-clay-foreground transition-transform duration-300 hover:scale-105 active:scale-95",
            !open && "fab-pulse",
          )}
        >
          <Plus
            className={cn("h-6 w-6 transition-transform duration-300", open && "rotate-[135deg]")}
          />
        </button>
      </div>
    </>
  );
}
