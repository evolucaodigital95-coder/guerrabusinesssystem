import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgMembers } from "@/hooks/use-org-members";
import { BRL } from "@/lib/format";

/**
 * Histórico de alterações lido do `audit_log` (preenchido por gatilho no banco).
 * Mostra quem criou/alterou/excluiu, quando e o que mudou, campo a campo.
 */

const FIELD_LABEL: Record<string, string> = {
  amount: "Valor realizado",
  expected_amount: "Valor previsto",
  expected_date: "Data prevista",
  settled_at: "Data de liquidação",
  occurs_on: "Data",
  occurs_time: "Hora",
  status: "Status",
  direction: "Tipo",
  category: "Categoria",
  description: "Descrição",
  account_id: "Conta",
  company_id: "Empresa",
  lecture_id: "Palestra",
  agent_id: "Agendista",
  season_id: "Temporada",
  project_id: "Projeto",
  payment_method: "Forma de pagamento",
  card_brand_id: "Bandeira",
  card_installments: "Parcelas",
  card_fee_percent: "Taxa do cartão (%)",
  card_fee_amount: "Taxa do cartão",
  net_amount: "Valor líquido",
  notes: "Observações",
  archived_at: "Arquivado",
  quantity: "Quantidade",
  unit_cost: "Custo unitário",
  total_cost: "Custo total",
  kind: "Movimento",
  reason: "Motivo",
  stock_item_id: "Item",
  name: "Nome",
  min_quantity: "Estoque mínimo",
  purchase_price: "Preço de compra",
  sale_price: "Preço de venda",
};

const MONEY_FIELDS = new Set([
  "amount",
  "expected_amount",
  "card_fee_amount",
  "net_amount",
  "unit_cost",
  "total_cost",
  "purchase_price",
  "sale_price",
]);

const ACTION_LABEL: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "excluiu",
};

type AuditRow = {
  id: string;
  entity_type: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  diff: { changes?: Record<string, { old: unknown; new: unknown }> } | null;
};

function formatValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (MONEY_FIELDS.has(field) && !Number.isNaN(Number(v))) return BRL.format(Number(v));
  if (field === "archived_at") return "sim";
  if (field === "direction") return v === "in" ? "Entrada" : v === "out" ? "Saída" : String(v);
  if (field.endsWith("_id")) return "outro registro";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v))
    return new Date(v.length === 10 ? `${v}T12:00:00` : v).toLocaleDateString("pt-BR");
  return String(v);
}

export function AuditHistory({
  organizationId,
  entityIds,
  emptyHint = "Nenhuma alteração registrada ainda.",
}: {
  organizationId: string;
  /** Registros cujo histórico deve aparecer (ex.: o item e suas movimentações). */
  entityIds: string[];
  emptyHint?: string;
}) {
  const members = useOrgMembers(organizationId);
  const ids = entityIds.filter(Boolean);

  const log = useQuery({
    queryKey: ["audit-history", organizationId, ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, entity_type, action, actor_id, created_at, diff")
        .eq("organization_id", organizationId)
        .in("entity_id", ids.slice(0, 200))
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const who = (actorId: string | null) => {
    if (!actorId) return "Sistema";
    const m = members.data?.find((x) => x.user_id === actorId);
    return m?.full_name || m?.email || "Usuário removido";
  };

  if (log.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  const rows = log.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        <History className="h-4 w-4" /> {emptyHint}
      </div>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {rows.map((r) => {
        const changes = Object.entries(r.diff?.changes ?? {}).filter(
          ([k]) => k !== "updated_by" && k !== "updated_at" && k !== "occurs_at",
        );
        const subject =
          r.entity_type === "stock_movements"
            ? "uma movimentação"
            : r.entity_type === "stock_items"
              ? "o item"
              : "o lançamento";
        return (
          <li key={r.id} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-clay" />
            <p className="text-sm text-foreground">
              <span className="font-medium">{who(r.actor_id)}</span>{" "}
              {ACTION_LABEL[r.action] ?? r.action} {subject}
            </p>
            {changes.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {changes.slice(0, 8).map(([field, c]) => (
                  <li key={field}>
                    {FIELD_LABEL[field] ?? field}:{" "}
                    <span className="line-through opacity-70">{formatValue(field, c.old)}</span> →{" "}
                    <span className="text-foreground">{formatValue(field, c.new)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {new Date(r.created_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
