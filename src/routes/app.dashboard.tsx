import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-shell";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GBS" }] }),
  component: DashboardPage,
});

const monthly = [
  { m: "Jan", r: 280, l: 110 },
  { m: "Fev", r: 320, l: 130 },
  { m: "Mar", r: 360, l: 150 },
  { m: "Abr", r: 410, l: 170 },
  { m: "Mai", r: 380, l: 160 },
  { m: "Jun", r: 482, l: 184 },
];

const ranking = [
  { name: "Mariana Costa", deals: 38, value: "R$ 184k" },
  { name: "Rafael Lima", deals: 31, value: "R$ 152k" },
  { name: "Juliana Reis", deals: 27, value: "R$ 138k" },
  { name: "Thiago Alves", deals: 22, value: "R$ 102k" },
  { name: "Bruna Mendes", deals: 18, value: "R$ 86k" },
];

function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  const positive = delta.startsWith("+");
  return (
    <div className="hover-lift rounded-2xl border border-border bg-card p-7">
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-6 font-display text-[2rem] leading-none">{value}</div>
      <div className={`mt-3 text-xs ${positive ? "text-emerald-600" : "text-destructive"}`}>
        {delta} vs mês anterior
      </div>
    </div>
  );
}

function DashboardPage() {
  const maxR = Math.max(...monthly.map((d) => d.r));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Visão Geral"
        title="Dashboard"
        description="Indicadores executivos e performance consolidada do Grupo Guerra."
        actions={
          <>
            <Button variant="ghost" size="sm" className="text-muted-foreground">Atualizar</Button>
            <Button variant="navy" size="sm" className="rounded-full px-5">Exportar</Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita" value="R$ 482k" delta="+12,4%" />
        <Kpi label="Lucro" value="R$ 184k" delta="+8,1%" />
        <Kpi label="Palestras realizadas" value="42" delta="+5" />
        <Kpi label="Empresas atendidas" value="28" delta="+3" />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-8 lg:col-span-2">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Evolução
              </div>
              <h3 className="mt-2 font-display text-2xl">Receita & Lucro</h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-px w-4" style={{ background: "var(--navy)" }} />
                Receita
              </span>
              <span className="flex items-center gap-2">
                <span className="h-px w-4" style={{ background: "var(--gold)" }} />
                Lucro
              </span>
            </div>
          </div>
          <div className="flex h-56 items-end justify-between gap-4">
            {monthly.map((d) => (
              <div key={d.m} className="flex flex-1 flex-col items-center gap-3">
                <div className="flex w-full items-end justify-center gap-1.5">
                  <div
                    className="w-2 rounded-full transition-all duration-700"
                    style={{ height: `${(d.r / maxR) * 180}px`, background: "var(--navy)" }}
                  />
                  <div
                    className="w-2 rounded-full transition-all duration-700"
                    style={{ height: `${(d.l / maxR) * 180}px`, background: "var(--gold)" }}
                  />
                </div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{d.m}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Conversão
          </div>
          <h3 className="mt-2 font-display text-2xl">Leads → Clientes</h3>
          <div className="mt-8 grid place-items-center">
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--gold) 0 ${0.34 * 360}deg, var(--muted) ${0.34 * 360}deg 360deg)`,
              }}
            >
              <div className="grid h-32 w-32 place-items-center rounded-full bg-card">
                <div className="text-center">
                  <div className="font-display text-4xl leading-none">34%</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Leads</div>
              <div className="mt-1 font-display text-xl">428</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clientes</div>
              <div className="mt-1 font-display text-xl">146</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-card p-8">
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Performance
          </div>
          <h3 className="mt-2 font-display text-2xl">Ranking de agendistas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="pb-4 pr-4 font-medium">#</th>
                <th className="pb-4 pr-4 font-medium">Agendista</th>
                <th className="pb-4 pr-4 font-medium">Reuniões</th>
                <th className="pb-4 font-medium">Receita gerada</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr
                  key={r.name}
                  className="border-b border-border/60 transition-colors duration-200 last:border-0 hover:bg-muted/40"
                >
                  <td className="py-5 pr-4 text-muted-foreground">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-5 pr-4">{r.name}</td>
                  <td className="py-5 pr-4 text-muted-foreground">{r.deals}</td>
                  <td className="py-5 font-display text-base">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
