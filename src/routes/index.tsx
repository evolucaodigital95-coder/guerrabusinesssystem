import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GbsMark } from "@/components/gbs-mark";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — GBS Guerra Business System" },
      { name: "description", content: "Acesse o Guerra Business System." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    navigate({ to: "/app/hoje" });
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
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

        <div className="relative max-w-md space-y-8">
          <div
            aria-hidden
            className="h-px w-12"
            style={{ background: "var(--gold)" }}
          />
          <h2 className="font-display text-[2.75rem] leading-[1.1] tracking-tight">
            Resultados extraordinários começam com pessoas extraordinárias.
          </h2>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--navy-foreground)]/70">
            A plataforma executiva do Grupo Guerra para gerir negócios, palestras,
            pessoas e legado — em um único lugar.
          </p>
        </div>

        <p className="relative text-[10px] uppercase tracking-[0.32em] text-[var(--navy-foreground)]/55">
          Powered by Grupo Guerra
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-16">
        <div className="w-full max-w-sm space-y-12">
          <div className="lg:hidden">
            <GbsMark />
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-3xl leading-tight">
              Bem-vindo ao Guerra Business System
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Entre com suas credenciais para acessar o painel executivo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="voce@grupoguerra.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg border-border bg-card"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
                <a href="#" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                  Esqueceu?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-lg border-border bg-card"
              />
            </div>
            <Button
              type="submit"
              variant="navy"
              className="h-11 w-full rounded-lg text-sm font-medium transition-all duration-300 hover:opacity-95"
            >
              Entrar
            </Button>
          </form>

          <div className="space-y-4">
            <p className="text-center text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Powered by Grupo Guerra
            </p>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/app/hoje" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
                Continuar sem entrar (demo)
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
