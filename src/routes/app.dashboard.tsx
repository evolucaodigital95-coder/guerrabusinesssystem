import { createFileRoute, redirect } from "@tanstack/react-router";

// O Dashboard foi unificado com a tela Início; links antigos continuam funcionando.
export const Route = createFileRoute("/app/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/app/hoje" });
  },
});
