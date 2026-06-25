import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { AgentFormDialog, type AgentRow } from "@/components/agendistas/agent-form-dialog";

export const Route = createFileRoute("/app/agendistas")({
  head: () => ({
    meta: [
      { title: "Agendistas — GBS" },
      { name: "description", content: "Equipe de prospecção e agendamentos. Conta corrente, adiantamentos e fechamentos." },
    ],
  }),
  component: AgendistasPage,
});

type Agent = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  pix_key: string | null;
  pix_kind: string | null;
  status: string | null;
  created_at: string;
};

function AgendistasPage() {
  const { user } = useSession();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgentRow | null>(null);
  const [search, setSearch] = useState("");

  const agents = useQuery({
    queryKey: ["agents", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Agent[]> => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, full_name, email, phone, cpf, pix_key, pix_kind, status, created_at")
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Agent[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return agents.data ?? [];
    return (agents.data ?? []).filter((a) =>
      [a.full_name, a.email, a.phone, a.cpf, a.pix_key].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [agents.data, search]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agendistas"
        title="Equipe de prospecção"
        description="Cada agendista tem sua própria conta corrente, adiantamentos, palestras e histórico de fechamentos."
        actions={
          <Button variant="navy" className="rounded-full" onClick={() => { setEditing(null); setOpen(true); }} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendista
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, e-mail, telefone, CPF ou PIX…" className="rounded-full pl-9" />
        </div>
      </div>

      {orgLoading || agents.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nenhum agendista</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {(agents.data?.length ?? 0) > 0 ? "Ajuste a busca." : "Cadastre o primeiro agendista para iniciar."}
          </p>
          <Button variant="navy" className="mt-6 rounded-full" onClick={() => { setEditing(null); setOpen(true); }} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo agendista
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to="/app/agendistas/$id"
              params={{ id: a.id }}
              className="group rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/70 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg text-foreground">{a.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.email ?? a.phone ?? "—"}</p>
                </div>
                <Badge variant={a.status === "ativo" ? "secondary" : "outline"} className="font-normal capitalize">
                  {a.status ?? "ativo"}
                </Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
                <Field label="Telefone" value={a.phone ?? "—"} />
                <Field label="PIX" value={a.pix_key ? `${a.pix_kind ?? ""} · ${a.pix_key}` : "—"} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {organizationId && user && (
        <AgentFormDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          organizationId={organizationId}
          userId={user.id}
          initial={editing ?? undefined}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  );
}
