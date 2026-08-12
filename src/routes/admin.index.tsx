import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-shell";
import { usePlatformOverview } from "@/hooks/use-platform";
import { money, NOT_AVAILABLE } from "@/lib/platform";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard da Plataforma — GBS Admin" },
      { name: "description", content: "Indicadores executivos do GBS como produto SaaS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-3 font-display text-2xl">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AdminDashboard() {
  const o = usePlatformOverview();

  if (o.loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  const pct = (v: number | null) => (v === null ? NOT_AVAILABLE : `${v.toFixed(1)}%`);

  return (
    <>
      <PageHeader
        eyebrow="Plataforma"
        title="Dashboard do GBS Admin"
        description="Visão executiva do GBS como produto. Indicadores que dependem de gateway de pagamento aparecem como NÃO DISPONÍVEL."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total de organizações" value={o.total} />
        <Metric label="Ativas" value={o.active} />
        <Metric label="Em teste" value={o.trial} />
        <Metric label="Inadimplentes" value={o.pastDue} />
        <Metric label="Suspensas" value={o.suspended} />
        <Metric label="Canceladas" value={o.canceled} />
        <Metric label="Expiradas" value={o.expired} />
        <Metric label="Novas (30 dias)" value={o.newOrgs} />
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Usuários vinculados" value={o.totalUsers} hint="Memberships ativas" />
        <Metric label="Assinaturas ativas" value={o.activeSubscriptions} />
        <Metric label="MRR" value={money(o.mrr)} hint="Preço contratado (sem gateway)" />
        <Metric label="ARR" value={money(o.arr)} hint="MRR × 12" />
        <Metric label="Churn" value={pct(o.churn)} hint="Canceladas / total" />
        <Metric label="Taxa de conversão" value={pct(o.conversion)} hint="Trial → assinatura ativa" />
        <Metric label="Receita recebida" value={NOT_AVAILABLE} hint="Requer gateway conectado" />
        <Metric label="Usuários ativos (sessão)" value={NOT_AVAILABLE} hint="Telemetria não coletada" />
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Precisa agir sobre uma organização?{" "}
        <Link to="/admin/clientes" className="text-foreground underline underline-offset-4">
          Abrir Clientes
        </Link>
      </p>
    </>
  );
}
