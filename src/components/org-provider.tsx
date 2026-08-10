import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { hasPermission, type OrgRole, type Permission } from "@/lib/permissions";

const STORAGE_KEY = "gbs.active-organization";

export type Membership = {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
};

type OrgContextValue = {
  loading: boolean;
  switching: boolean;
  memberships: Membership[];
  organizationId: string | null;
  organizationName: string | null;
  role: OrgRole | null;
  setActiveOrg: (id: string) => void;
  can: (permission: Permission) => boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const query = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations:organization_id ( id, name )")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        organizationId: m.organization_id,
        organizationName:
          (m.organizations as { name?: string } | null)?.name ?? "Organização",
        role: m.role as OrgRole,
      }));
    },
  });

  const memberships = useMemo(() => query.data ?? [], [query.data]);

  // Restaura a organização ativa (localStorage) validando contra as memberships reais.
  useEffect(() => {
    if (memberships.length === 0) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => {
      if (current && memberships.some((m) => m.organizationId === current)) return current;
      const stored = readStored();
      if (stored && memberships.some((m) => m.organizationId === stored)) return stored;
      return memberships[0].organizationId;
    });
  }, [memberships]);

  const setActiveOrg = useCallback(
    (id: string) => {
      if (id === activeId) return;
      setSwitching(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* storage indisponível */
      }
      setActiveId(id);
      // Descarta todo o cache para nunca exibir dados da organização anterior.
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
      window.setTimeout(() => setSwitching(false), 350);
    },
    [activeId, queryClient],
  );

  const active = memberships.find((m) => m.organizationId === activeId) ?? null;
  const role = active?.role ?? null;

  const value: OrgContextValue = {
    loading: sessionLoading || query.isLoading,
    switching,
    memberships,
    organizationId: active?.organizationId ?? null,
    organizationName: active?.organizationName ?? null,
    role,
    setActiveOrg,
    can: (permission: Permission) => hasPermission(role, permission),
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    // Fora do provider (ex.: rotas públicas) devolvemos um estado neutro.
    return {
      loading: false,
      switching: false,
      memberships: [],
      organizationId: null,
      organizationName: null,
      role: null,
      setActiveOrg: () => {},
      can: () => false,
    };
  }
  return ctx;
}
