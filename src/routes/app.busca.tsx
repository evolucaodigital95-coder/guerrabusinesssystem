import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Building2, User, Mic, Wallet, CalendarRange, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";

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
  component: BuscaPage,
});

type Result = {
  id: string;
  kind: "company" | "contact" | "lecture" | "agent" | "movement" | "season";
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};

function BuscaPage() {
  const { organizationId, loading } = useCurrentOrg();
  const [q, setQ] = useState("");
  const query = q.trim();

  const results = useQuery({
    queryKey: ["global-search", organizationId, query],
    enabled: !!organizationId && query.length >= 2,
    queryFn: async (): Promise<Result[]> => {
      const like = `%${query}%`;
      const [comp, ctt, lec, ag, mov, sea] = await Promise.all([
        supabase
          .from("companies")
          .select("id, legal_name, trade_name, document, city, state")
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(
            `legal_name.ilike.${like},trade_name.ilike.${like},document.ilike.${like},city.ilike.${like}`,
          )
          .limit(20),
        supabase
          .from("contacts")
          .select("id, full_name, email, phone, company_id, companies:company_id ( legal_name )")
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(20),
        supabase
          .from("lectures")
          .select(
            "id, title, theme, city, state, scheduled_at, companies:company_id ( legal_name )",
          )
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(`title.ilike.${like},theme.ilike.${like},city.ilike.${like}`)
          .limit(20),
        supabase
          .from("agents")
          .select("id, full_name, email, phone, cpf, pix_key")
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(
            `full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},cpf.ilike.${like},pix_key.ilike.${like}`,
          )
          .limit(20),
        supabase
          .from("financial_movements")
          .select(
            "id, description, category, amount, expected_amount, direction, occurs_on, companies:company_id ( legal_name )",
          )
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(`description.ilike.${like},category.ilike.${like}`)
          .limit(20),
        supabase
          .from("seasons")
          .select("id, name, starts_on, ends_on")
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .or(`name.ilike.${like}`)
          .limit(10),

      ]);

      const out: Result[] = [];

      comp.data?.forEach((c) =>
        out.push({
          id: `c-${c.id}`,
          kind: "company",
          title: c.legal_name,
          subtitle: c.trade_name ?? c.document ?? undefined,
          meta: [c.city, c.state].filter(Boolean).join(" / ") || null,
          to: "/app/crm/$id",
          params: { id: c.id },
        }),
      );

      ctt.data?.forEach((c) => {
        const comp = c.companies as { legal_name?: string } | null;
        out.push({
          id: `ct-${c.id}`,
          kind: "contact",
          title: c.full_name,
          subtitle: c.email ?? c.phone ?? undefined,
          meta: comp?.legal_name ?? null,
          to: c.company_id ? "/app/crm/$id" : "/app/crm",
          params: c.company_id ? { id: c.company_id } : undefined,
        });
      });

      lec.data?.forEach((l) => {
        const comp = l.companies as { legal_name?: string } | null;
        out.push({
          id: `l-${l.id}`,
          kind: "lecture",
          title: l.title,
          subtitle: l.theme ?? comp?.legal_name ?? undefined,
          meta:
            [
              [l.city, l.state].filter(Boolean).join(" / "),
              l.scheduled_at ? formatDate(l.scheduled_at) : null,
            ]
              .filter(Boolean)
              .join(" · ") || null,
          to: "/app/palestras/$id",
          params: { id: l.id },
        });
      });

      ag.data?.forEach((a) =>
        out.push({
          id: `a-${a.id}`,
          kind: "agent",
          title: a.full_name,
          subtitle: a.email ?? a.phone ?? a.cpf ?? undefined,
          meta: a.pix_key ?? null,
          to: "/app/agendistas/$id",
          params: { id: a.id },
        }),
      );

      mov.data?.forEach((m) => {
        const comp = m.companies as { legal_name?: string } | null;
        const value = Number(m.amount ?? m.expected_amount ?? 0);
        out.push({
          id: `m-${m.id}`,
          kind: "movement",
          title: m.description ?? m.category ?? "Lançamento",
          subtitle:
            [m.direction === "in" ? "Entrada" : "Saída", m.category, comp?.legal_name]
              .filter(Boolean)
              .join(" · ") || undefined,
          meta:
            [formatCurrency(value), m.occurs_on ? formatDate(m.occurs_on) : null]
              .filter(Boolean)
              .join(" · ") || null,
          to: "/app/financeiro",
          search: { lancamento: m.id },
        });
      });

      sea.data?.forEach((s) =>
        out.push({
          id: `s-${s.id}`,
          kind: "season",
          title: s.name,
          subtitle: s.starts_on ? formatDate(s.starts_on) : undefined,
          to: "/app/temporadas",
        }),
      );

      return out;
    },
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
    };
  }, [results.data]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pesquisa"
        title="Buscar em todo o sistema"
        description="Empresas, contatos, palestras, agendistas, lançamentos financeiros e temporadas."
      />

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Digite empresa, contato, CNPJ, telefone, palestra, cidade, CPF, PIX, valor…"
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
          <Group label="Empresas" icon={<Building2 className="h-4 w-4" />} items={grouped.company} />
          <Group label="Contatos" icon={<User className="h-4 w-4" />} items={grouped.contact} />
          <Group label="Palestras" icon={<Mic className="h-4 w-4" />} items={grouped.lecture} />
          <Group label="Agendistas" icon={<Users className="h-4 w-4" />} items={grouped.agent} />
          <Group label="Financeiro" icon={<Wallet className="h-4 w-4" />} items={grouped.movement} />
          <Group label="Temporadas" icon={<CalendarRange className="h-4 w-4" />} items={grouped.season} />
        </div>
      )}
    </div>
  );
}

function Group({
  label,
  icon,
  items,
}: {
  label: string;
  icon: React.ReactNode;
  items: Result[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
                <p className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
