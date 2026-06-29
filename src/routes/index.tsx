import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GbsMark } from "@/components/gbs-mark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GBS — Sistema de gestão para palestrantes e grupos empresariais" },
      {
        name: "description",
        content:
          "GBS é o sistema do Grupo Guerra para gestão de palestras, CRM, financeiro, estoque e inteligência operacional. Acesse sua conta para continuar.",
      },
      { property: "og:title", content: "GBS — Sistema de gestão para palestrantes e grupos empresariais" },
      {
        property: "og:description",
        content:
          "Plataforma premium do Grupo Guerra que unifica operação, estratégia e inteligência em um único ambiente.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://guerrabusinesssystem.lovable.app/" },
      { name: "twitter:title", content: "GBS — Sistema de gestão para palestrantes e grupos empresariais" },
      {
        name: "twitter:description",
        content:
          "Plataforma premium do Grupo Guerra para palestras, CRM, financeiro e inteligência operacional.",
      },
    ],
    links: [{ rel: "canonical", href: "https://guerrabusinesssystem.lovable.app/" }],
  }),
  component: LoginPage,
});

type Mode = "sign_in" | "sign_up";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/app/hoje" />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app/hoje" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Falha no login com Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app/hoje" });
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16"
        style={{ background: "var(--navy)", color: "var(--navy-foreground)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 -right-32 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
        />
        <GbsMark variant="light" />
        <div className="relative max-w-md">
          <p className="text-[10px] uppercase tracking-[0.32em] opacity-60">Guerra Business System</p>
          <h1 className="mt-6 font-serif text-5xl leading-tight">
            GBS — Sistema de gestão para palestrantes e grupos empresariais
          </h1>
          <p className="mt-6 text-sm leading-relaxed opacity-80">
            Operação, estratégia e inteligência reunidas num único ambiente premium para o Grupo Guerra.
          </p>
        </div>
        <p className="relative text-[10px] uppercase tracking-[0.32em] opacity-60">
          Powered by Grupo Guerra
        </p>
      </div>

      <main className="flex items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <GbsMark />
          </div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            {mode === "sign_in" ? "Acessar" : "Criar conta"}
          </p>
          <h2 className="mt-3 font-serif text-3xl text-foreground">
            {mode === "sign_in" ? "Bem-vindo de volta" : "Crie sua conta"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "sign_in" ? "Entre para continuar." : "Comece com seu workspace privado."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "sign_up" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete={mode === "sign_in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" variant="navy" className="w-full rounded-full" disabled={busy}>
              {busy ? "Aguarde..." : mode === "sign_in" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full rounded-full" onClick={handleGoogle} disabled={busy}>
            Continuar com Google
          </Button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "sign_in" ? (
              <>Ainda não tem conta?{" "}
                <button onClick={() => setMode("sign_up")} className="text-foreground underline-offset-4 hover:underline">Criar conta</button>
              </>
            ) : (
              <>Já tem conta?{" "}
                <button onClick={() => setMode("sign_in")} className="text-foreground underline-offset-4 hover:underline">Entrar</button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
