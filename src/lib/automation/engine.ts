import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { eventLabel, type AutomationEvent, type AutomationPayload } from "./events";
import { rulesForEvent } from "./rules";

/**
 * GBS Event Engine — motor central de automações.
 *
 * Regra de ouro: o motor NÃO calcula nada e NÃO altera regra financeira.
 * Ele apenas reage a eventos, propaga atualizações e registra log auditável.
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
  userId: string | null;
  userLabel: string | null;
  durationMs: number;
  dryRun: boolean;
  entityType?: string | null;
  entityId?: string | null;
};

const LOG_KEY = "gbs.automation.log";
const LOG_LIMIT = 400;

export function readAutomationLog(): AutomationLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as AutomationLogEntry[]) : [];
  } catch {
    return [];
  }
}

function appendLog(entries: AutomationLogEntry[]) {
  if (typeof window === "undefined" || entries.length === 0) return;
  const next = [...entries, ...readAutomationLog()].slice(0, LOG_LIMIT);
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("gbs:automation-log"));
  } catch {
    /* storage cheio — o log é auxiliar, nunca bloqueia a operação */
  }
}

export function clearAutomationLog() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOG_KEY);
  window.dispatchEvent(new CustomEvent("gbs:automation-log"));
}

/**
 * Dispara um evento: executa todas as regras associadas, isolando falhas
 * (uma regra que falha nunca derruba a operação do usuário).
 */
export async function emitAutomation(
  ctx: AutomationContext,
  event: AutomationEvent,
  payload: AutomationPayload = {},
): Promise<AutomationLogEntry[]> {
  const rules = rulesForEvent(event);
  const entries: AutomationLogEntry[] = [];

  for (const rule of rules) {
    const started = performance.now();
    let status: AutomationLogEntry["status"] = "ok";
    let result = "";
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
      result = e instanceof Error ? e.message : "Erro desconhecido";
    }
    entries.push({
      id: `${Date.now()}-${rule.id}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      event,
      eventLabel: eventLabel(event),
      ruleId: rule.id,
      ruleLabel: rule.label,
      status,
      result,
      userId: ctx.userId,
      userLabel: ctx.userLabel,
      durationMs: Math.round(performance.now() - started),
      dryRun: !!ctx.dryRun,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
    });
  }

  appendLog(entries);
  return entries;
}
