import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgMember = { user_id: string; full_name: string | null; email: string | null };

export function useOrgMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["org-members", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgMember[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, profiles:user_id ( full_name, email )")
        .eq("organization_id", organizationId!)
        .is("archived_at", null);
      if (error) throw error;
      return (data ?? []).map((m) => {
        const p = (m.profiles ?? null) as { full_name: string | null; email: string | null } | null;
        return { user_id: m.user_id, full_name: p?.full_name ?? null, email: p?.email ?? null };
      });
    },
  });
}
