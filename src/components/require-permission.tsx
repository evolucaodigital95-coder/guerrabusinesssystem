import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PERMISSION_LABEL, type Permission } from "@/lib/permissions";

export function AccessDenied({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto grid max-w-md place-items-center gap-4 py-20 text-center">
      <ShieldAlert className="h-8 w-8 text-muted-foreground" />
      <div>
        <h1 className="text-lg font-medium text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {reason ?? "Você não tem permissão para acessar esta área nesta organização."}
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/app/dashboard">Voltar ao Dashboard</Link>
      </Button>
    </div>
  );
}

/**
 * Protege uma área exigindo membership válida na organização ativa
 * e a permissão informada. O RLS continua sendo a barreira definitiva.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { loading, organizationId, can } = useCurrentOrg();

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!organizationId) {
    return <AccessDenied reason="Nenhuma organização ativa encontrada para o seu usuário." />;
  }
  if (!can(permission)) {
    return (
      <AccessDenied
        reason={`Seu papel nesta organização não permite: ${PERMISSION_LABEL[permission]}.`}
      />
    );
  }
  return <>{children}</>;
}
