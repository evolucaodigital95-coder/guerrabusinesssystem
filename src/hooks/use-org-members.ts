import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrgMember = { user_id: string; full_name: string | null; email: string | null };

export function useOrgMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["org-members", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgMember[]> => {
      const { data: members, error } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId!)
        .is("archived_at", null);
      if (error) throw error;
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (pErr) throw pErr;
      const map = new Map(profiles?.map((p) => [p.id, p]));
      return ids.map((id) => {
        const p = map.get(id);
        return { user_id: id, full_name: p?.full_name ?? null, email: p?.email ?? null };
      });
    },
  });
}
