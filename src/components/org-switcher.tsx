import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function OrgSwitcher({ className }: { className?: string }) {
  const { organizationName, organizationId, memberships, setActiveOrg, role, loading, switching } =
    useCurrentOrg();

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>Sem organização</div>
    );
  }

  const content = (
    <>
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium text-foreground">{organizationName}</span>
      {switching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </>
  );

  // Organização única: mostra sem exigir seleção manual.
  if (memberships.length === 1) {
    return (
      <div
        className={cn("flex min-w-0 items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[13px]", className)}
        title={role ? ROLE_LABEL[role] : undefined}
      >
        {content}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[13px] transition-colors hover:border-foreground/20",
            className,
          )}
          aria-label="Trocar organização"
        >
          {content}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.organizationId}
            onSelect={() => setActiveOrg(m.organizationId)}
            className="flex items-start gap-2"
          >
            <Check
              className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0",
                m.organizationId === organizationId ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="min-w-0">
              <span className="block truncate">{m.organizationName}</span>
              <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[m.role]}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
