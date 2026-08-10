import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ThumbsUp, ThumbsDown, Bug, Lightbulb, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { toast } from "sonner";
import { RequirePermission } from "@/components/require-permission";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — GBS" },
      { name: "description", content: "Informações da versão, novidades e canal de feedback do GBS." },
    ],
  }),
  component: () => (
    <RequirePermission permission="settings">
      <ConfigPage />
    </RequirePermission>
  ),
});

type FeedbackKind = "gostei" | "nao_gostei" | "bug" | "ideia" | "melhoria";

const FEEDBACK_OPTIONS: { kind: FeedbackKind; label: string; icon: typeof ThumbsUp; tone: string }[] = [
  { kind: "gostei", label: "Gostei", icon: ThumbsUp, tone: "text-emerald-600" },
  { kind: "nao_gostei", label: "Não gostei", icon: ThumbsDown, tone: "text-rose-600" },
  { kind: "bug", label: "Bug", icon: Bug, tone: "text-amber-600" },
  { kind: "ideia", label: "Ideia", icon: Lightbulb, tone: "text-yellow-600" },
  { kind: "melhoria", label: "Melhoria", icon: Sparkles, tone: "text-sky-600" },
];

const NOVIDADES = [
  "Novo CRM",
  "Novo Financeiro",
  "Conta Corrente do Agendista",
  "Dashboard Executivo Real",
  "Estoque com lotes e reservas",
  "Fechamento Financeiro de Palestra",
  "Centro de Inteligência (BI)",
];

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 font-display text-xl leading-none">{value}</div>
    </div>
  );
}

function ConfigPage() {
  const { session } = useSession();
  const { organizationId } = useCurrentOrg();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const [openKind, setOpenKind] = useState<FeedbackKind | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const current = FEEDBACK_OPTIONS.find((o) => o.kind === openKind);

  async function submit() {
    if (!openKind || !session?.user?.id) return;
    setSubmitting(true);
    const { error } = await supabase.from("user_feedback").insert({
      user_id: session.user.id,
      organization_id: organizationId ?? null,
      kind: openKind,
      message: message.trim() || null,
      route,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar seu feedback.");
      return;
    }
    toast.success("Obrigado! Seu feedback foi registrado.");
    setOpenKind(null);
    setMessage("");
  }

  const lastUpdate = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <section className="mb-12">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
          Configurações
        </div>
        <h1 className="mt-6 flex items-center gap-4 font-display text-5xl leading-[1.05]">
          <SettingsIcon className="h-10 w-10 text-muted-foreground" />
          GBS
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Guerra Business System — plataforma operacional e de inteligência do Grupo Guerra.
        </p>
      </section>

      {/* Versão */}
      <section className="mb-14">
        <div className="mb-6 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sobre esta versão</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Info label="Versão" value="1.0.0" />
          <Info label="Build" value="2026.06" />
          <Info label="Arquitetura" value="V1" />
          <Info label="Desenvolvido para" value="Grupo Guerra" />
          <Info label="Powered by" value="Grupo Guerra" />
          <Info label="Última atualização" value={lastUpdate} />
        </div>
      </section>

      {/* Novidades */}
      <section className="mb-14">
        <div
          className="relative overflow-hidden rounded-3xl p-10"
          style={{ background: "var(--navy)", color: "var(--navy-foreground)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[var(--navy-foreground)]/65">
              <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
              Versão 1.0
            </div>
            <h2 className="mt-6 font-display text-3xl">O que há de novo</h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {NOVIDADES.map((n) => (
                <li key={n} className="flex items-center gap-3 text-sm text-[var(--navy-foreground)]/90">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--gold)" }} />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section className="mb-10">
        <div className="mb-6 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Sua opinião</div>
        <div className="rounded-3xl border border-border bg-card p-8">
          <h2 className="font-display text-2xl">Como foi sua experiência?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu feedback chega direto à equipe e ajuda a evoluir o GBS.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {FEEDBACK_OPTIONS.map((o) => {
              const Icon = o.icon;
              return (
                <Button
                  key={o.kind}
                  variant="outline"
                  className="hover-lift gap-2"
                  onClick={() => {
                    setMessage("");
                    setOpenKind(o.kind);
                  }}
                >
                  <Icon className={`h-4 w-4 ${o.tone}`} />
                  {o.label}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <Dialog open={!!openKind} onOpenChange={(v) => !v && setOpenKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {current && <current.icon className={`h-5 w-5 ${current.tone}`} />}
              {current?.label}
            </DialogTitle>
            <DialogDescription>
              Conte com mais detalhes (opcional). Vamos ler todas as mensagens.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="feedback-msg">Mensagem</Label>
            <Textarea
              id="feedback-msg"
              rows={5}
              placeholder="O que você gostaria de compartilhar?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenKind(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Enviando…" : "Enviar feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
