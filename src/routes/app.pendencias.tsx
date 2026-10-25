import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency, formatDate } from "@/lib/crm";
import { openDoc } from "@/lib/doc-links";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/pendencias")({
  head: () => ({
    meta: [
      { title: "Pendências — GBS" },
      {
        name: "description",
        content:
          "Inconsistências reais detectadas no GBS: vínculos faltando, fechamentos pendentes, recebíveis em aberto e divergências de conciliação.",
      },
      { property: "og:title", content: "Central de Pendências — GBS" },
      {
        property: "og:description",
        content: "Descubra rapidamente o que precisa ser corrigido no Guerra Business System.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendenciasPage,
});

type Severity = "critica" | "alta" | "media";

type Pendencia = {
  id: string;
  group: string;
  severity: Severity;
  title: string;
  detail: string;
  date?: string | null;
  route?: string;
};

const SEV_LABEL: Record<Severity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
};

function PendenciasPage() {
  const { organizationId } = useCurrentOrg();
  const navigate = useNavigate();
  const [group, setGroup] = useState<string>("todas");

  const lectures = useQuery({
    queryKey: ["pend-lectures", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("lectures")
          .select(
            "id, title, scheduled_at, status, financial_status, gross_revenue, company_id, agent_id, speaker_id, season_id",
          )
          .eq("organization_id", organizationId!)
          .is("archived_at", null),
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const movements = useQuery({
    queryKey: ["pend-movements", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("financial_movements")
          .select(
            "id, description, direction, status, amount, expected_amount, occurs_on, lecture_id, payment_method, card_brand_id, card_fee_amount, card_fee_percent",
          )
          .eq("organization_id", organizationId!)
          .is("archived_at", null),
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const stock = useQuery({
    queryKey: ["pend-stock", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await fetchAll(() =>
        supabase
          .from("stock_movements")
          .select(
            "id, kind, direction, status, quantity, unit_cost, total_cost, occurs_on, lecture_id, reason, stock_item_id, stock_items:stock_item_id ( id, name )",
          )
          .eq("organization_id", organizationId!)
          .is("archived_at", null),
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const reconciliations = useQuery({
    queryKey: ["pend-reconciliations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliations")
        .select(
          "id, title, entity_type, entity_id, gbs_amount, external_amount, difference, status, reference_date",
        )
        .eq("organization_id", organizationId!)
        .is("archived_at", null)
        .eq("status", "divergencia");
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading =
    lectures.isLoading || movements.isLoading || stock.isLoading || reconciliations.isLoading;

  const pendencias = useMemo<Pendencia[]>(() => {
    const out: Pendencia[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const l of lectures.data ?? []) {
      const route = `/app/palestras/${l.id}`;
      const label = l.title ?? "Palestra sem título";
      if (l.status === "cancelada") continue;
      if (!l.company_id)
        out.push({
          id: `lec-comp-${l.id}`,
          group: "Palestras",
          severity: "alta",
          title: `${label} sem empresa`,
          detail: "Vincule a empresa para conectar CRM, financeiro e relatórios.",
          date: l.scheduled_at,
          route,
        });
      if (!l.agent_id)
        out.push({
          id: `lec-agent-${l.id}`,
          group: "Palestras",
          severity: "alta",
          title: `${label} sem agendista`,
          detail: "Sem agendista o fechamento e a conta corrente não podem ser gerados.",
          date: l.scheduled_at,
          route,
        });
      if (!l.speaker_id)
        out.push({
          id: `lec-speaker-${l.id}`,
          group: "Palestras",
          severity: "media",
          title: `${label} sem palestrante`,
          detail: "Informe o palestrante responsável.",
          date: l.scheduled_at,
          route,
        });
      if (!l.season_id)
        out.push({
          id: `lec-season-${l.id}`,
          group: "Palestras",
          severity: "media",
          title: `${label} sem temporada`,
          detail: "Sem temporada a palestra não entra na consolidação do ciclo.",
          date: l.scheduled_at,
          route,
        });
      const realizada = l.status === "realizada" || (l.scheduled_at && l.scheduled_at < today);
      if (realizada && l.financial_status !== "closed") {
        out.push({
          id: `lec-close-${l.id}`,
          group: "Fechamento",
          severity: "critica",
          title: `${label} não fechada`,
          detail: "Palestra já realizada sem fechamento financeiro consolidado.",
          date: l.scheduled_at,
          route,
        });
      }
    }

    for (const m of movements.data ?? []) {
      const route = `/app/financeiro/${m.id}`;
      const value = Number(m.amount ?? m.expected_amount ?? 0);
      const cancelled = (m.status ?? "").startsWith("cancel");
      if (cancelled) continue;
      if (!m.lecture_id) {
        out.push({
          id: `mov-lec-${m.id}`,
          group: "Financeiro",
          severity: "media",
          title: `Lançamento sem palestra · ${m.description ?? "—"}`,
          detail: `${formatCurrency(value)} sem vínculo com palestra.`,
          date: m.occurs_on,
          route,
        });
      }
      if (m.direction === "in" && (m.status === "previsto" || m.status === "parcial")) {
        out.push({
          id: `mov-recv-${m.id}`,
          group: "Financeiro",
          severity: "alta",
          title: `Recebível em aberto · ${m.description ?? "—"}`,
          detail: `${formatCurrency(value)} previsto e ainda não recebido.`,
          date: m.occurs_on,
          route,
        });
      }
      const isCard = m.payment_method === "credito" || m.payment_method === "debito";
      if (isCard && !Number(m.card_fee_amount ?? 0) && !Number(m.card_fee_percent ?? 0)) {
        out.push({
          id: `mov-card-${m.id}`,
          group: "Financeiro",
          severity: "alta",
          title: `Cartão sem taxa configurada · ${m.description ?? "—"}`,
          detail: "Pagamento em cartão sem percentual/valor de taxa — o lucro fica superestimado.",
          date: m.occurs_on,
          route,
        });
      }
    }

    for (const s of stock.data ?? []) {
      if (s.status === "cancelado" || s.status === "estornado") continue;
      const item = (s.stock_items as { id?: string; name?: string } | null)?.name ?? "Item";
      const route = s.stock_item_id ? `/app/estoque/${s.stock_item_id}` : "/app/estoque";
      if (s.direction === "out" && !s.lecture_id) {
        out.push({
          id: `stk-lec-${s.id}`,
          group: "Estoque",
          severity: "alta",
          title: `Saída sem palestra · ${item}`,
          detail: "Saída de material sem vínculo — o custo não entra em nenhum fechamento.",
          date: s.occurs_on,
          route,
        });
      }
      const cost = Number(s.total_cost ?? 0) || Number(s.quantity ?? 0) * Number(s.unit_cost ?? 0);
      if (!cost) {
        out.push({
          id: `stk-cost-${s.id}`,
          group: "Estoque",
          severity: "media",
          title: `Movimentação sem custo · ${item}`,
          detail: "Sem custo unitário/total a movimentação não afeta o resultado.",
          date: s.occurs_on,
          route,
        });
      }
    }

    for (const r of reconciliations.data ?? []) {
      const route =
        r.entity_type === "lecture" && r.entity_id ? `/app/palestras/${r.entity_id}` : undefined;
      out.push({
        id: `rec-${r.id}`,
        group: "Conciliação",
        severity: "critica",
        title: `Divergência · ${r.title}`,
        detail: `GBS ${formatCurrency(Number(r.gbs_amount ?? 0))} · Externo ${formatCurrency(Number(r.external_amount ?? 0))} · Diferença ${formatCurrency(Number(r.difference ?? 0))}.`,
        date: r.reference_date,
        route,
      });
    }

    const order: Record<Severity, number> = { critica: 0, alta: 1, media: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [lectures.data, movements.data, stock.data, reconciliations.data]);

  const groups = useMemo(
    () => ["todas", ...Array.from(new Set(pendencias.map((p) => p.group)))],
    [pendencias],
  );
  const visible = group === "todas" ? pendencias : pendencias.filter((p) => p.group === group);

  const counts = useMemo(
    () => ({
      critica: pendencias.filter((p) => p.severity === "critica").length,
      alta: pendencias.filter((p) => p.severity === "alta").length,
      media: pendencias.filter((p) => p.severity === "media").length,
    }),
    [pendencias],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Conferência"
        title="Pendências"
        description="Inconsistências reais detectadas nos dados do GBS. Cada item leva direto ao lugar onde pode ser corrigido."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Críticas" value={counts.critica} tone="critica" />
        <Stat label="Altas" value={counts.alta} tone="alta" />
        <Stat label="Médias" value={counts.media} tone="media" />
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <Button
            key={g}
            size="sm"
            variant={group === g ? "brand" : "outline"}
            className="capitalize"
            onClick={() => setGroup(g)}
          >
            {g}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Analisando os dados…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-14 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-serif text-xl text-foreground">Nenhuma pendência encontrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Os dados estão conectados e conferíveis.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/40 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  {p.severity === "critica" ? (
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4",
                        p.severity === "alta" ? "text-amber-600" : "text-muted-foreground",
                      )}
                    />
                  )}
                  {p.title}
                  <Badge variant="outline" className="font-normal">
                    {p.group}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      p.severity === "critica" && "border-rose-500/50 text-rose-600",
                      p.severity === "alta" && "border-amber-500/50 text-amber-600",
                    )}
                  >
                    {SEV_LABEL[p.severity]}
                  </Badge>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.detail}
                  {p.date ? ` · ${formatDate(p.date)}` : ""}
                </p>
              </div>
              {p.route && (
                <Button variant="outline" size="sm" onClick={() => openDoc(navigate, p.route)}>
                  Ver <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: Severity }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-3 font-serif text-3xl tabular-nums",
          tone === "critica" && "text-rose-600",
          tone === "alta" && "text-amber-600",
          tone === "media" && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
