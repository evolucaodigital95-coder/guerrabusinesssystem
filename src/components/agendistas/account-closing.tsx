import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, Download, Eye, FileCheck2, Lock, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import {
  buildClosingTermPDF, closingFileName, DEFAULT_THANKS_MESSAGE,
  type ClosingTermData, type ClosingLectureRow,
} from "@/lib/closing-term-export";
import type { ExportMovement, AdvanceExportRow } from "@/lib/agent-statement-export";

const BUCKET = "crm-attachments";

export type ClosingSource = {
  agentId: string;
  agentName: string;
  organizationName: string;
  seasonId?: string | null;
  seasonName?: string | null;
  periodLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  responsible: string;
  totals: ClosingTermData["totals"];
  movements: ExportMovement[];
  lectures: ClosingLectureRow[];
  advances: AdvanceExportRow[];
  externalDocs?: { title: string; kind?: string | null; date?: string | null }[];
};

type ClosingRow = {
  id: string;
  closing_number: string;
  version: number;
  status: string;
  period_label: string | null;
  period_start: string | null;
  period_end: string | null;
  closed_at: string;
  final_balance: number | string;
  agent_share: number | string;
  lectures_count: number;
  companies_count: number;
  notes: string | null;
  storage_path: string | null;
  file_name: string | null;
  cancel_reason: string | null;
  supersedes_id: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  oficial: "border-emerald-500/40 text-emerald-600",
  rascunho: "border-amber-500/40 text-amber-600",
  cancelado: "border-destructive/40 text-destructive",
};

/**
 * ARQUIVO OFICIAL — fechamentos de conta do agendista.
 *
 * Congela os valores já apurados pelo motor financeiro, gera o Termo de
 * Fechamento em PDF, arquiva o documento no armazenamento da organização
 * e mantém o histórico imutável (cancelamento + reemissão versionada).
 */
