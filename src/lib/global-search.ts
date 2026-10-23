import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/crm";

/** Busca única do GBS — usada na página de Pesquisa e na paleta ⌘K. */
export type Result = {
  id: string;
  kind: "company" | "contact" | "lecture" | "agent" | "movement" | "season" | "stock";
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
};

export async function searchEverything(organizationId: string, query: string): Promise<Result[]> {
  // Vírgulas e parênteses quebram a sintaxe do filtro `or` do PostgREST.
  const safe = query.replace(/[,()"\\]/g, " ").trim();
  if (safe.length < 2) return [];
  const like = `%${safe}%`;
  const [comp, ctt, lec, ag, mov, sea, stk] = await Promise.all([
    supabase
      .from("companies")
      .select("id, legal_name, trade_name, document, city, state")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(
        `legal_name.ilike.${like},trade_name.ilike.${like},document.ilike.${like},city.ilike.${like}`,
      )
      .limit(20),
    supabase
      .from("contacts")
      .select("id, full_name, email, phone, company_id, companies:company_id ( legal_name )")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(20),
    supabase
      .from("lectures")
      .select("id, title, theme, city, state, scheduled_at, companies:company_id ( legal_name )")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`title.ilike.${like},theme.ilike.${like},city.ilike.${like}`)
      .limit(20),
    supabase
      .from("agents")
      .select("id, full_name, email, phone, cpf, pix_key")
      .eq("organization_id", organizationId)
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
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`description.ilike.${like},category.ilike.${like}`)
      .limit(20),
    supabase
      .from("seasons")
      .select("id, name, starts_on, ends_on")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`name.ilike.${like}`)
      .limit(10),
    supabase
      .from("stock_items")
      .select("id, name, sku, category, location")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .or(`name.ilike.${like},sku.ilike.${like},category.ilike.${like}`)
      .limit(15),
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
      to: "/app/temporadas/$id",
      params: { id: s.id },
    }),
  );

  stk.data?.forEach((i) =>
    out.push({
      id: `st-${i.id}`,
      kind: "stock",
      title: i.name,
      subtitle: [i.category, i.sku].filter(Boolean).join(" · ") || undefined,
      meta: i.location ?? null,
      to: "/app/estoque/$id",
      params: { id: i.id },
    }),
  );

  return out;
  return out;
}
