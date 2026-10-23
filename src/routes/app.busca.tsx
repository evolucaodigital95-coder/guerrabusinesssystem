import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, User, Mic, Wallet, CalendarRange, Users, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-shell";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { searchEverything, type Result } from "@/lib/global-search";

export const Route = createFileRoute("/app/busca")({
  head: () => ({
    meta: [
      { title: "Pesquisa — GBS" },
      {
        name: "description",
        content:
          "Pesquisa única em empresas, contatos, palestras, agendistas, financeiro e temporadas.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { organizationId, loading } = useCurrentOrg();
  const initial = Route.useSearch().q ?? "";
  const [q, setQ] = useState(initial);
  const query = q.trim();

  const results = useQuery({
    queryKey: ["global-search", organizationId, query],
    enabled: !!organizationId && query.length >= 2,
    queryFn: () => searchEverything(organizationId!, query),
  });

  const grouped = useMemo(() => {
    const list = results.data ?? [];
    return {
      company: list.filter((r) => r.kind === "company"),
      contact: list.filter((r) => r.kind === "contact"),
      lecture: list.filter((r) => r.kind === "lecture"),
      agent: list.filter((r) => r.kind === "agent"),
      movement: list.filter((r) => r.kind === "movement"),
      season: list.filter((r) => r.kind === "season"),
      stock: list.filter((r) => r.kind === "stock"),
    };
  }, [results.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pesquisa"
        title="Buscar em todo o sistema"
        description="Empresas, contatos, palestras, agendistas, lançamentos, temporadas e estoque."
      />

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite empresa, contato, CNPJ, telefone, palestra, cidade, CPF, PIX, material…"
            className="rounded-full pl-10 text-base"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : query.length < 2 ? (
        <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar.</p>
      ) : results.isLoading ? (
        <p className="text-sm text-muted-foreground">Buscando…</p>
      ) : (results.data ?? []).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nada encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste os termos da busca e tente novamente.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <Group
            label="Empresas"
            icon={<Building2 className="h-4 w-4" />}
            items={grouped.company}
          />
          <Group label="Contatos" icon={<User className="h-4 w-4" />} items={grouped.contact} />
          <Group label="Palestras" icon={<Mic className="h-4 w-4" />} items={grouped.lecture} />
          <Group label="Agendistas" icon={<Users className="h-4 w-4" />} items={grouped.agent} />
          <Group
            label="Financeiro"
            icon={<Wallet className="h-4 w-4" />}
            items={grouped.movement}
          />
          <Group
            label="Temporadas"
            icon={<CalendarRange className="h-4 w-4" />}
            items={grouped.season}
          />
          <Group label="Estoque" icon={<Package className="h-4 w-4" />} items={grouped.stock} />
        </div>
      )}
    </div>
  );
}

function Group({ label, icon, items }: { label: string; icon: React.ReactNode; items: Result[] }) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-foreground/60">{icon}</span>
        <span>
          {label} · {items.length}
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
        {items.map((r) => {
          const content = (
            <div className="flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-card/70">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                {r.subtitle && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.subtitle}</p>
                )}
              </div>
              {r.meta && (
                <p className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {r.meta}
                </p>
              )}
            </div>
          );
          if (r.params && r.to.includes("$id")) {
            return (
              <li key={r.id}>
                <Link to={r.to as never} params={r.params as never} className="block">
                  {content}
                </Link>
              </li>
            );
          }
          return (
            <li key={r.id}>
              <Link to={r.to as never} search={r.search as never} className="block">
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