export function AccountClosing({
  agentId,
  userId,
  source,
}: {
  agentId: string;
  userId: string;
  source: () => ClosingSource;
}) {
  const qc = useQueryClient();
  const { organizationId, can } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [thanks, setThanks] = useState(DEFAULT_THANKS_MESSAGE);
  const [reissueOf, setReissueOf] = useState<ClosingRow | null>(null);
  const [preview, setPreview] = useState<ClosingSource | null>(null);

  const key = ["account-closings", agentId];
  const list = useQuery({
    queryKey: key,
    enabled: !!agentId,
    queryFn: async (): Promise<ClosingRow[]> => {
      const { data, error } = await supabase
        .from("account_closings")
        .select(
          "id, closing_number, version, status, period_label, period_start, period_end, closed_at, final_balance, agent_share, lectures_count, companies_count, notes, storage_path, file_name, cancel_reason, supersedes_id",
        )
        .eq("agent_id", agentId)
        .is("archived_at", null)
        .order("closed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClosingRow[];
    },
  });

  function startClosing(reissue?: ClosingRow) {
    const snap = source();
    setPreview(snap);
    setReissueOf(reissue ?? null);
    setNotes(reissue?.notes ?? "");
    setThanks(DEFAULT_THANKS_MESSAGE);
    setOpen(true);
  }

  function saveLocally(blob: Blob, fileName: string) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      /* download opcional */
    }
  }

  async function confirmClosing() {
    if (!organizationId) return toast.error("Organização ativa não encontrada.");
    const snap = preview;
    if (!snap) return;

    setSaving(true);
    let generated: { blob: Blob; fileName: string } | null = null;
    try {
      // 1) Número oficial (sequencial por organização)
      const { data: numberData, error: numberError } = await supabase.rpc("next_closing_number", {
        _org: organizationId,
      });
      if (numberError) throw numberError;

      const closingNumber = reissueOf?.closing_number ?? (numberData as string);
      const version = reissueOf ? reissueOf.version + 1 : 1;

      const termData: ClosingTermData = {
        closingNumber,
        version,
        status: "oficial",
        agentName: snap.agentName,
        organizationName: snap.organizationName,
        seasonName: snap.seasonName,
        periodLabel: snap.periodLabel,
        closedAtLabel: new Date().toLocaleDateString("pt-BR"),
        responsible: snap.responsible,
        totals: snap.totals,
        movements: snap.movements,
        lectures: snap.lectures,
        advances: snap.advances,
        externalDocs: snap.externalDocs,
        notes: notes.trim() || null,
        thanksMessage: thanks.trim() || DEFAULT_THANKS_MESSAGE,
      };

      // 2) Gera o documento oficial — e entrega imediatamente ao usuário
      const blob = await buildClosingTermPDF(termData);
      const fileName = closingFileName(termData);
      generated = { blob, fileName };
      saveLocally(blob, fileName);
      const path = `${organizationId}/closings/${agentId}/${Date.now()}-${fileName}`;

      const up = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (up.error) throw up.error;

      // 3) Registra no Arquivo Oficial
      const t = snap.totals;
      const { error } = await supabase.from("account_closings").insert({
        organization_id: organizationId,
        agent_id: agentId,
        season_id: snap.seasonId ?? null,
        doc_kind: "fechamento",
        closing_number: closingNumber,
        version,
        supersedes_id: reissueOf?.id ?? null,
        status: "oficial",
        period_start: snap.periodStart ?? null,
        period_end: snap.periodEnd ?? null,
        period_label: snap.periodLabel,
        closed_by: userId,
        opening_balance: t.openingBalance,
        total_revenue: t.revenue,
        total_materials: t.materials,
        total_fees: t.fees,
        total_expenses: t.expenses,
        net_profit: t.netProfit,
        agent_share: t.agentShare,
        tithe: t.tithe,
        total_advances: t.advances,
        total_credits: t.credits,
        total_debits: t.debits,
        final_balance: t.finalBalance,
        lectures_count: t.lectures,
        companies_count: t.companies,
        notes: notes.trim() || null,
        thanks_message: thanks.trim() || DEFAULT_THANKS_MESSAGE,
        storage_path: path,
        file_name: fileName,
        mime_type: "application/pdf",
        size_bytes: blob.size,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;

      // 4) Cancela a versão anterior quando é reemissão
      if (reissueOf) {
        await supabase
          .from("account_closings")
          .update({
            status: "cancelado",
            cancelled_at: new Date().toISOString(),
            cancelled_by: userId,
            cancel_reason: `Substituído pela versão v${version}`,
            updated_by: userId,
          })
          .eq("id", reissueOf.id);
      }

      toast.success(`Fechamento ${closingNumber} v${version} gerado e arquivado.`);
      qc.invalidateQueries({ queryKey: key });
      setOpen(false);
      setPreview(null);
      setReissueOf(null);
    } catch (e) {
      console.error("[fechamento de conta]", e);
      const msg = e instanceof Error ? e.message : "Falha ao registrar o fechamento";
      if (generated) toast.error(`Documento gerado e baixado, mas não foi arquivado: ${msg}`);
      else toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const cancelClosing = useMutation({
    mutationFn: async (row: ClosingRow) => {
      const { error } = await supabase
        .from("account_closings")
        .update({
          status: "cancelado",
          cancelled_at: new Date().toISOString(),
          cancelled_by: userId,
          cancel_reason: "Cancelado manualmente",
          updated_by: userId,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fechamento cancelado. O documento permanece arquivado.");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sem permissão para cancelar"),
  });

  async function openDocument(row: ClosingRow, download = false) {
    if (!row.storage_path) return toast.error("Documento não disponível.");
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60, download ? { download: row.file_name ?? true } : undefined);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  const canWrite = can("finance.write");
  const canCancel = can("delete");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Arquivo oficial</p>
          <h3 className="mt-1 font-serif text-lg text-foreground">Fechamentos de conta</h3>
          <p className="text-xs text-muted-foreground">
            Cada fechamento congela os valores apurados e gera um Termo oficial em PDF, arquivado permanentemente.
          </p>
        </div>
        {canWrite && (
          <Button variant="navy" size="sm" className="rounded-full" onClick={() => startClosing()}>
            <Lock className="mr-1.5 h-4 w-4" /> Fechar conta
          </Button>
        )}
      </div>

      {list.data && list.data.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 py-3 text-left">Documento</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-center">Palestras</th>
                <th className="px-4 py-3 text-right">Participação</th>
                <th className="px-4 py-3 text-right">Saldo final</th>
                <th className="px-4 py-3 text-left">Situação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">
                          {row.closing_number} <span className="text-muted-foreground">· v{row.version}</span>
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Emitido em {formatDate(row.closed_at)}
                        </p>
                        {row.cancel_reason && (
                          <p className="mt-1 text-xs text-destructive">{row.cancel_reason}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.period_label ?? "Completo"}</td>
                  <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                    {row.lectures_count} <span className="text-[10px]">· {row.companies_count} emp.</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(Number(row.agent_share))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                    {formatCurrency(Number(row.final_balance))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_STYLE[row.status] ?? ""}>
                      {row.status === "oficial" ? "Oficial" : row.status === "cancelado" ? "Cancelado" : "Rascunho"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDocument(row)}>
                        <Eye className="mr-1.5 h-4 w-4" /> Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDocument(row, true)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {canWrite && row.status === "oficial" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reemitir com os valores atuais"
                          onClick={() => startClosing(row)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {canCancel && row.status === "oficial" && (
                        <ConfirmDialog
                          title="Cancelar este fechamento?"
                          description="O documento permanece arquivado para auditoria e passa a constar como cancelado. Nenhum valor da conta corrente é alterado."
                          confirmLabel="Cancelar fechamento"
                          destructive
                          pending={cancelClosing.isPending}
                          onConfirm={() => cancelClosing.mutate(row)}
                          trigger={
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/20 px-8 py-12 text-center">
          <Archive className="mx-auto h-6 w-6 text-muted-foreground" />
          <h4 className="mt-3 font-serif text-lg text-foreground">Nenhum fechamento arquivado</h4>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Ao fechar a conta, o GBS gera o Termo oficial de prestação de contas e o guarda permanentemente aqui.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && (setOpen(v), v || setPreview(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {reissueOf ? `Reemitir ${reissueOf.closing_number}` : "Fechar conta do agendista"}
            </DialogTitle>
            <DialogDescription>
              {reissueOf
                ? "A versão anterior será marcada como cancelada e mantida no arquivo para auditoria."
                : "Confira os valores apurados. Após confirmar, o Termo oficial será gerado e arquivado."}
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {preview.agentName} · {preview.periodLabel}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {[
                    ["Palestras / Empresas", `${preview.totals.lectures} / ${preview.totals.companies}`],
                    ["Receita bruta", formatCurrency(preview.totals.revenue)],
                    ["Materiais", `- ${formatCurrency(preview.totals.materials)}`],
                    ["Juros e taxas", `- ${formatCurrency(preview.totals.fees)}`],
                    ["Resultado líquido", formatCurrency(preview.totals.netProfit)],
                    ["Participação do agendista", formatCurrency(preview.totals.agentShare)],
                    ["Dízimo (informativo)", formatCurrency(preview.totals.tithe)],
                    ["Saldo final da conta", formatCurrency(preview.totals.finalBalance)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 text-sm">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="tabular-nums font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px] uppercase">Período (referência)</Label>
                  <Input value={preview.periodLabel} readOnly className="bg-muted/40" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Responsável</Label>
                  <Input value={preview.responsible} readOnly className="bg-muted/40" />
                </div>
              </div>

              <div>
                <Label className="text-[10px] uppercase">Observações do fechamento</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Mensagem de agradecimento</Label>
                <Textarea rows={4} value={thanks} onChange={(e) => setThanks(e.target.value)} />
              </div>

              <p className="flex items-start gap-2 rounded-lg border border-border bg-card/40 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                O fechamento é apenas documental: registra e arquiva a prestação de contas. Nenhum lançamento é criado
                e o saldo da conta corrente permanece inalterado.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="navy" disabled={saving} onClick={confirmClosing}>
              {saving ? "Gerando documento…" : "Confirmar e arquivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
