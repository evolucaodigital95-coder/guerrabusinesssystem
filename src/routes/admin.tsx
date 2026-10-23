import { Link, Outlet, Navigate, createFileRoute, useRouterState } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { usePlatformAdmin } from "@/hooks/use-platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "GBS Admin — Plataforma" },
      {
        name: "description",
        content: "Administração da plataforma GBS: organizações, planos e assinaturas.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoute,
});

const NAV = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/clientes", label: "Clientes" },
  { to: "/admin/planos", label: "Planos" },
  { to: "/admin/auditoria", label: "Auditoria" },
];

function AdminRoute() {
  const { session, loading: sessionLoading } = useSession();
  const { isPlatformAdmin, loading } = usePlatformAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (sessionLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Verificando privilégios…
      </div>
    );
  }
  if (!session) return <Navigate to="/" />;

  // ACESSO NEGADO — ser admin de uma ORGANIZAÇÃO não dá acesso ao GBS ADMIN.
  // O backend (RLS) também bloqueia: as tabelas de plataforma só respondem a admins globais.
  if (!isPlatformAdmin) {
    return (
      <div className="mx-auto grid min-h-screen max-w-md place-items-center gap-4 px-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-9 w-9 text-destructive" />
          <h1 className="mt-5 font-display text-3xl">ACESSO NEGADO</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            O GBS Admin é restrito a administradores globais da plataforma.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/hoje">Voltar ao GBS</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
          <Link
            to="/app/hoje"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> GBS
          </Link>
          <span
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ color: "var(--gold)" }}
          >
            GBS Admin
          </span>
          <nav className="ml-auto flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.to
                : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}
