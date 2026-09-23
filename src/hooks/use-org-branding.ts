import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export type OrgBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
};

const FALLBACK: OrgBranding = {
  name: "GBS",
  logoUrl: null,
  primaryColor: null,
  secondaryColor: null,
  legalName: null,
  phone: null,
  email: null,
  city: null,
  state: null,
  website: null,
};

/**
 * Identidade visual da organização ativa, para uso nos documentos/PDFs.
 * Nenhum cálculo é afetado — apenas apresentação.
 */
export function useOrgBranding() {
  const { organizationId, organizationName } = useCurrentOrg();

  const query = useQuery({
    queryKey: ["org-branding", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<OrgBranding> => {
      const { data, error } = await supabase
        .from("organization_settings")
        .select(
          "display_name, legal_name, logo_url, primary_color, secondary_color, phone, email, city, state, website",
        )
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return {
        name: data?.display_name || organizationName || FALLBACK.name,
        logoUrl: data?.logo_url ?? null,
        primaryColor: data?.primary_color ?? null,
        secondaryColor: data?.secondary_color ?? null,
        legalName: data?.legal_name ?? null,
        phone: data?.phone ?? null,
        email: data?.email ?? null,
        city: data?.city ?? null,
        state: data?.state ?? null,
        website: data?.website ?? null,
      };
    },
  });

  return query.data ?? { ...FALLBACK, name: organizationName ?? FALLBACK.name };
}
