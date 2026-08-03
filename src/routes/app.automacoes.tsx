import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, CheckCircle2, PlayCircle, RefreshCw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAutomation } from "@/hooks/use-automation";
import {
  clearAutomationLog, readAutomationLog, type AutomationLogEntry,
} from "@/lib/automation/engine";
import { AUTOMATION_EVENT_LIST } from "@/lib/automation/events";
import { AUTOMATION_RULES } from "@/lib/automation/rules";

export const Route = createFileRoute("/app/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — GBS" },
      { name: "description", content: "Motor de automações do GBS: eventos, regras e log auditável." },
      { property: "og:title", content: "Automações — GBS" },
      { property: "og:description", content: "Eventos, regras automáticas e trilha de auditoria do Guerra Business System." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomacoesPage,
});

function fmt(at: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(at));
}

function AutomacoesPage() {
  const { emit, ready } = useAutomation();
  const [log, setLog] = useState<AutomationLogEntry[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const load = () => setLog(readAutomationLog());
    load();
    window.addEventListener("gbs:automation-log", load);
    return () => window.removeEventListener("gbs:automation-log", load);
  }, []);

  const filtered = useMemo(
    () => (filter === "todos" ? log : log.filter((l) => l.event === filter)),
    [log, filter],
  );

  const stats = useMemo(() => ({
    total: log.length,
    ok: log.filter((l) => l.status === "ok").length,
    errors: log.filter((l) => l.status === "error").length,
    rules: AUTOMATION_RULES.length,
  }), [log]);

  async function runTests() {
    if (!ready) { toast.error("Organização não carregada."); return; }
    setRunning(true);
    try {
      for (const e of AUTOMATION_EVENT_LIST) {
        await emit(e.key, { summary: `Teste de automação — ${e.label}` }, { dryRun: true });
      }
      toast.success(`${AUTOMATION_EVENT_LIST.length} eventos testados em modo simulação.`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader
        eyebrow="Sistema"
        title="Motor de Automações"
        description="Cada evento do GBS dispara automaticamente as atualizações relacionadas. Tudo fica registrado com data, hora, usuário, evento e resultado."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={runTests} disabled={running}>
              <PlayCircle className="mr-2 h-4 w-4" />
              {running ? "Testando…" : "Executar testes"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { clearAutomationLog(); toast.success("Log limpo"); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Limpar log
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Regras ativas", value: stats.rules, icon: Bot },
          { label: "Execuções registradas", value: stats.total, icon: RefreshCw },
          { label: "Concluídas", value: stats.ok, icon: CheckCircle2 },
          { label: "Falhas", value: stats.errors, icon: XCircle },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <s.icon className="mb-3 h-4 w-4 text-muted-foreground" />
            <p className="font-serif text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Regras registradas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {AUTOMATION_RULES.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium">{r.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
              <p className="mt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                {r.events.length} evento(s) monitorado(s)
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Log de automações</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os eventos</SelectItem>
              {AUTOMATION_EVENT_LIST.map((e) => (
                <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Nenhuma automação registrada ainda. Cadastre uma empresa, palestra ou lançamento — ou execute os testes.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Automação</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3 text-right">ms</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmt(l.at)}</td>
                    <td className="px-4 py-3">
                      {l.eventLabel}
                      {l.dryRun && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px]">simulação</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.ruleLabel}</td>
                    <td className="px-4 py-3">
                      <span className={
                        l.status === "error" ? "text-destructive"
                          : l.status === "skipped" ? "text-muted-foreground" : ""
                      }>
                        {l.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.userLabel ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{l.durationMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
