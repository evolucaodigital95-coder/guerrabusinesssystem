import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GbsMark } from "@/components/gbs-mark";
import { MODULES } from "@/lib/modules";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const sections = ["principal", "operação", "estratégia", "sistema"] as const;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-5">
          <GbsMark variant="light" />
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {sections.map((section) => {
            const items = MODULES.filter((m) => m.section === section);
            return (
              <div key={section} className="mb-6">
                <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--sidebar-foreground)]/50">
                  {section}
                </div>
                <ul className="space-y-0.5">
                  {items.map((m) => {
                    const active = pathname === m.to;
                    const Icon = m.icon;
                    return (
                      <li key={m.to}>
                        <Link
                          to={m.to}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-[var(--sidebar-accent)] text-[var(--sidebar-foreground)]"
                              : "text-[var(--sidebar-foreground)]/75 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]",
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-[var(--gold)]")} />
                          <span className="truncate">{m.label}</span>
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--sidebar-border)] p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--sidebar-foreground)]/50">
            Powered by Grupo Guerra
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-sm text-muted-foreground">
              {greeting()}, <span className="font-medium text-foreground">Gustavo</span>
            </p>
          </div>

          <div className="relative flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar no GBS…"
              className="h-9 pl-9"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gold" size="sm" className="hidden md:inline-flex">
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Ações rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/app/crm">Novo Lead</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/app/palestras">Nova Palestra</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/app/financeiro">Novo Lançamento</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notificações">
              <Bell className="h-4 w-4" />
            </Button>
            <Link
              to="/app/configuracoes"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Configurações"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <div className="ml-2 hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--navy)] text-xs font-semibold text-[var(--navy-foreground)] md:grid">
              GG
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}
    </div>
  );
}
