import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useSession } from "@/hooks/use-session";
import { PageHeader, EmptyState } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Search, FileText, Download, Trash2, Upload, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/shared/list-skeleton";

export const Route = createFileRoute("/app/biblioteca")({
  head: () => ({
    meta: [
      { title: "Central de Conteúdo — GBS" },
      {
        name: "description",
        content:
          "Repositório organizado: slides, livros, propostas, contratos, mídia e treinamentos.",
      },
      { property: "og:title", content: "Central de Conteúdo — GBS" },
      {
        property: "og:description",
        content: "Slides, livros, propostas, contratos, mídia e treinamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralConteudoPage,
});

const BUCKET = "crm-attachments";
const ENTITY = "content";

const CATEGORIES = [
  "Slides",
  "Livros",
  "Propostas Comerciais",
  "Contratos",
  "Autorizações",
  "Modelos de PDF",
  "Identidade Visual",
  "Logos",
  "Fotos",
  "Vídeos",
  "Treinamentos",
  "Documentos internos",
] as const;

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

function categoryOf(path: string) {
  // {org}/content/{categoria}/{arquivo}
  const parts = path.split("/");
  return parts.length >= 4
    ? decodeURIComponent(parts[2]).replace(/_/g, " ")
    : "Documentos internos";
}

function CentralConteudoPage() {
  const { organizationId } = useCurrentOrg();
  const { user } = useSession();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("Todos");
  const [open, setOpen] = useState(false);
  const [uploadCat, setUploadCat] = useState<string>(CATEGORIES[0]);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["central-conteudo", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
        .eq("organization_id", organizationId!)
        .eq("entity_type", ENTITY)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((a) => {
      if (cat !== "Todos" && categoryOf(a.storage_path) !== cat) return false;
      if (!term) return true;
      return (
        (a.file_name ?? "").toLowerCase().includes(term) ||
        categoryOf(a.storage_path).toLowerCase().includes(term)
      );
    });
  }, [data, q, cat]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || !organizationId || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.-]+/g, "_");
        const folder = uploadCat.replace(/[^\w]+/g, "_");
        const path = `${organizationId}/${ENTITY}/${folder}/${Date.now()}-${safe}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw up.error;
        const ins = await supabase.from("attachments").insert({
          organization_id: organizationId,
          entity_type: ENTITY,
          entity_id: organizationId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: user.id,
          updated_by: user.id,
        });
        if (ins.error) throw ins.error;
      }
      toast.success("Conteúdo adicionado");
      qc.invalidateQueries({ queryKey: ["central-conteudo", organizationId] });
      setOpen(false);
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
      toast.success("Conteúdo removido");
      qc.invalidateQueries({ queryKey: ["central-conteudo", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  async function download(row: Row) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, 300, {
        download: row.file_name ?? true,
      });
    if (error || !data) return toast.error(error?.message ?? "Não foi possível baixar");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Inteligência"
        title="Central de Conteúdo"
        description="Repositório único de slides, livros, propostas, contratos, mídia e treinamentos da sua organização."
        actions={
          <Button variant="brand" onClick={() => setOpen(true)} disabled={!organizationId}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar conteúdo
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar conteúdo"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["Todos", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === c
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState message="Nenhum conteúdo aqui ainda. Use “Adicionar conteúdo” para enviar slides, contratos, propostas, fotos e treinamentos." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="hover-lift group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.file_name ?? "Arquivo"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {categoryOf(a.storage_path)} · {humanSize(a.size_bytes)} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => download(a)}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> Baixar
                  </Button>
                  <ConfirmDialog
                    title="Excluir este conteúdo?"
                    description="O arquivo será removido definitivamente."
                    confirmLabel="Excluir"
                    destructive
                    pending={remove.isPending}
                    onConfirm={() => remove.mutate(a)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conteúdo</DialogTitle>
            <DialogDescription>Escolha a categoria e envie um ou mais arquivos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={uploadCat} onValueChange={setUploadCat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !organizationId}
            >
              <Upload className="mr-1.5 h-4 w-4" /> {uploading ? "Enviando…" : "Escolher arquivos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
