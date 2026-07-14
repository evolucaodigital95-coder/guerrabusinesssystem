import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/crm";
import { exportCSV, exportXLSX, exportPDF, type ReportColumn } from "@/lib/report-export";
import { ListSkeleton } from "@/components/shared/list-skeleton";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — GBS" },
      { name: "description", content: "Central de exportação: relatórios tabulares filtráveis em CSV, XLSX e PDF Premium." },
    ],
  }),
  component: RelatoriosPage,
});

type Kind = "financeiro" | "palestras" | "empresas" | "agendistas" | "estoque";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

function RelatoriosPage() {
  const { organizationId } = useCurrentOrg();
  const [tab, setTab] = useState<Kind>("financeiro");
  const [start, setStart] = useState(daysAgoISO(90));
  const [end, setEnd] = useState(todayISO());
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Central de Exportação"
        description="Dados reais, filtros por período e formatos CSV, Excel e PDF Premium."
      />

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-[10px] uppercase">De</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase">Até</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase">Buscar</Label>
            <Input placeholder="Filtrar por texto (descrição, nome, empresa...)" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)} className="space-y-4">
        <TabsList className="bg-card/40">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="palestras">Palestras</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="agendistas">Agendistas</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro"><FinanceReport orgId={organizationId} start={start} end={end} search={search} /></TabsContent>
        <TabsContent value="palestras"><LecturesReport orgId={organizationId} start={start} end={end} search={search} /></TabsContent>
        <TabsContent value="empresas"><CompaniesReport orgId={organizationId} search={search} /></TabsContent>
        <TabsContent value="agendistas"><AgentsReport orgId={organizationId} search={search} /></TabsContent>
        <TabsContent value="estoque"><StockReport orgId={organizationId} search={search} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ExportBar<T>({ name, rows, cols, subtitle }: {
  name: string; rows: T[]; cols: ReportColumn<T>[]; subtitle?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{rows.length}</span> registros
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="navy" size="sm" className="rounded-full" disabled={rows.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportPDF(name, cols, rows, subtitle)}>PDF Premium</DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportXLSX(name, cols, rows)}>Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportCSV(name, cols, rows)}>CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ReportTable<T extends { id?: string | number }>({ cols, rows }: {
  cols: ReportColumn<T>[]; rows: T[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/20 p-10 text-center text-sm text-muted-foreground">
        Nenhum registro para os filtros selecionados.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
            <tr>
              {cols.map((c) => (
                <th key={String(c.key)} className={`px-4 py-2.5 font-medium text-${c.align ?? "left"}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={(r.id as string) ?? i} className="border-t border-border/60 hover:bg-muted/20">
                {cols.map((c) => (
                  <td key={String(c.key)} className={`px-4 py-2.5 tabular-nums text-${c.align ?? "left"}`}>
                    {c.format ? c.format(r) : String((r as Record<string, unknown>)[c.key as string] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Financeiro
// ============================================================
function FinanceReport({ orgId, start, end, search }: { orgId: string | null; start: string; end: string; search: string }) {
  const q = useQuery({
    queryKey: ["report-financeiro", orgId, start, end],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_movements")
        .select("id, occurs_on, direction, description, category, payment_method, amount, expected_amount, net_amount, status, account_id, company_id, lecture_id")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .gte("occurs_on", start)
        .lte("occurs_on", end)
        .order("occurs_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    return term ? list.filter((r) => (r.description ?? "").toLowerCase().includes(term) || (r.category ?? "").toLowerCase().includes(term)) : list;
  }, [q.data, search]);

  const totals = useMemo(() => {
    let inn = 0, out = 0;
    for (const r of rows) {
      const v = Number(r.amount ?? r.expected_amount ?? 0);
      if (r.direction === "in") inn += v; else out += v;
    }
    return { inn, out, net: inn - out };
  }, [rows]);

  const cols: ReportColumn<(typeof rows)[number]>[] = [
    { key: "occurs_on", label: "Data", format: (r) => formatDate(r.occurs_on) },
    { key: "direction", label: "Tipo", format: (r) => r.direction === "in" ? "Entrada" : "Saída" },
    { key: "description", label: "Descrição", format: (r) => r.description ?? "—" },
    { key: "category", label: "Categoria", format: (r) => r.category ?? "—" },
    { key: "payment_method", label: "Forma", format: (r) => r.payment_method ?? "—" },
    { key: "status", label: "Status", format: (r) => r.status ?? "—" },
    { key: "amount", label: "Valor", align: "right", format: (r) => formatCurrency(Number(r.amount ?? r.expected_amount ?? 0)) },
  ];

  if (q.isLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Entradas" value={formatCurrency(totals.inn)} accent="emerald" />
        <SummaryCard label="Saídas" value={formatCurrency(totals.out)} accent="rose" />
        <SummaryCard label="Resultado" value={formatCurrency(totals.net)} accent={totals.net >= 0 ? "gold" : "rose"} />
      </div>
      <ExportBar
        name="Relatorio Financeiro"
        rows={rows}
        cols={cols}
        subtitle={`Período: ${formatDate(start)} a ${formatDate(end)} · Entradas ${formatCurrency(totals.inn)} · Saídas ${formatCurrency(totals.out)} · Resultado ${formatCurrency(totals.net)}`}
      />
      <ReportTable cols={cols} rows={rows} />
    </div>
  );
}

// ============================================================
// Palestras
// ============================================================
function LecturesReport({ orgId, start, end, search }: { orgId: string | null; start: string; end: string; search: string }) {
  const q = useQuery({
    queryKey: ["report-palestras", orgId, start, end],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lectures")
        .select("id, title, scheduled_at, status, city, state, expected_audience, gross_revenue, companies:company_id ( legal_name, trade_name ), agents:agent_id ( full_name )")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end + "T23:59:59")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id: string; title: string | null; scheduled_at: string | null; status: string | null;
        city: string | null; state: string | null; expected_audience: number | null; gross_revenue: number | null;
        companies: { legal_name: string | null; trade_name: string | null } | null;
        agents: { full_name: string | null } | null;
      }>;
    },
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((r) =>
      (r.title ?? "").toLowerCase().includes(term) ||
      (r.companies?.legal_name ?? r.companies?.trade_name ?? "").toLowerCase().includes(term) ||
      (r.agents?.full_name ?? "").toLowerCase().includes(term)
    );
  }, [q.data, search]);

  const cols: ReportColumn<(typeof rows)[number]>[] = [
    { key: "scheduled_at", label: "Data", format: (r) => formatDate(r.scheduled_at) },
    { key: "title", label: "Palestra", format: (r) => r.title ?? "—" },
    { key: "company", label: "Empresa", format: (r) => r.companies?.trade_name ?? r.companies?.legal_name ?? "—" },
    { key: "agent", label: "Agendista", format: (r) => r.agents?.full_name ?? "—" },
    { key: "city", label: "Cidade", format: (r) => [r.city, r.state].filter(Boolean).join(" / ") || "—" },
    { key: "expected_audience", label: "Público", align: "right", format: (r) => String(r.expected_audience ?? 0) },
    { key: "status", label: "Status", format: (r) => r.status ?? "—" },
    { key: "gross_revenue", label: "Valor", align: "right", format: (r) => formatCurrency(Number(r.gross_revenue ?? 0)) },
  ];

  if (q.isLoading) return <ListSkeleton rows={8} />;

  const totalGross = rows.reduce((a, r) => a + Number(r.gross_revenue ?? 0), 0);
  const totalPublic = rows.reduce((a, r) => a + Number(r.expected_audience ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Palestras" value={String(rows.length)} accent="navy" />
        <SummaryCard label="Vidas impactadas" value={totalPublic.toLocaleString("pt-BR")} accent="gold" />
        <SummaryCard label="Valor bruto" value={formatCurrency(totalGross)} accent="emerald" />
      </div>
      <ExportBar
        name="Relatorio de Palestras"
        rows={rows}
        cols={cols}
        subtitle={`Período: ${formatDate(start)} a ${formatDate(end)} · ${rows.length} palestras · ${totalPublic.toLocaleString("pt-BR")} vidas · ${formatCurrency(totalGross)} bruto`}
      />
      <ReportTable cols={cols} rows={rows} />
    </div>
  );
}

// ============================================================
// Empresas
// ============================================================
function CompaniesReport({ orgId, search }: { orgId: string | null; search: string }) {
  const q = useQuery({
    queryKey: ["report-empresas", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, legal_name, trade_name, city, state, segment, lifecycle_stage, status, created_at")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    return term ? list.filter((r) =>
      (r.legal_name ?? "").toLowerCase().includes(term) ||
      (r.trade_name ?? "").toLowerCase().includes(term) ||
      (r.segment ?? "").toLowerCase().includes(term)
    ) : list;
  }, [q.data, search]);

  const cols: ReportColumn<(typeof rows)[number]>[] = [
    { key: "legal_name", label: "Razão social", format: (r) => r.legal_name ?? "—" },
    { key: "trade_name", label: "Nome fantasia", format: (r) => r.trade_name ?? "—" },
    { key: "segment", label: "Segmento", format: (r) => r.segment ?? "—" },
    { key: "lifecycle_stage", label: "Estágio", format: (r) => r.lifecycle_stage ?? "—" },
    { key: "status", label: "Status", format: (r) => r.status ?? "—" },
    { key: "city", label: "Cidade", format: (r) => [r.city, r.state].filter(Boolean).join(" / ") || "—" },
    { key: "created_at", label: "Cadastro", format: (r) => formatDate(r.created_at) },
  ];

  if (q.isLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <ExportBar name="Relatorio de Empresas" rows={rows} cols={cols} subtitle={`${rows.length} empresas`} />
      <ReportTable cols={cols} rows={rows} />
    </div>
  );
}

// ============================================================
// Agendistas
// ============================================================
function AgentsReport({ orgId, search }: { orgId: string | null; search: string }) {
  const q = useQuery({
    queryKey: ["report-agendistas", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, full_name, cpf, phone, email, status, pix_kind, pix_key, created_at")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    return term ? list.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(term) ||
      (r.email ?? "").toLowerCase().includes(term)
    ) : list;
  }, [q.data, search]);

  const cols: ReportColumn<(typeof rows)[number]>[] = [
    { key: "full_name", label: "Nome", format: (r) => r.full_name ?? "—" },
    { key: "cpf", label: "CPF", format: (r) => r.cpf ?? "—" },
    { key: "phone", label: "Telefone", format: (r) => r.phone ?? "—" },
    { key: "email", label: "E-mail", format: (r) => r.email ?? "—" },
    { key: "status", label: "Status", format: (r) => r.status ?? "ativo" },
    { key: "pix", label: "PIX", format: (r) => r.pix_key ? `${r.pix_kind ?? ""} · ${r.pix_key}` : "—" },
    { key: "created_at", label: "Cadastro", format: (r) => formatDate(r.created_at) },
  ];

  if (q.isLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <ExportBar name="Relatorio de Agendistas" rows={rows} cols={cols} subtitle={`${rows.length} agendistas`} />
      <ReportTable cols={cols} rows={rows} />
    </div>
  );
}

// ============================================================
// Estoque
// ============================================================
function StockReport({ orgId, search }: { orgId: string | null; search: string }) {
  const q = useQuery({
    queryKey: ["report-estoque", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, sku, unit, category, purchase_price, average_cost, min_quantity, supplier, updated_at")
        .eq("organization_id", orgId!)
        .is("archived_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    return term ? list.filter((r) =>
      (r.name ?? "").toLowerCase().includes(term) ||
      (r.sku ?? "").toLowerCase().includes(term)
    ) : list;
  }, [q.data, search]);

  const cols: ReportColumn<(typeof rows)[number]>[] = [
    { key: "sku", label: "SKU", format: (r) => r.sku ?? "—" },
    { key: "name", label: "Item", format: (r) => r.name ?? "—" },
    { key: "unit", label: "Un.", format: (r) => r.unit ?? "un" },
    { key: "category", label: "Categoria", format: (r) => r.category ?? "—" },
    { key: "min_quantity", label: "Mín.", align: "right", format: (r) => String(r.min_quantity ?? 0) },
    { key: "average_cost", label: "Custo médio", align: "right", format: (r) => formatCurrency(Number(r.average_cost ?? 0)) },
    { key: "purchase_price", label: "Compra", align: "right", format: (r) => formatCurrency(Number(r.purchase_price ?? 0)) },
    { key: "supplier", label: "Fornecedor", format: (r) => r.supplier ?? "—" },
  ];

  if (q.isLoading) return <ListSkeleton rows={8} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-1">
        <SummaryCard label="Itens cadastrados" value={String(rows.length)} accent="navy" />
      </div>
      <ExportBar
        name="Relatorio de Estoque"
        rows={rows}
        cols={cols}
        subtitle={`${rows.length} itens cadastrados`}
      />
      <ReportTable cols={cols} rows={rows} />
    </div>
  );
}

function SummaryCard({ label, value, accent }: {
  label: string; value: string;
  accent: "navy" | "gold" | "emerald" | "rose";
}) {
  const color = {
    navy: "text-foreground",
    gold: "text-[var(--gold)]",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-serif text-2xl tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
