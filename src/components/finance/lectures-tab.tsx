import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, Archive, Search, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { formatCurrency, formatDate } from "@/lib/crm";
import { lectureStatusLabel } from "@/lib/lectures";
import { LectureFormDialog, type LectureRow } from "@/components/palestras/lecture-form-dialog";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  theme: string | null;
  status: string | null;
  scheduled_at: string | null;
  scheduled_time: string | null;
  city: string | null;
  state: string | null;
  company_id: string | null;
  agent_id: string | null;
  season_id: string | null;
  campaign_id: string | null;
  project_id: string | null;
  contact_id: string | null;
  expected_audience: number | null;
  actual_audience: number | null;
  gross_revenue: number | null;
  notes: string | null;
  companies: { id: string; legal_name: string } | null;
};

export function FinanceLecturesTab({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyDup, setOnlyDup] = useState(false);
  const [editing, setEditing] = useState<LectureRow | null>(null);
  const [open, setOpen] = useState(false);

  const lectures = useQuery({
    queryKey: ["finance-lectures", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("lectures")
        .select(
          `
          id, title, theme, status, scheduled_at, scheduled_time, city, state,
          company_id, agent_id, season_id, campaign_id, project_id, contact_id,
          expected_audience, actual_audience, gross_revenue, notes,
          companies:company_id ( id, legal_name )
        `,
        )
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const dupKeys = useMemo(() => {
    const count = new Map<string, number>();
    for (const l of lectures.data ?? []) {
      const k = `${(l.title ?? "").trim().toLowerCase()}|${l.scheduled_at ?? ""}|${l.company_id ?? ""}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return new Set(
      Array.from(count.entries())
        .filter(([, n]) => n > 1)
        .map(([k]) => k),
    );
  }, [lectures.data]);

  const keyOf = (l: Row) =>
    `${(l.title ?? "").trim().toLowerCase()}|${l.scheduled_at ?? ""}|${l.company_id ?? ""}`;

  const filtered = useMemo(() => {
    let list = lectures.data ?? [];
    if (onlyDup) list = list.filter((l) => dupKeys.has(keyOf(l)));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        [l.title, l.theme, l.city, l.companies?.legal_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [lectures.data, search, onlyDup, dupKeys]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance-lectures", organizationId] });
    qc.invalidateQueries({ queryKey: ["lectures"] });
    qc.invalidateQueries({ queryKey: ["movements"] });
  };

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lectures")
        .update({ archived_at: new Date().toISOString(), updated_by: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Palestra arquivada");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao arquivar"),
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("lecture_financial_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("lecture_id", id);
      if ((count ?? 0) > 0) {
        throw new Error("Esta palestra já tem fechamento financeiro. Arquive em vez de excluir.");
      }
      // Desvincula registros dependentes para não perder histórico do razão
      await supabase.from("financial_movements").update({ lecture_id: null }).eq("lecture_id", id);
      await supabase.from("advances").update({ lecture_id: null }).eq("lecture_id", id);
      await supabase.from("stock_movements").update({ lecture_id: null }).eq("lecture_id", id);
      const { error } = await supabase.from("lectures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Palestra excluída definitivamente");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir"),
  });

  const dupCount = (lectures.data ?? []).filter((l) => dupKeys.has(keyOf(l))).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar palestra, empresa, cidade…"
              className="rounded-full pl-9"
            />
          </div>
          <Button variant={onlyDup ? "brand" : "outline"} onClick={() => setOnlyDup((v) => !v)}>
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Duplicadas {dupCount > 0 ? `(${dupCount})` : ""}
          </Button>
        </div>
      </div>

      {lectures.isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
          <h3 className="font-serif text-2xl text-foreground">Nenhuma palestra</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste a busca ou cadastre palestras no módulo Palestras.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Palestra</th>
                <th className="px-4 py-3 text-left font-medium">Empresa</th>
                <th className="px-4 py-3 text-right font-medium">Bruto</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const dup = dupKeys.has(keyOf(l));
                return (
                  <tr
                    key={l.id}
                    className={cn("border-t border-border/70", dup && "bg-amber-500/5")}
                  >
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {formatDate(l.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{l.title}</span>
                        {dup && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-[10px] font-normal text-amber-600"
                          >
                            duplicada
                          </Badge>
                        )}
                        <Link
                          to="/app/palestras/$id"
                          params={{ id: l.id }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                      {l.theme && <p className="mt-0.5 text-xs text-muted-foreground">{l.theme}</p>}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {l.companies?.legal_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-right tabular-nums">
                      {formatCurrency(Number(l.gross_revenue ?? 0))}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant="outline" className="font-normal">
                        {lectureStatusLabel(l.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing({
                              id: l.id,
                              title: l.title,
                              theme: l.theme,
                              company_id: l.company_id,
                              contact_id: l.contact_id,
                              agent_id: l.agent_id,
                              season_id: l.season_id,
                              campaign_id: l.campaign_id,
                              project_id: l.project_id,
                              city: l.city,
                              state: l.state,
                              scheduled_at: l.scheduled_at,
                              scheduled_time: l.scheduled_time,
                              expected_audience: l.expected_audience,
                              actual_audience: l.actual_audience,
                              status: l.status,
                              gross_revenue: l.gross_revenue,
                              notes: l.notes,
                            });
                            setOpen(true);
                          }}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                        <ConfirmDialog
                          title="Arquivar esta palestra?"
                          description="Ela some das listas, mas o histórico financeiro e a auditoria são preservados."
                          confirmLabel="Arquivar"
                          pending={archive.isPending}
                          onConfirm={() => archive.mutate(l.id)}
                          trigger={
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                        <ConfirmDialog
                          title="Excluir definitivamente?"
                          description="A palestra será apagada. Lançamentos do razão ligados a ela ficam sem vínculo. Não é possível excluir palestras já fechadas financeiramente."
                          confirmLabel="Excluir"
                          destructive
                          pending={hardDelete.isPending}
                          onConfirm={() => hardDelete.mutate(l.id)}
                          trigger={
                            <Button variant="ghost" size="sm" className="text-rose-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LectureFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        organizationId={organizationId}
        userId={userId}
        initial={editing ?? undefined}
      />
    </div>
  );
}
