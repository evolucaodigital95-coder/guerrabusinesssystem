import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Star, Plus, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-shell";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { CompanyFormDialog } from "@/components/crm/company-form-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { LIFECYCLE_STAGES, formatDate } from "@/lib/crm";
import { cn } from "@/lib/utils";

import { useQuickAction } from "@/lib/quick-actions";
export const Route = createFileRoute("/app/crm/")({
  head: () => ({
    meta: [
      { title: "CRM — GBS" },
      { name: "description", content: "Empresas, contatos, leads e oportunidades." },
    ],
  }),
  component: CrmPage,
});

type Company = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  document: string | null;
  segment: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  is_favorite: boolean;
  created_at: string;
};

function CrmPage() {
  const { user } = useSession();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [open, setOpen] = useState(false);
  useQuickAction("empresa", () => setOpen(true));
  const queryClient = useQueryClient();

  const companies = useQuery({
    queryKey: ["companies", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "id, legal_name, trade_name, document, segment, city, state, status, lifecycle_stage, is_favorite, created_at",
        )
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (c: Company) => {
      const { error } = await supabase
        .from("companies")
        .update({ is_favorite: !c.is_favorite })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const filtered = useMemo(() => {
    let list = companies.data ?? [];
    if (filter === "favorites") list = list.filter((c) => c.is_favorite);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.legal_name, c.trade_name, c.document, c.segment, c.city, c.state]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [companies.data, search, filter]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CRM"
        title="Empresas"
        description="Cadastro central de empresas, contatos, leads e oportunidades."
        actions={
          <Button variant="brand" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova empresa
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ, segmento, cidade…"
            className="rounded-full pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/40 p-1">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition-colors",
              filter === "all"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition-colors",
              filter === "favorites"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Favoritas
          </button>
        </div>
      </div>

      {orgLoading || companies.isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-2xl text-foreground">
            {search ? "Nada encontrado" : "Você ainda não cadastrou empresas"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? "Ajuste sua busca ou cadastre uma nova empresa."
              : "Comece criando a primeira empresa do seu CRM."}
          </p>
          <Button
            variant="brand"
            className="mt-6"
            onClick={() => setOpen(true)}
            disabled={!organizationId}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova empresa
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium"></th>
                <th className="px-5 py-3 text-left font-medium">Empresa</th>
                <th className="px-5 py-3 text-left font-medium">Segmento</th>
                <th className="px-5 py-3 text-left font-medium">Local</th>
                <th className="px-5 py-3 text-left font-medium">Etapa</th>
                <th className="px-5 py-3 text-left font-medium">Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stage = LIFECYCLE_STAGES.find((s) => s.key === c.lifecycle_stage);
                return (
                  <tr
                    key={c.id}
                    className="group border-t border-border/70 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <button
                        onClick={() => toggleFavorite.mutate(c)}
                        aria-label={c.is_favorite ? "Remover favorito" : "Favoritar"}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            c.is_favorite && "fill-[var(--gold)] text-gold-ink",
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <Link to="/app/crm/$id" params={{ id: c.id }} className="block">
                        <div className="font-medium text-foreground">{c.legal_name}</div>
                        {c.trade_name && (
                          <div className="text-xs text-muted-foreground">{c.trade_name}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{c.segment ?? "—"}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {c.city || c.state ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          {[c.city, c.state].filter(Boolean).join(" / ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className="font-normal">
                        {stage?.label ?? c.lifecycle_stage ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {organizationId && user && (
        <CompanyFormDialog
          open={open}
          onOpenChange={setOpen}
          organizationId={organizationId}
          userId={user.id}
        />
      )}
    </div>
  );
}
