import { Link, Outlet, Navigate, createFileRoute, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

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
  const navigate = useNavigate();
  const { session, user, loading } = useSession();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!session) return <Navigate to="/" />;

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";
  const initials = (firstName || "GG").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const sections = ["principal", "operação", "estratégia", "sistema"] as const;
  const sectionLabel: Record<(typeof sections)[number], string> = {
    principal: "Principal",
    operação: "Operação",
    estratégia: "Estratégia",
    sistema: "Sistema",
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex-col border-r border-sidebar-border bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-transform duration-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-7 pt-8 pb-10">
          <GbsMark />
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-8">
          {sections.map((section) => {
            const items = MODULES.filter((m) => m.section === section);
            return (
              <div key={section} className="mb-7">
                <div className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70">
                  {sectionLabel[section]}
                </div>
                <ul className="space-y-px">
                  {items.map((m) => {
                    const active = pathname === m.to;
                    return (
                      <li key={m.to}>
                        <Link
                          to={m.to}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "group relative flex items-center rounded-md px-3 py-2 text-[13.5px] transition-colors duration-200",
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          {active && (
                            <span
                              aria-hidden
                              className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2"
                              style={{ background: "var(--gold)" }}
                            />
                          )}
                          <span className="truncate">{m.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-7 py-5">
          <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70">
            Powered by Grupo Guerra
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b border-border bg-background/75 px-6 backdrop-blur-xl md:px-10">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-sm text-muted-foreground">
              {greeting()}, <span className="text-foreground">{firstName || "executivo"}</span>
            </p>
          </div>

          <button
            type="button"
            className="group flex h-9 flex-1 items-center gap-2.5 rounded-full border border-border bg-card/60 px-4 text-left text-sm text-muted-foreground transition-colors duration-200 hover:border-foreground/20 hover:text-foreground md:max-w-sm"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">Pesquisar no GBS</span>
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="navy" size="sm" className="hidden rounded-full px-4 md:inline-flex">
                  Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
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
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="ml-2 hidden h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-card text-[11px] font-medium text-foreground md:grid">
              GG
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 py-10 md:px-12 md:py-14">
          <div className="fade-up">
            <Outlet />
          </div>
        </main>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
        />
      )}
    </div>
  );
}
