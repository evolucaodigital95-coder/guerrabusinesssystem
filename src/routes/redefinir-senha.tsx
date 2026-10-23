import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GbsMark } from "@/components/gbs-mark";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth-messages";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — GBS" },
      {
        name: "description",
        content: "Defina uma nova senha de acesso à sua conta do GBS com segurança.",
      },
      { property: "og:title", content: "Redefinir senha — GBS" },
      {
        property: "og:description",
        content: "Defina uma nova senha de acesso à sua conta do GBS com segurança.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Redefinir senha — GBS" },
      {
        name: "twitter:description",
        content: "Defina uma nova senha de acesso à sua conta do GBS com segurança.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    // O link de recuperação cria uma sessão temporária de recovery.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setValid(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setValid(true);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Senha redefinida com sucesso.");
      await supabase.auth.signOut();
      window.setTimeout(() => navigate({ to: "/" }), 1200);
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <GbsMark />
        <h1 className="mt-10 font-serif text-3xl text-foreground">Redefinir senha</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Verificando o link…</p>
        ) : done ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pronto. Você já pode entrar com a nova senha.
          </p>
        ) : !valid ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Este link é inválido ou já expirou. Solicite um novo link de recuperação na tela de
              entrada.
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              Voltar para a entrada
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" variant="brand" className="w-full" disabled={busy}>
              {busy ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
