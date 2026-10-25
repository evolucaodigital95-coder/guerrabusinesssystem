import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  FileText,
  Lightbulb,
  Mic,
  Package,
  PackageMinus,
  Receipt,
  Sparkles,
  Wallet,
  HandCoins,
} from "lucide-react";
import {
  buildAssistant,
  PRIORITY_LABEL,
  fmtDay,
  type AssistantData,
  type AssistantFilters,
  type AssistantPeriod,
  type Priority,
} from "@/lib/assistant";

const PERIODS: { key: AssistantPeriod; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "temporada", label: "Temporada" },
];

const QUICK_ACTIONS = [
  { label: "Nova Empresa", icon: Building2, to: "/app/crm" },
  { label: "Nova Palestra", icon: Mic, to: "/app/palestras" },
  { label: "Novo Lançamento", icon: Wallet, to: "/app/financeiro" },
  { label: "Entrada de Estoque", icon: Package, to: "/app/estoque" },
  { label: "Saída de Estoque", icon: PackageMinus, to: "/app/estoque" },
  { label: "Registrar Pagamento", icon: Receipt, to: "/app/financeiro" },
  { label: "Registrar Acerto", icon: HandCoins, to: "/app/estoque" },
  { label: "Gerar Relatório", icon: FileText, to: "/app/inteligencia" },
  { label: "Abrir Agenda", icon: CalendarRange, to: "/app/agenda" },
];

function priorityClasses(p: Priority) {
  if (p === "critico")
    return {
      chip: "border-destructive/50 text-destructive",
      card: "border-destructive/40 bg-destructive/5",
    };
  if (p === "alto")
    return { chip: "border-destructive/30 text-destructive", card: "border-destructive/25" };
  if (p === "medio")
    return {
      chip: "border-[color:var(--gold)]/50 text-gold-ink",
      card: "border-[color:var(--gold)]/35",
    };
  return { chip: "border-border text-muted-foreground", card: "border-border" };
}

const selectClass =
  "h-9 rounded-full border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-foreground/40";

type Option = { id: string; name: string };

export function AssistantGuerra({
  data,
  seasons,
  agents,
  campaigns,
  projects,
}: {
  data: AssistantData;
  seasons: Option[];
  agents: Option[];
  campaigns: Option[];
  projects: Option[];
}) {
  const [filters, setFilters] = useState<AssistantFilters>({
    period: "semana",
    seasonId: null,
    agentId: null,
    campaignId: null,
    projectId: null,
  });

  const result = useMemo(() => buildAssistant(data, filters), [data, filters]);
  const set = <K extends keyof AssistantFilters>(k: K, v: AssistantFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <section className="space-y-8">
      {/* cabeçalho + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <span aria-hidden className="h-px w-6" style={{ background: "var(--gold)" }} />
            Assistente GBS
          </div>
          <h2 className="mt-3 flex items-center gap-2 font-display text-2xl">
            <Sparkles className="h-5 w-5" style={{ color: "var(--gold)" }} />
            Seu resumo operacional
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => set("period", p.key)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  filters.period === p.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            className={selectClass}
            value={filters.seasonId ?? ""}
            onChange={(e) => set("seasonId", e.target.value || null)}
            aria-label="Temporada"
          >
            <option value="">Todas as temporadas</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.agentId ?? ""}
            onChange={(e) => set("agentId", e.target.value || null)}
            aria-label="Agendista"
          >
            <option value="">Todos os agendistas</option>
            {agents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.campaignId ?? ""}
            onChange={(e) => set("campaignId", e.target.value || null)}
            aria-label="Campanha"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.projectId ?? ""}
            onChange={(e) => set("projectId", e.target.value || null)}
            aria-label="Projeto"
          >
            <option value="">Todos os projetos</option>
            {projects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* resumo do dia */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {result.summary.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className={`hover-lift rounded-2xl border bg-card p-4 ${
              s.value > 0 && s.tone === "danger"
                ? "border-destructive/40"
                : s.value > 0 && s.tone === "warn"
                  ? "border-[color:var(--gold)]/40"
                  : "border-border"
            }`}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {s.label}
            </div>
            <div className="mt-3 font-display text-2xl leading-none tabular-nums">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* prioridades + alertas */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <h3 className="font-serif text-lg">Minhas prioridades</h3>
          <p className="text-xs text-muted-foreground">Ordenadas por criticidade e prazo</p>
          {result.priorities.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Nada exige sua atenção agora.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {result.priorities.map((a, i) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={a.to} className="block truncate text-sm hover:underline">
                      {a.title}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {PRIORITY_LABEL[a.priority]} · {a.source}
                      {a.date ? ` · ${fmtDay(a.date)}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="lg:col-span-3">
          {result.alerts.length === 0 ? (
            <div className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Nenhum alerta ativo com os filtros atuais.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {result.alerts.map((a) => {
                const c = priorityClasses(a.priority);
                return (
                  <div
                    key={a.id}
                    className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 ${c.card}`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${a.priority === "critico" || a.priority === "alto" ? "text-destructive" : "text-muted-foreground"}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wider ${c.chip}`}
                      >
                        {PRIORITY_LABEL[a.priority]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {a.date ? fmtDay(a.date) : a.source}
                      </span>
                      <Link
                        to={a.to}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] font-medium hover:border-foreground/40"
                      >
                        Resolver <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* insights */}
      <div>
        <h3 className="mb-3 font-serif text-lg">Insights do GBS</h3>
        {result.insights.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Ainda não há dados suficientes para gerar análises com os filtros atuais.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.insights.map((t) => (
              <div
                key={t}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--gold)" }} />
                <p className="text-sm leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ações rápidas */}
      <div>
        <h3 className="mb-3 font-serif text-lg">Ações rápidas</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="hover-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium hover:border-foreground/30"
            >
              <a.icon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
