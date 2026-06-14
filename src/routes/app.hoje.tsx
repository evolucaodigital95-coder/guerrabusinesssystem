import { createFileRoute } from "@tanstack/react-router";
import {
  Heart,
  TrendingUp,
  Wallet,
  Mic,
  PhoneCall,
  PackageX,
  AlertCircle,
  Target,
  CalendarRange,
  ArrowUpRight,
} from "lucide-react";
import { type ReactNode } from "react";

export const Route = createFileRoute("/app/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — GBS" },
      { name: "description", content: "Sua visão executiva do dia no Guerra Business System." },
    ],
  }),
  component: HojePage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "good";
}) {
  const dot =
    tone === "warning" ? "bg-amber-500" : tone === "good" ? "bg-emerald-500" : "bg-[var(--gold)]";
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)] transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground/70">
          {icon}
        </div>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
      </div>
      <div className="mt-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function HojePage() {
  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero */}
      <section className="mb-8">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--gold)]">
          Hoje · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting()}, Gustavo.
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Resultados extraordinários começam com pessoas extraordinárias.
        </p>
      </section>

      {/* Hero card — Vidas Impactadas */}
      <section className="mb-8">
        <div
          className="relative overflow-hidden rounded-3xl p-8 text-[var(--navy-foreground)] shadow-[var(--shadow-elegant)] md:p-10"
          style={{ background: "linear-gradient(135deg, var(--navy), oklch(0.34 0.08 254))" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
          />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
                <Heart className="h-4 w-4 text-[var(--gold)]" />
                Vidas Impactadas
              </div>
              <div className="mt-3 text-5xl font-semibold tracking-tight md:text-6xl">
                128.430
              </div>
              <p className="mt-2 max-w-md text-sm opacity-80">
                Pessoas transformadas pelas palestras, mentorias e projetos do Grupo Guerra.
              </p>
            </div>
            <button className="hidden items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-white/10 md:inline-flex">
              Ver detalhes <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Stat grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Visão do dia
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Receita prevista" value="R$ 482.300" hint="Este mês" tone="good" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Lucro líquido" value="R$ 184.920" hint="Após custos" tone="good" />
          <StatCard icon={<Mic className="h-5 w-5" />} label="Próximas palestras" value="7" hint="Próximos 30 dias" />
          <StatCard icon={<PhoneCall className="h-5 w-5" />} label="Follow-ups pendentes" value="14" hint="Hoje" tone="warning" />
          <StatCard icon={<PackageX className="h-5 w-5" />} label="Estoque baixo" value="3 itens" hint="Reposição necessária" tone="warning" />
          <StatCard icon={<AlertCircle className="h-5 w-5" />} label="Pendências financeiras" value="R$ 38.450" hint="A receber" tone="warning" />
          <StatCard icon={<Target className="h-5 w-5" />} label="Meta do mês" value="64%" hint="R$ 320k / R$ 500k" />
          <StatCard icon={<CalendarRange className="h-5 w-5" />} label="Temporada atual" value="2026.1" hint="01 jan – 30 jun" />
        </div>
      </section>
    </div>
  );
}
