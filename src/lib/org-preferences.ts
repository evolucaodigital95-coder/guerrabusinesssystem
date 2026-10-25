import { useOrgSettings } from "@/hooks/use-onboarding";

/**
 * Preferências da organização que mudam a experiência (gravadas em
 * `organization_settings.preferences`). Cada cliente do GBS ajusta o
 * sistema ao próprio jeito de trabalhar.
 */
export type OrgPreferences = {
  /** "simple" esconde módulos de gestão avançada (modo palestrante solo). */
  navMode: "full" | "simple";
  /** Mostra o dízimo sugerido nas telas e documentos. */
  showTithe: boolean;
  /** Como a organização chama quem vende/agenda as palestras. */
  agentLabel: string;
  /** Venda de livros/kits no evento entra na divisão com o agendista. */
  bookSalesInSplit: boolean;
  /** Percentual de dízimo (0.1 = 10%). */
  titheRate: number;
};

export const DEFAULT_PREFERENCES: OrgPreferences = {
  navMode: "full",
  showTithe: true,
  agentLabel: "Agendista",
  bookSalesInSplit: false,
  titheRate: 0.1,
};

/** Categoria financeira e motivo de estoque usados pela "Venda no evento". */
export const EVENT_SALE_CATEGORY = "Venda de livros";
export const EVENT_SALE_REASON_PREFIX = "Venda no evento";

export function parsePreferences(
  raw: Record<string, unknown> | null | undefined,
  tithePercent?: number | null,
): OrgPreferences {
  const p = raw ?? {};
  const label =
    typeof p.agentLabel === "string" && p.agentLabel.trim() ? p.agentLabel.trim() : null;
  return {
    navMode: p.navMode === "simple" ? "simple" : "full",
    showTithe: p.showTithe === false ? false : true,
    agentLabel: label ?? DEFAULT_PREFERENCES.agentLabel,
    bookSalesInSplit: p.bookSalesInSplit === true,
    titheRate:
      tithePercent != null && Number.isFinite(Number(tithePercent))
        ? Number(tithePercent) / 100
        : DEFAULT_PREFERENCES.titheRate,
  };
}

export function useOrgPreferences(): OrgPreferences {
  const settings = useOrgSettings();
  return parsePreferences(settings.data?.preferences, settings.data?.tithe_percent);
}

/** Plural simples para rótulos ("Agendista" → "Agendistas", "Produtor" → "Produtores"). */
export function pluralLabel(label: string) {
  if (/[rsz]$/i.test(label)) return `${label}es`;
  if (/l$/i.test(label)) return `${label.slice(0, -1)}is`;
  return `${label}s`;
}
