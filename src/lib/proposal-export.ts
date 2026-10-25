import { resolveDocBrand, DEFAULT_GOLD, DEFAULT_NAVY, type DocBrand } from "@/lib/doc-brand";
import { BRL } from "@/lib/format";

/**
 * PROPOSTA COMERCIAL — documento para o contratante, no mesmo padrão visual
 * do termo de fechamento (identidade da organização ativa).
 */
export type ProposalData = {
  number: string;
  client: string;
  contact?: string | null;
  title: string;
  theme?: string | null;
  dateLabel: string;
  location: string;
  audience?: number | null;
  duration: string;
  investment: number;
  paymentTerms: string;
  includes: string[];
  validityDays: number;
  notes?: string | null;
  speakerName: string;
  brand?: DocBrand;
};

const GRAPHITE: [number, number, number] = [47, 47, 47];
const MUTED: [number, number, number] = [130, 130, 138];
const LIGHT: [number, number, number] = [246, 245, 241];

export function proposalFileName(d: ProposalData) {
  const safe = d.client
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `Proposta_${d.number}_${safe}.pdf`;
}

export async function buildProposalPDF(d: ProposalData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  const W = pageW - M * 2;
  const brand = d.brand ?? (await resolveDocBrand(null));
  const PRIMARY = brand.primary ?? DEFAULT_NAVY;
  const ACCENT = brand.accent ?? DEFAULT_GOLD;

  /* ---------- Faixa superior ---------- */
  // A faixa cresce com o título (1 ou 2 linhas) para o subtítulo nunca sobrepor.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const titleLines = (doc.splitTextToSize(d.title, W) as string[]).slice(0, 2);
  const bandH = titleLines.length > 1 ? 222 : 196;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, bandH, "F");
  let y = 58;
  const logo = brand.monogramDataUrl ?? brand.logoDataUrl;
  if (logo) {
    // Selo branco: o logo da marca costuma ser escuro e sumiria sobre a faixa.
    const h = 34;
    const w = h * (brand.monogramRatio || 1);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M - 8, y - 16, w + 16, h + 16, 8, 8, "F");
    try {
      doc.addImage(logo, "PNG", M, y - 8, w, h, undefined, "FAST");
    } catch {
      /* sem logo */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(brand.name, pageW - M, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...ACCENT);
  doc.text(`PROPOSTA Nº ${d.number}`, pageW - M, y + 20, { align: "right" });

  y = 120;
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text("PROPOSTA COMERCIAL", M, y, { charSpace: 2 });
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text(titleLines, M, y);
  y += titleLines.length > 1 ? 52 : 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(225, 225, 225);
  doc.text(`Para ${d.client}${d.contact ? ` · aos cuidados de ${d.contact}` : ""}`, M, y);

  /* ---------- Corpo ---------- */
  y = bandH + 34;
  const section = (title: string) => {
    if (y > pageH - 110) {
      doc.addPage();
      y = 64;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PRIMARY);
    doc.text(title, M, y, { charSpace: 1.4 });
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(M, y + 6, M + 36, y + 6);
    y += 22;
  };
  const paragraph = (text: string, size = 10.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...GRAPHITE);
    const lines = doc.splitTextToSize(text, W) as string[];
    doc.text(lines, M, y);
    y += lines.length * (size * 1.4) + 8;
  };

  if (d.theme) {
    section("SOBRE A PALESTRA");
    paragraph(d.theme);
  }

  section("DETALHES DO EVENTO");
  const rows: [string, string][] = [
    ["Data", d.dateLabel],
    ["Local", d.location || "A definir"],
    ["Duração", d.duration],
    [
      "Público estimado",
      d.audience ? `${d.audience.toLocaleString("pt-BR")} pessoas` : "A definir",
    ],
    ["Palestrante", d.speakerName],
  ];
  const colW = W / 2;
  rows.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW;
    if (i % 2 === 0 && i > 0) y += 34;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), x, y, { charSpace: 1.2 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GRAPHITE);
    doc.text((doc.splitTextToSize(v, colW - 12) as string[])[0], x, y + 15);
  });
  y += 44;

  /* Investimento em destaque */
  if (y > pageH - 200) {
    doc.addPage();
    y = 64;
  }
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, W, 80, 8, 8, "F");
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.2);
  doc.line(M, y, M, y + 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("INVESTIMENTO", M + 22, y + 26, { charSpace: 1.6 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...PRIMARY);
  doc.text(BRL.format(d.investment), M + 22, y + 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  const terms = doc.splitTextToSize(d.paymentTerms, W / 2 - 20) as string[];
  doc.text(terms.slice(0, 4), M + W / 2, y + 30);
  y += 104;

  if (d.includes.length) {
    section("O QUE ESTÁ INCLUSO");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    for (const item of d.includes) {
      if (y > pageH - 110) {
        doc.addPage();
        y = 64;
      }
      doc.setFillColor(...ACCENT);
      doc.circle(M + 3, y - 3.5, 2.2, "F");
      doc.setTextColor(...GRAPHITE);
      const lines = doc.splitTextToSize(item, W - 16) as string[];
      doc.text(lines, M + 14, y);
      y += lines.length * 14 + 3;
    }
    y += 10;
  }

  if (d.notes) {
    section("OBSERVAÇÕES");
    paragraph(d.notes, 10);
  }

  section("VALIDADE");
  const until = new Date();
  until.setDate(until.getDate() + d.validityDays);
  paragraph(
    `Esta proposta é válida por ${d.validityDays} dias, até ${until.toLocaleDateString("pt-BR")}. A data do evento é garantida após a confirmação e o pagamento da primeira parcela.`,
    10,
  );

  /* Aceite */
  // Linha de assinatura + nome + papel ocupam ~30pt; nunca encostar no rodapé (pageH - 46).
  y += 24;
  if (y + 32 > pageH - 58) {
    doc.addPage();
    y = 110;
  }
  const sigW = (W - 40) / 2;
  [
    [brand.name, d.speakerName],
    ["Contratante", d.client],
  ].forEach(([role, name], i) => {
    const x = M + i * (sigW + 40);
    doc.setDrawColor(...GRAPHITE);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + sigW, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PRIMARY);
    doc.text(name, x, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(String(role).toUpperCase(), x, y + 25, { charSpace: 1.2 });
  });

  /* Rodapé */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 46, pageW - M, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Proposta ${d.number}`, M, pageH - 32);
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 32, { align: "right" });
  }

  return doc.output("blob");
}
