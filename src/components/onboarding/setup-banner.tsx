import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSetupChecklist } from "@/hooks/use-onboarding";

/**
 * Aviso discreto no Dashboard enquanto a organização não concluiu o onboarding.
 * Nunca bloqueia o uso do sistema.
 */
export function SetupBanner() {
  const { loading, isComplete, progress, onboarding } = useSetupChecklist();
  if (loading || !onboarding || isComplete) return null;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <Rocket className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-medium">Configuração do seu GBS: {progress}%</div>
        <Progress value={progress} className="mt-2 h-1.5" />
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/app/onboarding">Continuar configuração</Link>
      </Button>
    </div>
  );
}
