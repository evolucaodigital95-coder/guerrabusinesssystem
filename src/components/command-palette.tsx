import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  CornerDownLeft,
  Mic,
  Package,
  Search,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { searchEverything, type Result } from "@/lib/global-search";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MODULES } from "@/lib/modules";
import { requestQuickAction } from "@/lib/quick-actions";
import { QUICK_ACTIONS } from "@/components/quick-actions-fab";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  group: "Resultados" | "Criar" | "Ir para" | "Pesquisar";
  label: string;
  hint?: string;
  icon: typeof Search;
  run: () => void;
};

const RESULT_ICON: Record<Result["kind"], typeof Search> = {
  company: Building2,
  contact: User,
  lecture: Mic,
  agent: Users,
  movement: Wallet,
  season: CalendarRange,
  stock: Package,
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Paleta de comandos (⌘K): criar, navegar e pesquisar sem tirar a mão do teclado. */
export function CommandPalette({
  open,
  onOpenChange,
  canCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canCreate: boolean;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { organizationId } = useCurrentOrg();

  // Busca real no banco, com pequena espera para não consultar a cada tecla.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);
  const live = useQuery({
    queryKey: ["palette-search", organizationId, debounced],
    enabled: open && !!organizationId && debounced.length >= 2,
    queryFn: () => searchEverything(organizationId!, debounced),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const close = () => onOpenChange(false);
    const create: Item[] = canCreate
      ? QUICK_ACTIONS.map((a) => ({
          id: `create-${a.action}`,
          group: "Criar",
          label: a.label,
          hint: a.hint,
          icon: a.icon,
          run: () => {
            close();
            navigate({ to: a.to }).then(() => requestQuickAction(a.action));
          },
        }))
      : [];
    const pages: Item[] = MODULES.map((m) => ({
      id: `go-${m.to}`,
      group: "Ir para",
      label: m.label,
      icon: m.icon,
      run: () => {
        close();
        navigate({ to: m.to });
      },
    }));
    const results: Item[] = (live.data ?? []).slice(0, 7).map((r) => ({
      id: `r-${r.id}`,
      group: "Resultados",
      label: r.title,
      hint: [r.subtitle, r.meta].filter(Boolean).join(" · ") || undefined,
      icon: RESULT_ICON[r.kind],
      run: () => {
        close();
        navigate({ to: r.to as never, params: r.params as never, search: r.search as never });
      },
    }));
    const q = normalize(query.trim());
    const filtered = [...results, ...create, ...pages].filter(
      (i) => i.group === "Resultados" || !q || normalize(`${i.label} ${i.hint ?? ""}`).includes(q),
    );
    if (query.trim()) {
      filtered.push({
        id: "search",
        group: "Pesquisar",
        label: `Pesquisar “${query.trim()}” em todo o GBS`,
        hint: "Empresas, contatos, palestras, agendistas, lançamentos",
        icon: Search,
        run: () => {
          close();
          navigate({ to: "/app/busca", search: { q: query.trim() } });
        },
      });
    }
    return filtered;
  }, [query, canCreate, navigate, onOpenChange, live.data]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    }
  }

  let lastGroup = "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="O que você quer fazer?"
            className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {items.map((item, index) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            const Icon = item.icon;
            const selected = index === active;
            return (
              <div key={item.id}>
                {showGroup && (
                  <div className="px-3 pt-3 pb-1.5 text-[11px] font-medium text-muted-foreground">
                    {item.group}
                  </div>
                )}
                <button
                  data-index={index}
                  onMouseMove={() => setActive(index)}
                  onClick={item.run}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-accent text-foreground" : "text-foreground/85",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                      selected ? "bg-clay text-clay-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.label}</span>
                    {item.hint && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </span>
                  {selected ? (
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 text-transparent" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span className="ml-auto">⌘K a qualquer momento</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
