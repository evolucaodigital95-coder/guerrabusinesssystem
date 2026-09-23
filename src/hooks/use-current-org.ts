import { useOrgContext } from "@/components/org-provider";

/**
 * Organização ATIVA do usuário (persistida em localStorage e validada
 * contra as memberships reais). O isolamento definitivo é do RLS —
 * este valor é apenas conveniência de UI/queries.
 */
export function useCurrentOrg() {
  const ctx = useOrgContext();
  return {
    loading: ctx.loading,
    switching: ctx.switching,
    organizationId: ctx.organizationId,
    organizationName: ctx.organizationName,
    organizationStatus: ctx.organizationStatus,
    isOrgActive: ctx.isOrgActive,
    role: ctx.role,
    memberships: ctx.memberships,
    setActiveOrg: ctx.setActiveOrg,
    can: ctx.can,
  };
}

/** Atalho para checagem de permissão na interface. */
export function usePermissions() {
  const ctx = useOrgContext();
  return { role: ctx.role, can: ctx.can, isOrgActive: ctx.isOrgActive };
}
