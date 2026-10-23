import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GbsMark } from "@/components/gbs-mark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-session";
import { authErrorMessage } from "@/lib/auth-messages";
import { HERO_IMAGES, heroSrc, heroSrcSet } from "@/lib/hero-images";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GBS — Sistema de gestão para palestrantes e grupos empresariais" },
      {
        name: "description",
        content:
          "GBS é o sistema do Grupo Guerra para gestão de palestras, CRM, financeiro, estoque e inteligência operacional. Acesse sua conta para continuar.",
      },
      {
        property: "og:title",
        content: "GBS — Sistema de gestão para palestrantes e grupos empresariais",
      },
      {
        property: "og:description",
        content:
          "Plataforma premium do Grupo Guerra que unifica operação, estratégia e inteligência em um único ambiente.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://guerrabusinesssystem.lovable.app/" },
      {
        name: "twitter:title",
        content: "GBS — Sistema de gestão para palestrantes e grupos empresariais",
      },
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

type Mode = "sign_in" | "sign_up" | "forgot";

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
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setMode("sign_in");
      } else if (mode === "sign_up") {
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
      toast.error(authErrorMessage(err));
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

  const copy = {
    sign_in: {
      title: "Bem-vindo de volta",
      subtitle: "Entre para continuar de onde parou.",
      submit: "Entrar",
    },
    sign_up: {
      title: "Crie sua conta",
      subtitle: "Comece com seu workspace privado.",
      submit: "Criar conta",
    },
    forgot: {
      title: "Recuperar acesso",
      subtitle: "Informe seu e-mail e enviaremos um link para criar uma nova senha.",
      submit: "Enviar link de recuperação",
    },
  }[mode];

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-ink lg:grid-cols-[1.15fr_1fr]">
      {/* Fundo: foto em tela cheia com zoom lento */}
      <div aria-hidden className="absolute inset-0">
        <img
          src={heroSrc(HERO_IMAGES.login, 1920)}
          srcSet={heroSrcSet(HERO_IMAGES.login)}
          sizes="100vw"
          alt=""
          className="ken-burns h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,oklch(0.16_0.01_60/0.92)_0%,oklch(0.16_0.01_60/0.72)_45%,oklch(0.16_0.01_60/0.35)_100%)]" />
        <div
          className="absolute -bottom-48 -left-32 h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--clay), transparent)" }}
        />
      </div>

      <aside className="relative hidden flex-col justify-between p-14 text-ink-foreground lg:flex">
        <div className="reveal">
          <GbsMark variant="light" />
        </div>
        <div className="max-w-xl">
          <p
            className="reveal text-[12px] font-medium uppercase tracking-[0.18em] text-clay"
            style={{ "--i": 1 } as CSSProperties}
          >
            Guerra Business System
          </p>
          <h1
            className="reveal mt-5 font-display text-[3.75rem] leading-[1.02]"
            style={{ "--i": 2 } as CSSProperties}
          >
            Cada palestra,
            <br />
            cada número,
            <br />
            <span className="italic text-gold">no seu controle.</span>
          </h1>
          <p
            className="reveal mt-7 max-w-md text-[15px] leading-relaxed text-ink-foreground/75"
            style={{ "--i": 3 } as CSSProperties}
          >
            Palestras, CRM, financeiro, estoque e inteligência operacional reunidos em um único
            ambiente — com a segurança de que cada lançamento confere.
          </p>
        </div>
        <p
          className="reveal text-[11px] uppercase tracking-[0.12em] text-ink-foreground/50"
          style={{ "--i": 4 } as CSSProperties}
        >
          Powered by <span className="text-gold">Grupo Guerra</span>
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-12 md:px-12">
        <div
          className="reveal w-full max-w-[420px] rounded-3xl border border-white/10 bg-card/95 p-8 shadow-[0_40px_120px_-40px_oklch(0_0_0/0.7)] backdrop-blur-xl md:p-10"
          style={{ "--i": 2 } as CSSProperties}
        >
          <div className="mb-10 lg:hidden">
            <GbsMark />
          </div>
          <h2 className="font-display text-[2rem] leading-tight text-foreground">{copy.title}</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">{copy.subtitle}</p>

          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-8 h-10 w-full"
                onClick={handleGoogle}
                disabled={busy}
              >
                <GoogleIcon /> Continuar com Google
              </Button>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou{" "}
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form
            onSubmit={handleSubmit}
            className={mode === "forgot" ? "mt-8 space-y-4" : "space-y-4"}
          >
            {mode === "sign_up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  className="h-10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                className="h-10"
                autoComplete="email"
                placeholder="voce@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "sign_in" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  className="h-10"
                  autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}
            <Button type="submit" variant="brand" className="h-10 w-full" disabled={busy}>
              {busy ? "Aguarde…" : copy.submit}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "sign_in" ? "Ainda não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {mode === "sign_in" ? "Criar conta" : "Entrar"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
