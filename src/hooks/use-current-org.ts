import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

export function useCurrentOrg() {
  const { user, loading } = useSession();
  const query = useQuery({
    queryKey: ["current-org", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations:organization_id ( id, name )")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return {
    loading: loading || query.isLoading,
    organizationId: query.data?.organization_id ?? null,
    organizationName: (query.data?.organizations as { name?: string } | null)?.name ?? null,
    role: query.data?.role ?? null,
  };
}
