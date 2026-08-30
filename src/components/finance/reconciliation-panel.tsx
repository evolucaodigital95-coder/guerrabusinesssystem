import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Plus, Scale, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/crm";
import { cn } from "@/lib/utils";

const EPS = 0.01;

export function reconciliationStatus(gbs: number, external: number) {
  return Math.abs(gbs - external) <= EPS ? "conciliado" : "divergencia";
}

/**
 * Conciliação — ferramenta de CONFERÊNCIA.
 * Compara um valor consolidado do GBS com um valor de documento externo.
 * NUNCA altera lançamentos, saldos, lucro, dízimo ou estoque.
 */
export function ReconciliationPanel({
  entityType, entityId, organizationId, userId, suggestedAmount, suggestedTitle,
}: {
  entityType: string;
  entityId: string;
  organizationId: string;
  userId: string;
  suggestedAmount: number;
  suggestedTitle?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["reconciliations", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliations")
        .select("*")
        .eq("entity_type", entityType).eq("entity_id", entityId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reconciliations")
        .update({ archived_at: new Date().toISOString(), updated_by: userId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conciliação arquivada");
      qc.invalidateQueries({ queryKey: ["reconciliations", entityType, entityId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/70 px-5 py-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Scale className="h-3.5 w-3.5" /> Conciliação
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare o valor do GBS com extratos e comprovantes externos. Não altera nenhum lançamento.
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Conciliar valor
        </Button>
      </div>

      {list.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Carregando…</p>
      ) : (list.data ?? []).length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma conciliação registrada.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Data</th>
              <th className="px-4 py-2.5 text-left font-medium">Referência</th>
              <th className="px-4 py-2.5 text-right font-medium">GBS</th>
              <th className="px-4 py-2.5 text-right font-medium">Externo</th>
              <th className="px-4 py-2.5 text-right font-medium">Diferença</th>
              <th className="px-4 py-2.5 text-left font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((r) => {
              const diff = Number(r.difference ?? 0);
              const ok = r.status === "conciliado";
              return (
                <tr key={r.id} className="border-t border-border/70">
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(r.reference_date)}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {r.title}
                    {r.document_ref && <span className="block text-xs text-muted-foreground">{r.document_ref}</span>}
                    {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(Number(r.gbs_amount ?? 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(Number(r.external_amount ?? 0))}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular-nums", ok ? "text-muted-foreground" : "text-amber-600")}>
                    {formatCurrency(diff)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn("font-normal", ok ? "border-emerald-500/50 text-emerald-600" : "border-amber-500/50 text-amber-600")}>
                      {ok ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                      {ok ? "Conciliado" : "Divergência"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ConfirmDialog
                      title="Arquivar conciliação?"
                      description="O registro deixa de aparecer, mas permanece no histórico de auditoria."
                      confirmLabel="Arquivar"
                      pending={remove.isPending}
                      onConfirm={() => remove.mutate(r.id)}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <ReconciliationDialog
        open={open} onOpenChange={setOpen}
        entityType={entityType} entityId={entityId}
        organizationId={organizationId} userId={userId}
        suggestedAmount={suggestedAmount} suggestedTitle={suggestedTitle}
      />
    </div>
  );
}

function ReconciliationDialog({
  open, onOpenChange, entityType, entityId, organizationId, userId, suggestedAmount, suggestedTitle,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  entityType: string; entityId: string; organizationId: string; userId: string;
  suggestedAmount: number; suggestedTitle?: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(suggestedTitle ?? "Conferência de valores");
  const [gbs, setGbs] = useState(String(suggestedAmount.toFixed(2)));
  const [external, setExternal] = useState("");
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));
  const [docRef, setDocRef] = useState("");
  const [notes, setNotes] = useState("");

  const gbsNum = Number(gbs.replace(",", ".")) || 0;
  const extNum = Number(external.replace(",", ".")) || 0;
  const diff = Math.round((gbsNum - extNum) * 100) / 100;
  const ok = Math.abs(diff) <= EPS;

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reconciliations").insert({
        organization_id: organizationId,
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim() || "Conferência de valores",
        reference_date: refDate,
        gbs_amount: gbsNum,
        external_amount: extNum,
        status: reconciliationStatus(gbsNum, extNum),
        document_ref: docRef.trim() || null,
        notes: notes.trim() || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(ok ? "Conciliado" : "Divergência registrada");
      qc.invalidateQueries({ queryKey: ["reconciliations", entityType, entityId] });
      setExternal(""); setDocRef(""); setNotes("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  function submit(e: FormEvent) { e.preventDefault(); create.mutate(); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Conciliar valor</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Referência</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor no GBS</Label>
              <Input inputMode="decimal" value={gbs} onChange={(e) => setGbs(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor externo</Label>
              <Input inputMode="decimal" value={external} onChange={(e) => setExternal(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
               : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
          )}>
            <p className="font-medium">
              {ok ? "✅ CONCILIADO" : "⚠️ DIVERGÊNCIA"}
            </p>
            <p className="mt-0.5 text-xs">
              GBS {formatCurrency(gbsNum)} · Externo {formatCurrency(extNum)}
              {!ok && ` · Diferença ${formatCurrency(diff)}`}
            </p>
            <p className="mt-1 text-[11px] opacity-80">
              A conciliação é apenas conferência — nenhum valor do GBS é alterado.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data de referência</Label>
              <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Documento externo</Label>
              <Input value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="Extrato, recibo, nº…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={create.isPending || !external.trim()}>
              Registrar conciliação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
