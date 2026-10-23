import {
  Link,
  Outlet,
  Navigate,
  createFileRoute,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  ChevronsUpDown,
  LogOut,
  Menu,
  Mic,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  UserCog,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GbsGlyph, GbsMark } from "@/components/gbs-mark";
import { MODULES } from "@/lib/modules";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { OrgProvider, ORG_STATUS_LABEL } from "@/components/org-provider";
import { OrgSwitcher } from "@/components/org-switcher";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { SubscriptionBanner } from "@/components/subscription-guard";

export const Route = createFileRoute("/app")({
  component: AppRoute,
});

function AppRoute() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <GbsGlyph className="animate-pulse" />
      </div>
    );
  }
  if (!session) return <Navigate to="/" />;

  return (
    <OrgProvider>
      <OnboardingGate />
      <AppLayout />
    </OrgProvider>
  );
}

const SECTIONS = ["principal", "operação", "gestão", "inteligência", "sistema"] as const;
const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  principal: "Principal",
  operação: "Operação",
  gestão: "Gestão",
  inteligência: "Inteligência",
  sistema: "Sistema",
};

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { can, switching, organizationStatus, isOrgActive } = useCurrentOrg();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const firstName = fullName.split(" ")[0] || user?.email?.split("@")[0] || "";
  const initials = (firstName || "GG").slice(0, 2).toUpperCase();

  // ⌘K / Ctrl+K abre a busca global.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate({ to: "/app/busca" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Fecha o menu móvel ao trocar de página.
  useEffect(() => setMobileOpen(false), [pathname]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Menu lateral */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:translate-x-0",
          mobileOpen ? "flex translate-x-0" : "hidden -translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link to="/app/hoje" aria-label="Início">
            <GbsMark />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 pb-3">
          <OrgSwitcher className="w-full" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {SECTIONS.map((section) => {
            const items = MODULES.filter((m) => m.section === section);
            return (
              <div key={section} className="mt-4 first:mt-1">
                <div className="mb-1 px-2.5 text-[11px] font-medium text-muted-foreground/80">
                  {SECTION_LABEL[section]}
                </div>
                <ul className="space-y-px">
                  {items.map((m) => {
                    const active = pathname === m.to || pathname.startsWith(m.to + "/");
                    const Icon = m.icon;
                    return (
                      <li key={m.to}>
                        <Link
                          to={m.to}
                          className={cn(
                            "group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13.5px] transition-colors duration-150",
                            active
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-colors",
                              active
                                ? "text-clay"
                                : "text-muted-foreground group-hover:text-foreground",
                            )}
                          />
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

        {/* Conta */}
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/70"
                aria-label="Conta"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-medium text-ink-foreground">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {fullName || firstName || "Minha conta"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user?.email}
                  </span>
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-[236px]">
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/app/minha-conta">
                  <UserRound /> Minha conta
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/app/configuracoes">
                  <Settings /> Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={toggleTheme}>
                {theme === "dark" ? <Sun /> : <Moon />}
                {theme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mt-2 px-2 text-[11px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            Powered by <span className="text-gold">Grupo Guerra</span>
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/app/busca" })}
            className="group flex h-9 flex-1 items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-[var(--shadow-elegant)] transition-colors duration-150 hover:border-foreground/20 hover:text-foreground md:max-w-md"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">Pesquisar no GBS…</span>
            <kbd className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground md:inline-flex">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {can("create") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="brand" size="sm" className="h-9 px-3">
                    <Plus />
                    <span className="hidden md:inline">Novo</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Criar
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to="/app/crm">
                      <Users /> Empresa
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/palestras">
                      <Mic /> Palestra
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/financeiro" search={{ lancamento: undefined }}>
                      <Wallet /> Lançamento
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/agendistas">
                      <UserCog /> Agendista
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/projetos">
                      <Briefcase /> Projeto
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>

        {organizationStatus && !isOrgActive && (
          <div className="border-b border-gold/30 bg-gold/10 px-4 py-2.5 text-sm text-foreground md:px-8">
            Esta organização está <strong>{ORG_STATUS_LABEL[organizationStatus]}</strong>. Os dados
            continuam disponíveis para consulta e exportação, mas novas alterações estão bloqueadas.
          </div>
        )}
        <SubscriptionBanner />

        <main className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-12">
          {switching ? (
            <div className="grid place-items-center py-24 text-sm text-muted-foreground">
              Trocando de organização…
            </div>
          ) : (
            <div key={pathname} className="fade-up mx-auto w-full max-w-[1280px]">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[oklch(0.2_0.01_60/0.3)] backdrop-blur-[2px] lg:hidden"
        />
      )}
    </div>
  );
}
