import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MapPin, Phone, User, Building2, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader, EmptyState } from "@/components/page-shell";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { lectureStatusLabel } from "@/lib/lectures";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — GBS" },
      { name: "description", content: "Painel operacional de compromissos: hoje, amanhã, semana e mês." },
    ],
  }),
  component: AgendaPage,
});

type Range = "hoje" | "amanha" | "semana" | "mes";

function rangeBounds(r: Range) {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (r === "hoje") {
    end.setHours(23, 59, 59, 999);
  } else if (r === "amanha") {
    start.setDate(start.getDate() + 1);
    end.setDate(start.getDate());
    end.setHours(23, 59, 59, 999);
  } else if (r === "semana") {
    end.setDate(start.getDate() + 7);
  } else {
    end.setMonth(start.getMonth() + 1);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function AgendaPage() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [range, setRange] = useState<Range>("hoje");
  const { start, end } = useMemo(() => rangeBounds(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["agenda", organizationId, range],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select(`
          id, title, scheduled_at, scheduled_time, status, city, state, location, notes,
          companies:company_id ( id, trade_name, legal_name ),
          contacts:contact_id ( id, full_name, phone, email ),
          agents:agent_id ( id, full_name ),
          speakers:speaker_id ( id, full_name )
        `)
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const options: { key: Range; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "amanha", label: "Amanhã" },
    { key: "semana", label: "7 dias" },
    { key: "mes", label: "30 dias" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Operação"
        title="Agenda"
        description="Compromissos com filtro por período. Clique para abrir a palestra."
      />

      <div className="mb-8 inline-flex rounded-full border border-border bg-card p-1">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setRange(o.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              range === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {orgLoading || isLoading ? (
        <ListSkeleton rows={5} />
      ) : !data || data.length === 0 ? (
        <EmptyState message="Nenhum compromisso encontrado no período selecionado." />
      ) : (
        <div className="space-y-3">
          {data.map((l: any) => {
            const company = l.companies?.trade_name ?? l.companies?.legal_name ?? "—";
            const dt = new Date(l.scheduled_at);
            return (
              <Link
                key={l.id}
                to="/app/palestras/$id"
                params={{ id: l.id }}
                className="hover-lift block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {dt.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      <span className="mx-1">•</span>
                      {lectureStatusLabel(l.status)}
                    </div>
                    <h3 className="mt-2 font-display text-lg">{l.title || "Palestra"}</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {company}</div>
                      {(l.city || l.state) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {[l.city, l.state].filter(Boolean).join("/")}</div>}
                      {l.contacts?.full_name && <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {l.contacts.full_name}</div>}
                      {l.contacts?.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {l.contacts.phone}</div>}
                      {l.agents?.full_name && <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> Agendista: {l.agents.full_name}</div>}
                      {l.speakers?.full_name && <div className="flex items-center gap-1.5"><Mic className="h-3 w-3" /> {l.speakers.full_name}</div>}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
