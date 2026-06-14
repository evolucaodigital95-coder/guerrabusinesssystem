import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elegant)]">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className={`mt-1 text-xs ${positive ? "text-emerald-600" : "text-destructive"}`}>{delta} vs mês anterior</div>
    </div>
  );
}

function DashboardPage() {
  const maxR = Math.max(...monthly.map((d) => d.r));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Visão Geral"
        title="Dashboard"
        description="Indicadores executivos e performance consolidada do Grupo Guerra."
        actions={
          <>
            <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4" />Atualizar</Button>
            <Button variant="navy" size="sm"><Download className="h-4 w-4" />Exportar</Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Receita" value="R$ 482k" delta="+12,4%" />
        <Kpi label="Lucro" value="R$ 184k" delta="+8,1%" />
        <Kpi label="Palestras realizadas" value="42" delta="+5" />
        <Kpi label="Empresas atendidas" value="28" delta="+3" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Evolução mensal</h3>
              <p className="text-xs text-muted-foreground">Receita e lucro nos últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--navy)]" />Receita</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--gold)]" />Lucro</span>
            </div>
          </div>
          <div className="flex h-56 items-end justify-between gap-3 pt-4">
            {monthly.map((d) => (
              <div key={d.m} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-t-md bg-[var(--navy)] transition-all"
                    style={{ height: `${(d.r / maxR) * 180}px` }}
                  />
                  <div
                    className="w-3 rounded-t-md bg-[var(--gold)] transition-all"
                    style={{ height: `${(d.l / maxR) * 180}px` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{d.m}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <h3 className="text-base font-semibold tracking-tight">Conversão comercial</h3>
          <p className="text-xs text-muted-foreground">Leads → Clientes</p>
          <div className="mt-6 grid place-items-center">
            <div
              className="relative grid h-40 w-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--gold) 0 ${0.34 * 360}deg, var(--muted) ${0.34 * 360}deg 360deg)`,
              }}
            >
              <div className="grid h-32 w-32 place-items-center rounded-full bg-card">
                <div className="text-center">
                  <div className="text-3xl font-semibold tracking-tight">34%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">taxa</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Leads</div>
              <div className="text-lg font-semibold">428</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Clientes</div>
              <div className="text-lg font-semibold">146</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Ranking de agendistas</h3>
            <p className="text-xs text-muted-foreground">Performance no mês</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Agendista</th>
                <th className="pb-3 pr-4">Reuniões</th>
                <th className="pb-3">Receita gerada</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.name} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-medium text-muted-foreground">{i + 1}</td>
                  <td className="py-3 pr-4 font-medium">{r.name}</td>
                  <td className="py-3 pr-4">{r.deals}</td>
                  <td className="py-3 font-semibold">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
