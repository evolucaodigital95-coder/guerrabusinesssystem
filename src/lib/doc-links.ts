import type { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type Nav = ReturnType<typeof useNavigate>;

/**
 * Safely navigate to a document route stored as a raw string (e.g. `/app/palestras/UUID`).
 * TanStack's `<Link to>` requires the pattern `/app/palestras/$id` + `params`,
 * so passing an interpolated URL directly crashes the router. This helper
 * matches the string against known GBS entity routes and dispatches with
 * the correct params. Falls back to a friendly toast if unrecognized or missing.
 */
export function openDoc(navigate: Nav, docRoute: string | undefined | null) {
  if (!docRoute) {
    toast.message("Este lançamento não está mais disponível.");
    return;
  }

  const matchers: Array<{ prefix: string; route: string }> = [
    { prefix: "/app/palestras/", route: "/app/palestras/$id" },
    { prefix: "/app/agendistas/", route: "/app/agendistas/$id" },
    { prefix: "/app/crm/", route: "/app/crm/$id" },
    { prefix: "/app/estoque/", route: "/app/estoque/$id" },
    { prefix: "/app/temporadas/", route: "/app/temporadas/$id" },
    { prefix: "/app/projetos/", route: "/app/projetos/$id" },
    { prefix: "/app/campanhas/", route: "/app/campanhas/$id" },
  ];

  for (const m of matchers) {
    if (docRoute.startsWith(m.prefix)) {
      const id = docRoute.slice(m.prefix.length).split(/[/?#]/)[0];
      if (!id) {
        toast.message("Este lançamento não está mais disponível.");
        return;
      }
      navigate({ to: m.route as never, params: { id } as never });
      return;
    }
  }

  // Static targets (e.g. /app/financeiro, /app/estoque)
  navigate({ to: docRoute as never });
}
