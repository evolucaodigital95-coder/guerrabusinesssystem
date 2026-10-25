import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Landmark, Mic, Package, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useOrgSettings } from "@/hooks/use-onboarding";
import { requestQuickAction, type QuickAction } from "@/lib/quick-actions";
import { cn } from "@/lib/utils";

const DISMISS_KEY = (org: string) => `gbs-primeiros-passos-ocultos-${org}`;

/**
 * "Comece por aqui": os 4 passos que deixam uma conta nova pronta para usar.
 * Some sozinho quando tudo está feito (ou quando a pessoa fecha).
 */
export function FirstSteps() {
  const { organizationId, can } = useCurrentOrg();
  const settings = useOrgSettings();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try {
      return !!organizationId && localStorage.getItem(DISMISS_KEY(organizationId)) === "1";
    } catch {
      return false;
    }
  });

  const counts = useQuery({
    queryKey: ["first-steps", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const head = (table: "accounts" | "stock_items" | "lectures") =>
        supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!)
          .is("archived_at", null);
      const [a, i, l] = await Promise.all([
        head("accounts"),
        head("stock_items"),
        head("lectures"),
      ]);
      return { accounts: a.count ?? 0, items: i.count ?? 0, lectures: l.count ?? 0 };
    },
  });

  if (!organizationId || !can("create") || hidden || !counts.data) return null;

  const prefs = settings.data?.preferences ?? {};
  const steps: {
    done: boolean;
    icon: typeof Mic;
    title: string;
    hint: string;
    action: QuickAction | null;
    to: string;
  }[] = [
    {
      done: counts.data.accounts > 0,
      icon: Landmark,
      title: "Cadastre sua conta",
      hint: "Banco, PIX ou maquininha onde o dinheiro entra.",
      action: "nova-conta",
      to: "/app/financeiro",
    },
    {
      done: counts.data.items > 0,
      icon: Package,
      title: "Cadastre livros e kits",
      hint: "O que você vende ou usa nas palestras.",
      action: "novo-material",
      to: "/app/estoque",
    },
    {
      done: counts.data.lectures > 0,
      icon: Mic,
      title: "Crie sua primeira palestra",
      hint: "Agenda, financeiro e material de uma vez.",
      action: "palestra",
      to: "/app/palestras",
    },
    {
      done: Object.keys(prefs).length > 0,
      icon: Settings2,
      title: "Deixe do seu jeito",
      hint: "Menu, nome do agendista, dízimo e livros.",
      action: null,
      to: "/app/organizacao",
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY(organizationId!), "1");
    } catch {
      /* preferência não salva */
    }
    setHidden(true);
  }

  return (
    <section className="mb-12 rounded-[24px] border border-clay/30 bg-gradient-to-br from-clay/[0.07] to-transparent p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-medium text-clay">Comece por aqui</div>
          <h2 className="mt-1 font-display text-2xl">Deixe seu GBS pronto em poucos minutos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {done} de {steps.length} passos concluídos
          </p>
        </div>
        <button
          onClick={dismiss}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Ocultar primeiros passos"
          title="Ocultar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-clay transition-[width] duration-700"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const content = (
            <>
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                  s.done ? "bg-emerald-500/15 text-emerald-600" : "bg-clay text-clay-foreground",
                )}
              >
                {s.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    s.done && "text-muted-foreground line-through",
                  )}
                >
                  {i + 1}. {s.title}
                </span>
                <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
              </span>
              {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-clay" />}
            </>
          );
          const cls = cn(
            "flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
            s.done ? "border-border opacity-70" : "border-border hover:border-clay/50",
          );
          return (
            <li key={s.title}>
              {s.done ? (
                <div className={cls}>{content}</div>
              ) : s.action ? (
                <button
                  className={cls}
                  onClick={() => navigate({ to: s.to }).then(() => requestQuickAction(s.action!))}
                >
                  {content}
                </button>
              ) : (
                <Link to="/app/organizacao" search={{ aba: "preferencias" }} className={cls}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
