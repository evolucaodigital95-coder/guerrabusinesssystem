import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { eventLabel, type AutomationEvent, type AutomationPayload } from "./events";
import { rulesForEvent } from "./rules";

/**
 * GBS Event Engine — motor central de automações (Fase 2.1).
 *
 * Regra de ouro: o motor NÃO calcula nada e NÃO altera regra financeira.
 * Ele apenas reage a eventos, enfileira as etapas relacionadas, propaga
 * atualizações e registra log auditável por etapa.
 */
export type AutomationContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  queryClient: QueryClient;
  organizationId: string;
  userId: string | null;
  userLabel: string | null;
  dryRun?: boolean;
};

export type AutomationLogEntry = {
  id: string;
  at: string;
  event: AutomationEvent;
  eventLabel: string;
  ruleId: string;
  ruleLabel: string;
  status: "ok" | "skipped" | "error";
  result: string;
  /** Mensagem crua do erro, quando houver. */
  errorMessage?: string | null;
  userId: string | null;
  userLabel: string | null;
  durationMs: number;
  dryRun: boolean;
  entityType?: string | null;
  entityId?: string | null;
  /** Posição da etapa dentro da fila do evento. */
  step?: number;
  stepCount?: number;
  /** Identificador da execução (todas as etapas de um mesmo evento). */
  runId?: string;
};

const LOG_KEY = "gbs.automation.log";
const LOG_LIMIT = 400;
export const AUTOMATION_LOG_EVENT = "gbs:automation-log";

export function readAutomationLog(): AutomationLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as AutomationLogEntry[]) : [];
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTOMATION_LOG_EVENT));
}

function appendLog(entries: AutomationLogEntry[]) {
  if (typeof window === "undefined" || entries.length === 0) return;
  const next = [...entries, ...readAutomationLog()].slice(0, LOG_LIMIT);
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* storage cheio — o log é auxiliar, nunca bloqueia a operação */
  }
  notify();
}

export function clearAutomationLog() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOG_KEY);
  notify();
}

/* ------------------------------------------------------------------ */
/* Fila de execução                                                    */
/* ------------------------------------------------------------------ */

export type QueueItem = {
  runId: string;
  event: AutomationEvent;
  eventLabel: string;
  enqueuedAt: string;
  steps: number;
  status: "pending" | "running";
};

const queue: QueueItem[] = [];
let chain: Promise<unknown> = Promise.resolve();

export function readAutomationQueue(): QueueItem[] {
  return queue.map((q) => ({ ...q }));
}

function setQueueStatus(runId: string, status: QueueItem["status"]) {
  const item = queue.find((q) => q.runId === runId);
  if (item) item.status = status;
  notify();
}

function dequeue(runId: string) {
  const i = queue.findIndex((q) => q.runId === runId);
  if (i >= 0) queue.splice(i, 1);
  notify();
}

/**
 * Dispara um evento: enfileira todas as etapas associadas e as executa em
 * série, isolando falhas (uma etapa que falha nunca derruba as demais nem a
 * operação do usuário). Cada etapa é registrada individualmente no log.
 */
export async function emitAutomation(
  ctx: AutomationContext,
  event: AutomationEvent,
  payload: AutomationPayload = {},
): Promise<AutomationLogEntry[]> {
  const rules = rulesForEvent(event);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  queue.push({
    runId,
    event,
    eventLabel: eventLabel(event),
    enqueuedAt: new Date().toISOString(),
    steps: rules.length,
    status: "pending",
  });
  notify();

  const run = async (): Promise<AutomationLogEntry[]> => {
    setQueueStatus(runId, "running");
    const entries: AutomationLogEntry[] = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]!;
      const started = performance.now();
      let status: AutomationLogEntry["status"] = "ok";
      let result = "";
      let errorMessage: string | null = null;
      try {
        const outcome = await rule.run(ctx, payload);
        if (outcome == null) {
          status = "skipped";
          result = "Sem efeito para este evento";
        } else {
          result = outcome;
        }
      } catch (e) {
        status = "error";
        errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        result = `Falha na etapa "${rule.label}": ${errorMessage}`;
      }
      entries.push({
        id: `${runId}-${i}-${rule.id}`,
        at: new Date().toISOString(),
        event,
        eventLabel: eventLabel(event),
        ruleId: rule.id,
        ruleLabel: rule.label,
        status,
        result,
        errorMessage,
        userId: ctx.userId,
        userLabel: ctx.userLabel,
        durationMs: Math.round(performance.now() - started),
        dryRun: !!ctx.dryRun,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        step: i + 1,
        stepCount: rules.length,
        runId,
      });
    }

    appendLog(entries);
    dequeue(runId);
    return entries;
  };

  // Serializa as execuções: nunca há duas filas mexendo no mesmo cache ao mesmo tempo.
  const promise = chain.then(run, run);
  chain = promise.catch(() => undefined);
  return promise;
}
