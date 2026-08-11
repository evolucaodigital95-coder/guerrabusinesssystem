import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useCurrentOrg } from "@/hooks/use-current-org";

/**
 * Primeiro acesso: se a organização ativa nunca iniciou o onboarding
 * (progresso 0 e status pendente), leva o usuário ao assistente uma vez.
 * Organizações já configuradas — incluindo o Grupo Guerra — nunca entram aqui.
 */
export function OnboardingGate() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, loading } = useCurrentOrg();
  const { data } = useOnboarding();

  useEffect(() => {
    if (loading || !data) return;
    if (pathname.startsWith("/app/onboarding")) return;
    if (!can("settings")) return;
    if (data.status === "pending" && data.progress_percent === 0) {
      navigate({ to: "/app/onboarding" });
    }
  }, [data, pathname, navigate, can, loading]);

  return null;
}
