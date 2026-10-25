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
