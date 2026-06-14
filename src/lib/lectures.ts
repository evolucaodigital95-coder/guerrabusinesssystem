export const LECTURE_STATUS = [
  { key: "lead", label: "Lead" },
  { key: "agendada", label: "Agendada" },
  { key: "confirmada", label: "Confirmada" },
  { key: "realizada", label: "Realizada" },
  { key: "cancelada", label: "Cancelada" },
  { key: "encerrada", label: "Encerrada financeiramente" },
] as const;

export type LectureStatus = (typeof LECTURE_STATUS)[number]["key"];

export function lectureStatusLabel(key: string | null | undefined) {
  if (!key) return "—";
  return LECTURE_STATUS.find((s) => s.key === key)?.label ?? key;
}

export const LECTURE_TIMELINE_KINDS = [
  { key: "lead_created", label: "Lead criado" },
  { key: "first_contact", label: "Primeiro contato" },
  { key: "negotiation", label: "Negociação" },
  { key: "proposal_sent", label: "Proposta enviada" },
  { key: "closing", label: "Fechamento" },
  { key: "payment", label: "Pagamento" },
  { key: "lecture_done", label: "Palestra realizada" },
  { key: "photos_attached", label: "Fotos anexadas" },
  { key: "testimonial", label: "Depoimento" },
  { key: "post_sale", label: "Pós-venda" },
] as const;

export function lectureTimelineLabel(key: string | null | undefined) {
  if (!key) return "Evento";
  return LECTURE_TIMELINE_KINDS.find((k) => k.key === key)?.label ?? key;
}
