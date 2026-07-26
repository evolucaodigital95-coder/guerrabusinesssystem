import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader, EmptyState } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Search, FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "@/components/shared/list-skeleton";

export const Route = createFileRoute("/app/biblioteca")({
  head: () => ({
    meta: [
      { title: "Central de Conteúdo — GBS" },
      { name: "description", content: "Repositório organizado: slides, livros, propostas, contratos, mídia e treinamentos." },
    ],
  }),
  component: CentralConteudoPage,
});

const CATEGORIES = [
  "Todos", "Slides", "Livros", "Propostas Comerciais", "Contratos", "Autorizações",
  "Modelos de PDF", "Identidade Visual", "Logos", "Fotos", "Vídeos", "Treinamentos", "Documentos internos",
] as const;

function CentralConteudoPage() {
  const { organizationId } = useCurrentOrg();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("Todos");

  const { data, isLoading } = useQuery({
    queryKey: ["central-conteudo", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id, name, file_url, mime_type, size_bytes, entity_type, entity_id, created_at, notes")
        .eq("organization_id", organizationId!)
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
    return list.filter((a: any) => {
      if (cat !== "Todos") {
        const c = (a.notes ?? "").toLowerCase();
        if (!c.includes(cat.toLowerCase())) return false;
      }
      if (!term) return true;
      return (a.name ?? "").toLowerCase().includes(term) || (a.notes ?? "").toLowerCase().includes(term);
    });
  }, [data, q, cat]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Inteligência"
        title="Central de Conteúdo"
        description="Repositório único de slides, livros, propostas, contratos, mídia e treinamentos do Grupo Guerra."
      />

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar conteúdo" className="h-10 pl-9" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              cat === c ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message="Nenhum conteúdo encontrado. Adicione arquivos a partir de qualquer entidade (Empresas, Palestras, Projetos) e categorize nas notas."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: any) => (
            <a
              key={a.id}
              href={a.file_url}
              target="_blank"
              rel="noreferrer"
              className="hover-lift group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-medium">{a.name}</div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")} • {a.entity_type ?? "—"}
                </div>
                {a.notes && <div className="mt-1 truncate text-[11px] text-muted-foreground">{a.notes}</div>}
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Dica: use a aba <b>Anexos</b> em qualquer módulo para enviar arquivos — inclua a categoria (ex.: "Contratos") no campo de notas para aparecer aqui filtrado.
      </p>
    </div>
  );
}
