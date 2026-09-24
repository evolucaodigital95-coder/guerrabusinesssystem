import { useCallback } from "react";
import { useOrgBranding } from "@/hooks/use-org-branding";
import { resolveDocBrand, type DocBrand } from "@/lib/doc-brand";

/**
 * Retorna um getter assíncrono com a identidade visual da organização ativa
 * para os geradores de documentos. Apresentação apenas — nenhum cálculo muda.
 */
export function useDocBrand(): () => Promise<DocBrand> {
  const branding = useOrgBranding();
  const { name, logoUrl, primaryColor, secondaryColor } = branding;
  return useCallback(
    () => resolveDocBrand({ name, logoUrl, primaryColor, secondaryColor }),
    [name, logoUrl, primaryColor, secondaryColor],
  );
}
