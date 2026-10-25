import {
  Bot,
  BrainCircuit,
  Briefcase,
  CalendarClock,
  CalendarRange,
  CreditCard,
  Home,
  Library,
  Megaphone,
  Mic,
  Package,
  Presentation,
  Settings,
  ShieldAlert,
  Building,
  Target,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ModuleDef {
  to: string;
  label: string;
  icon: LucideIcon;
  section: "principal" | "operação" | "gestão" | "inteligência" | "sistema";
}

/** Itens do menu lateral, na ordem em que aparecem. */
export const MODULES: ModuleDef[] = [
  // PRINCIPAL
  { to: "/app/hoje", label: "Início", icon: Home, section: "principal" },
  { to: "/app/agenda", label: "Agenda", icon: CalendarClock, section: "principal" },

  // OPERAÇÃO
  { to: "/app/crm", label: "CRM", icon: Users, section: "operação" },
  { to: "/app/palestras", label: "Palestras", icon: Mic, section: "operação" },
  { to: "/app/agendistas", label: "Agendistas", icon: UserCog, section: "operação" },
  { to: "/app/estoque", label: "Estoque", icon: Package, section: "operação" },
  { to: "/app/financeiro", label: "Financeiro", icon: Wallet, section: "operação" },
  { to: "/app/pendencias", label: "Pendências", icon: ShieldAlert, section: "operação" },

  // GESTÃO
  { to: "/app/temporadas", label: "Temporadas", icon: CalendarRange, section: "gestão" },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone, section: "gestão" },
  { to: "/app/projetos", label: "Projetos", icon: Briefcase, section: "gestão" },
  { to: "/app/metas", label: "Metas", icon: Target, section: "gestão" },

  // INTELIGÊNCIA
  {
    to: "/app/inteligencia",
    label: "Central de Inteligência",
    icon: BrainCircuit,
    section: "inteligência",
  },
  {
    to: "/app/centro-palestrante",
    label: "Área do Palestrante",
    icon: Presentation,
    section: "inteligência",
  },
  { to: "/app/biblioteca", label: "Central de Conteúdo", icon: Library, section: "inteligência" },

  // SISTEMA
  { to: "/app/automacoes", label: "Automações", icon: Bot, section: "sistema" },
  { to: "/app/organizacao", label: "Organização", icon: Building, section: "sistema" },
  { to: "/app/planos", label: "Plano e cobrança", icon: CreditCard, section: "sistema" },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings, section: "sistema" },
];

/** Rota → chave de módulo escolhida em Organização → Preferências. */
export const MODULE_KEY_BY_ROUTE: Record<string, string> = {
  "/app/crm": "crm",
  "/app/palestras": "palestras",
  "/app/estoque": "estoque",
  "/app/financeiro": "financeiro",
  "/app/agendistas": "agendistas",
  "/app/centro-palestrante": "palestrantes",
  "/app/temporadas": "temporadas",
  "/app/campanhas": "campanhas",
  "/app/projetos": "projetos",
  "/app/inteligencia": "relatorios",
  "/app/biblioteca": "biblioteca",
  "/app/agenda": "agenda",
};

/** Escondidos no modo simplificado (palestrante solo). */
export const ADVANCED_ROUTES = new Set([
  "/app/temporadas",
  "/app/campanhas",
  "/app/projetos",
  "/app/automacoes",
  "/app/inteligencia",
  "/app/biblioteca",
]);

/** Itens do menu visíveis para a organização, conforme módulos e modo escolhidos. */
export function visibleModules(opts: {
  enabledModules: string[];
  navMode: "full" | "simple";
  agentLabel: string;
  agentPlural: string;
}): ModuleDef[] {
  return MODULES.filter((m) => {
    if (opts.navMode === "simple" && ADVANCED_ROUTES.has(m.to)) return false;
    const key = MODULE_KEY_BY_ROUTE[m.to];
    if (key && opts.enabledModules.length > 0 && !opts.enabledModules.includes(key)) return false;
    return true;
  }).map((m) => (m.to === "/app/agendistas" ? { ...m, label: opts.agentPlural } : m));
}
