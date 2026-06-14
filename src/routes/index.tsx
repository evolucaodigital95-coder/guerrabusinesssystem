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
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[var(--navy)] lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-[var(--navy-foreground)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
        />
        <GbsMark variant="light" />
        <div className="relative space-y-6">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Resultados extraordinários começam com pessoas extraordinárias.
          </h2>
          <p className="max-w-md text-sm opacity-80">
            A plataforma executiva do Grupo Guerra para gerir negócios, palestras, pessoas e legado — em um único lugar.
          </p>
        </div>
        <p className="relative text-xs uppercase tracking-[0.2em] opacity-70">
          Powered by Grupo Guerra
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <GbsMark />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Bem-vindo ao Guerra Business System
            </h1>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais para acessar o painel.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="voce@grupoguerra.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <a href="#" className="text-xs text-muted-foreground hover:text-foreground">
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
              />
            </div>
            <Button type="submit" variant="navy" size="lg" className="w-full">
              Entrar
            </Button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Powered by Grupo Guerra
          </p>

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/app/hoje" className="underline-offset-4 hover:underline">
              Continuar sem entrar (demo)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
