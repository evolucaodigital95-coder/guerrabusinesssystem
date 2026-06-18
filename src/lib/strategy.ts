export const SEASON_STATUS = [
  { key: "planejamento", label: "Planejamento" },
  { key: "ativa", label: "Ativa" },
  { key: "encerrada", label: "Encerrada" },
  { key: "arquivada", label: "Arquivada" },
] as const;

export const CAMPAIGN_STATUS = [
  { key: "planejamento", label: "Planejamento" },
  { key: "ativa", label: "Ativa" },
  { key: "pausada", label: "Pausada" },
  { key: "encerrada", label: "Encerrada" },
] as const;

export const PROJECT_STATUS = [
  { key: "planejamento", label: "Planejamento" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "pausado", label: "Pausado" },
  { key: "concluido", label: "Concluído" },
  { key: "cancelado", label: "Cancelado" },
] as const;

export function seasonStatusLabel(k: string | null | undefined) {
  if (!k) return "—";
  return SEASON_STATUS.find((s) => s.key === k)?.label ?? k;
}
export function campaignStatusLabel(k: string | null | undefined) {
  if (!k) return "—";
  return CAMPAIGN_STATUS.find((s) => s.key === k)?.label ?? k;
}
export function projectStatusLabel(k: string | null | undefined) {
  if (!k) return "—";
  return PROJECT_STATUS.find((s) => s.key === k)?.label ?? k;
}
