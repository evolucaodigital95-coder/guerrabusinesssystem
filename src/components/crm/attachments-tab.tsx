import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/crm";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const BUCKET = "crm-attachments";

type Row = {
  id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

function humanSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsTab({
  entityType,
  entityId,
  organizationId,
  userId,
}: {
  entityType: string;
  entityId: string;
  organizationId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const list = useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${organizationId}/${entityType}/${entityId}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw up.error;
        const ins = await supabase.from("attachments").insert({
          organization_id: organizationId,
          entity_type: entityType,
          entity_id: entityId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: userId,
          updated_by: userId,
        });
        if (ins.error) throw ins.error;
      }
      toast.success("Arquivo enviado");
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
      const { error } = await supabase.from("attachments").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anexo removido");
      queryClient.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  async function download(row: Row) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          variant="navy"
          size="sm"
          className="rounded-full"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {uploading ? "Enviando…" : "Enviar arquivo"}
        </Button>
      </div>

      {list.data && list.data.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
          {list.data.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {row.file_name ?? row.storage_path.split("/").pop()}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {humanSize(row.size_bytes)} · {formatDate(row.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => download(row)}>
                  <Download className="mr-1.5 h-4 w-4" /> Baixar
                </Button>
                <ConfirmDialog
                  title="Excluir este anexo?"
                  description="O arquivo será removido do storage e não poderá ser recuperado."
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
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/20 px-8 py-14 text-center">
          <Paperclip className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-3 font-serif text-xl text-foreground">Nenhum anexo</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Envie PDFs, imagens, comprovantes, contratos e documentos.
          </p>
        </div>
      )}
    </div>
  );
}
