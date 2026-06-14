import { createFileRoute } from "@tanstack/react-router";
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

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="hover-lift group rounded-2xl border border-border bg-card p-7">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-6 font-display text-[2rem] leading-none text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function HojePage() {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <section className="mb-20">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span
            aria-hidden
            className="h-px w-6"
            style={{ background: "var(--gold)" }}
          />
          Hoje · {today}
        </div>
        <h1 className="mt-6 font-display text-5xl leading-[1.05] md:text-6xl">
          {greeting()}, Gustavo.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Resultados extraordinários começam com pessoas extraordinárias.
        </p>
      </section>

      {/* Vidas Impactadas — feature card */}
      <section className="mb-16">
        <div
          className="hover-lift relative overflow-hidden rounded-3xl p-10 md:p-14"
          style={{
            background: "var(--navy)",
            color: "var(--navy-foreground)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(closest-side, var(--gold), transparent)" }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-[var(--navy-foreground)]/65">
              <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
              Vidas Impactadas
            </div>
            <div className="mt-8 font-display text-7xl leading-none tracking-tight md:text-[6.5rem]">
              128.430
            </div>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-[var(--navy-foreground)]/70">
              Pessoas transformadas pelas palestras, mentorias e projetos do Grupo Guerra.
            </p>
          </div>
        </div>
      </section>

      {/* Visão do dia */}
      <section>
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Visão do dia
            </div>
            <h2 className="mt-3 font-display text-2xl">Indicadores principais</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Receita prevista" value="R$ 482.300" hint="Este mês" />
          <Stat label="Lucro líquido" value="R$ 184.920" hint="Após custos" />
          <Stat label="Próximas palestras" value="07" hint="Próximos 30 dias" />
          <Stat label="Follow-ups pendentes" value="14" hint="Para hoje" />
          <Stat label="Estoque baixo" value="03" hint="Itens em reposição" />
          <Stat label="Pendências financeiras" value="R$ 38.450" hint="A receber" />
          <Stat label="Meta do mês" value="64%" hint="R$ 320k de R$ 500k" />
          <Stat label="Temporada atual" value="2026.1" hint="01 jan – 30 jun" />
        </div>
      </section>
    </div>
  );
}
