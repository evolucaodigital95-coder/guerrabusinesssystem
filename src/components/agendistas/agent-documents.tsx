import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Download, Eye, Trash2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";

const BUCKET = "crm-attachments";

export const AGENT_DOC_TYPES = [
  { key: "extrato", label: "Extrato" },
  { key: "comprovante", label: "Comprovante" },
  { key: "acerto", label: "Acerto" },
  { key: "relatorio", label: "Relatório" },
  { key: "recibo", label: "Recibo" },
  { key: "outro", label: "Outro" },
] as const;

function typeLabel(key: string | null) {
  return AGENT_DOC_TYPES.find((t) => t.key === key)?.label ?? "Outro";
}

function humanSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type DocRow = {
  id: string;
  title: string;
  doc_type: string;
  reference_period: string | null;
  doc_date: string | null;
  description: string | null;
  reference_amount: number | string | null;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  created_by: string | null;
};

/**
 * DOCUMENTOS EXTERNOS do agendista.
 * Camada puramente documental — NÃO gera lançamentos, não altera saldo,
 * lucro, adiantamentos, dízimos nem qualquer cálculo financeiro.
 */
export function AgentDocuments({ agentId, userId }: { agentId: string; userId: string }) {
  const queryClient = useQueryClient();
  const { organizationId, can } = useCurrentOrg();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<string>("extrato");
  const [period, setPeriod] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const key = ["agent-documents", agentId];

  const list = useQuery({
    queryKey: key,
    enabled: !!agentId,
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase
        .from("agent_documents")
        .select(
          "id, title, doc_type, reference_period, doc_date, description, reference_amount, storage_path, file_name, mime_type, size_bytes, created_at, created_by",
        )
        .eq("agent_id", agentId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const uploaderIds = Array.from(
    new Set((list.data ?? []).map((d) => d.created_by).filter(Boolean)),
  ) as string[];
  const profiles = useQuery({
    queryKey: ["agent-documents-profiles", uploaderIds.join(",")],
    enabled: uploaderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", uploaderIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const uploaderName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.data?.find((x) => x.id === id);
    return p?.full_name ?? p?.email ?? "—";
  };

  function reset() {
    setTitle("");
    setDocType("extrato");
    setPeriod("");
    setDocDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setAmount("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!organizationId) return toast.error("Organização ativa não encontrada.");
    if (!title.trim()) return toast.error("Informe o nome do documento.");
    if (!file) return toast.error("Selecione um arquivo.");
    setSaving(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const path = `${organizationId}/agent/${agentId}/documents/${Date.now()}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (up.error) throw up.error;

      const parsedAmount = amount.trim() ? Number(amount.replace(",", ".")) : null;
      const { error } = await supabase.from("agent_documents").insert({
        organization_id: organizationId,
        agent_id: agentId,
        title: title.trim(),
        doc_type: docType,
        reference_period: period.trim() || null,
        doc_date: docDate || null,
        description: description.trim() || null,
        reference_amount: Number.isFinite(parsedAmount as number) ? parsedAmount : null,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;

      toast.success("Documento adicionado (não afeta o saldo da conta corrente).");
      queryClient.invalidateQueries({ queryKey: key });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar documento");
    } finally {
      setSaving(false);
    }
  }

  const remove = useMutation({
    mutationFn: async (row: DocRow) => {
      const { error } = await supabase.from("agent_documents").delete().eq("id", row.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    },
    onSuccess: () => {
      toast.success("Documento excluído");
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sem permissão para excluir"),
  });

  async function openFile(row: DocRow, download = false) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(
        row.storage_path,
        60,
        download ? { download: row.file_name ?? true } : undefined,
      );
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  const canWrite = can("create");
  const canDelete = can("delete");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Camada documental
          </p>
          <h3 className="mt-1 font-serif text-lg text-foreground">Documentos externos</h3>
          <p className="text-xs text-muted-foreground">
            Arquivos enviados manualmente para conferência. Não geram lançamentos nem alteram o
            saldo.
          </p>
        </div>
        {canWrite && (
          <Button variant="brand" size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar documento
          </Button>
        )}
      </div>

      {list.data && list.data.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3 text-left">Documento</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Valor ref.</th>
                <th className="px-4 py-3 text-left">Enviado em</th>
                <th className="px-4 py-3 text-left">Por</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.data.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.title}</p>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          {row.file_name ?? "arquivo"} · {humanSize(row.size_bytes)}
                        </p>
                        {row.description && (
                          <p className="mt-1 max-w-md text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{typeLabel(row.doc_type)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.reference_period ?? (row.doc_date ? formatDate(row.doc_date) : "—")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {row.reference_amount != null
                      ? formatCurrency(Number(row.reference_amount))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {uploaderName(row.created_by)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openFile(row)}>
                        <Eye className="mr-1.5 h-4 w-4" /> Visualizar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openFile(row, true)}>
                        <Download className="mr-1.5 h-4 w-4" /> Baixar
                      </Button>
                      {canDelete && (
                        <ConfirmDialog
                          title="Excluir este documento?"
                          description="O arquivo será removido permanentemente. O saldo da conta corrente não é afetado."
                          confirmLabel="Excluir"
                          destructive
                          pending={remove.isPending}
                          onConfirm={() => remove.mutate(row)}
                          trigger={
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <Trash2 className="h-4 w-4" />
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
          <Paperclip className="mx-auto h-6 w-6 text-muted-foreground" />
          <h4 className="mt-3 font-serif text-lg text-foreground">Nenhum documento externo</h4>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Envie extratos, comprovantes, acertos e relatórios para conferência da conta corrente.
          </p>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && (setOpen(v), v || reset())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Adicionar documento externo</DialogTitle>
            <DialogDescription>
              Documento de conferência. Nenhum valor será lançado na conta corrente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div>
              <Label className="text-[11px] uppercase">Nome do documento</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Extrato Julho"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-[11px] uppercase">Tipo</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_DOC_TYPES.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase">Período de referência</Label>
                <Input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Jul/2026"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase">Data</Label>
                <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] uppercase">Valor de referência (opcional)</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase">Descrição / observação</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label className="text-[11px] uppercase">Arquivo</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {file.name} · {humanSize(file.size)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancelar
            </Button>
            <Button variant="brand" disabled={saving} onClick={submit}>
              {saving ? "Enviando…" : "Salvar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
