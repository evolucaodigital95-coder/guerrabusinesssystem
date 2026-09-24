import { formatCurrency, formatDate } from "@/lib/crm";
import {
  type ExportMovement,
  type AdvanceExportRow,
  type CardEntry,
} from "@/lib/agent-statement-export";
import { resolveDocBrand, type DocBrand } from "@/lib/doc-brand";

/**
 * TERMO DE FECHAMENTO E PRESTAÇÃO DE CONTAS — documento oficial do Grupo Guerra.
 *
 * Este módulo é PURAMENTE DE APRESENTAÇÃO: ele recebe os valores já apurados
 * pelo motor financeiro do GBS (snapshots + conta corrente) e os imprime.
 * Nenhum cálculo financeiro é refeito aqui.
 */

const DEFAULT_NAVY: [number, number, number] = [15, 39, 71];
const DEFAULT_GOLD: [number, number, number] = [200, 164, 90];
const GRAPHITE: [number, number, number] = [47, 47, 47];
const LIGHT: [number, number, number] = [244, 245, 247];
const MUTED: [number, number, number] = [130, 130, 138];
const GREEN: [number, number, number] = [22, 101, 52];
const RED: [number, number, number] = [159, 18, 57];

export type ClosingLectureRow = {
  date: string | null;
  company: string;
  lecture: string;
  revenue: number | null;
  materials: number | null;
  fees: number | null;
  netProfit: number | null;
  agentShare: number;
};

export type ClosingTermData = {
  closingNumber: string;
  version: number;
  status: string;
  agentName: string;
  organizationName: string;
  seasonName?: string | null;
  periodLabel: string;
  closedAtLabel: string;
  responsible: string;
  totals: {
    companies: number;
    lectures: number;
    revenue: number;
    materials: number;
    fees: number;
    expenses: number;
    netProfit: number;
    agentShare: number;
    tithe: number;
    advances: number;
    credits: number;
    debits: number;
    openingBalance: number;
    finalBalance: number;
  };
  movements: ExportMovement[];
  lectures: ClosingLectureRow[];
  advances: AdvanceExportRow[];
  cards?: CardEntry[];
  externalDocs?: { title: string; kind?: string | null; date?: string | null }[];
  notes?: string | null;
  thanksMessage: string;
  /** Identidade visual da organização ativa (apresentação apenas). */
  brand?: DocBrand;
};

export function defaultThanksMessage(orgName?: string | null) {
  return `Em nome ${/^(a|o)\s/i.test(orgName ?? "") ? "d" + (orgName ?? "") : "d" + ("a " + (orgName ?? "organização"))}, agradecemos por todo o comprometimento, dedicação e trabalho realizado durante este período. Cada resultado construído foi fruto de esforço, responsabilidade e parceria. Nosso reconhecimento e nossa gratidão por fazer parte dessa história.`;
}

export const DEFAULT_THANKS_MESSAGE =
  "Em nome do Grupo Guerra, agradecemos por todo o comprometimento, dedicação e trabalho realizado durante este período. Cada resultado construído foi fruto de esforço, responsabilidade e parceria. Nosso reconhecimento e nossa gratidão por fazer parte dessa história.";

export function closingFileName(d: ClosingTermData) {
  const safe = d.agentName.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return `${d.closingNumber}_${safe}_v${d.version}.pdf`;
}

export async function buildClosingTermPDF(d: ClosingTermData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  installTextSanitizer(doc as unknown as { text: (...a: unknown[]) => unknown });

  const pageW = doc.internal.pageSize.getWidth();  // ~595
  const pageH = doc.internal.pageSize.getHeight(); // ~842
  const M = 42;
  const W = pageW - M * 2;
  const brand = d.brand ?? (await resolveDocBrand(null));
  // Paleta da organização ativa (sombreia a paleta padrão apenas nesta função).
  const NAVY = brand.primary ?? DEFAULT_NAVY;
  const GOLD = brand.accent ?? DEFAULT_GOLD;
  const logo = brand.logoDataUrl;
  const monogram = brand.monogramDataUrl ?? logo;
  const monogramRatio = brand.monogramRatio;

  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const space = (y: number, needed: number) => (y + needed > pageH - 70 ? (doc.addPage(), 64) : y);

  const section = (title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(title, M, y, { charSpace: 1.6 });
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.7);
    doc.line(M, y + 5, M + 40, y + 5);
    return y + 20;
  };

  /* ---------------- CAPA / CABEÇALHO ---------------- */
  let y = 56;
  const markW = 46;
  const markH = markW / monogramRatio;
  if (monogram) {
    try {
      doc.addImage(monogram, "PNG", (pageW - markW) / 2, y, markW, markH, undefined, "FAST");
    } catch { /* segue sem marca */ }
    y += markH + 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(brand.name, pageW / 2, y, { align: "center", charSpace: 2 });
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`${brand.tagline} · ARQUIVO OFICIAL`, pageW / 2, y, { align: "center", charSpace: 1.6 });
  y += 22;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, y, pageW - M, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text("TERMO DE FECHAMENTO", pageW / 2, y, { align: "center", charSpace: 1.4 });
  y += 18;
  doc.text("E PRESTAÇÃO DE CONTAS", pageW / 2, y, { align: "center", charSpace: 1.4 });
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...GRAPHITE);
  doc.text(d.agentName.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 26;

  // Faixa com identificação oficial
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, W, 52, 4, 4, "F");
  const badgeCols = [
    ["FECHAMENTO", d.closingNumber],
    ["PERÍODO", d.periodLabel],
    ["DATA", d.closedAtLabel],
  ] as const;
  const bw = W / badgeCols.length;
  badgeCols.forEach(([k, v], i) => {
    const cx = M + i * bw + bw / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...GOLD);
    doc.text(k, cx, y + 19, { align: "center", charSpace: 1.4 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(doc.splitTextToSize(v, bw - 16)[0] ?? "", cx, y + 36, { align: "center" });
  });
  y += 72;

  /* ---------------- SEÇÃO 1 — IDENTIFICAÇÃO ---------------- */
  y = section("1 · IDENTIFICAÇÃO", y);
  const idPairs: [string, string][] = [
    ["Agendista", d.agentName],
    ["Organização", d.organizationName],
    ["Temporada", d.seasonName?.trim() || "Não vinculada"],
    ["Período", d.periodLabel],
    ["Responsável pelo fechamento", d.responsible],
    ["Versão do documento", `v${d.version} · ${d.status.toUpperCase()}`],
  ];
  const colW = W / 2;
  idPairs.forEach(([k, v], i) => {
    const x = M + (i % 2) * colW;
    const ly = y + Math.floor(i / 2) * 26;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), x, ly, { charSpace: 1.3 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAPHITE);
    doc.text(doc.splitTextToSize(v, colW - 14)[0] ?? "", x, ly + 12);
  });
  y += Math.ceil(idPairs.length / 2) * 26 + 12;

  /* ---------------- SEÇÃO 2 — RESUMO DA ATUAÇÃO ---------------- */
  y = space(y, 110);
  y = section("2 · RESUMO DA ATUAÇÃO", y);
  const stats = [
    ["EMPRESAS ATENDIDAS", String(d.totals.companies)],
    ["PALESTRAS REALIZADAS", String(d.totals.lectures)],
    ["RECEITA BRUTA", formatCurrency(d.totals.revenue)],
  ];
  const sw = (W - 24) / 3;
  stats.forEach(([k, v], i) => {
    const x = M + i * (sw + 12);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(x, y, sw, 52, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(...MUTED);
    doc.text(k, x + 12, y + 19, { charSpace: 1.3 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(v, x + 12, y + 39);
  });
  y += 68;

  /* ---------------- SEÇÃO 3 — RESUMO FINANCEIRO ---------------- */
  y = space(y, 180);
  y = section("3 · RESUMO FINANCEIRO", y);
  const money = (n: number) => formatCurrency(n);
  autoTable(doc, {
    startY: y,
    body: [
      ["Receita bruta apurada", money(d.totals.revenue), "plain"],
      ["(-) Materiais / Estoque", "-" + money(d.totals.materials), "neg"],
      ["(-) Juros e taxas de cartão", "-" + money(d.totals.fees), "neg"],
      ["(-) Outras despesas operacionais", "-" + money(d.totals.expenses), "neg"],
      ["(=) Resultado / Lucro líquido", money(d.totals.netProfit), "strong"],
      ["Participação do agendista", money(d.totals.agentShare), "strong"],
      ["Dízimo sugerido (informativo)", money(d.totals.tithe), "muted"],
      ["Adiantamentos recebidos", "-" + money(d.totals.advances), "neg"],
      ["Créditos do período", money(d.totals.credits), "pos"],
      ["Débitos do período", "-" + money(d.totals.debits), "neg"],
      ["Saldo final da conta", money(d.totals.finalBalance), "final"],
    ].map(([label, value, kind]) => [
      { content: label as string, styles: { fontStyle: kind === "plain" ? "normal" : kind === "strong" || kind === "final" ? "bold" : "normal", textColor: kind === "final" ? [255, 255, 255] : kind === "strong" ? NAVY : MUTED } },
      {
        content: value as string,
        styles: {
          halign: "right",
          fontStyle: kind === "strong" || kind === "final" ? "bold" : "normal",
          textColor:
            kind === "final" ? [255, 255, 255]
              : kind === "neg" ? RED
                : kind === "pos" ? GREEN
                  : kind === "muted" ? MUTED
                    : kind === "strong" ? NAVY : GRAPHITE,
        },
      },
    ]),
    styles: { fontSize: 9, cellPadding: 6, lineColor: [232, 232, 238], lineWidth: 0.3 },
    columnStyles: { 1: { cellWidth: 150, halign: "right" } },
    margin: { left: M, right: M },
    theme: "plain",
    didParseCell: (data) => {
      if (data.row.index === 10) data.cell.styles.fillColor = NAVY;
      else if (data.row.index === 4) data.cell.styles.fillColor = LIGHT;
    },
  });
  y = lastY() + 20;

  /* ---------------- SEÇÃO 4 — LANÇAMENTOS DA CONTA ---------------- */
  y = space(y, 120);
  y = section("4 · LANÇAMENTOS DA CONTA CORRENTE", y);
  if (d.movements.length === 0) {
    y = emptyNote(doc, "Nenhum lançamento no período.", M, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Descrição", "Origem", "Crédito", "Débito", "Saldo"]],
      body: d.movements.map((m) => [
        formatDate(m.date),
        m.description,
        [m.company, m.lecture].filter(Boolean).join(" · ") || m.type,
        { content: m.credit ? formatCurrency(m.credit) : "", styles: { halign: "right", textColor: GREEN } },
        { content: m.debit ? formatCurrency(m.debit) : "", styles: { halign: "right", textColor: RED } },
        { content: formatCurrency(m.balance), styles: { halign: "right", fontStyle: "bold", textColor: NAVY } },
      ]),
      styles: { fontSize: 7.6, cellPadding: 4, lineColor: [232, 232, 238], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 130 },
        2: { cellWidth: 115 },
        3: { cellWidth: 58, halign: "right" },
        4: { cellWidth: 58, halign: "right" },
        5: { cellWidth: 98, halign: "right" },
      },
      margin: { left: M, right: M },
      theme: "plain",
    });
    y = lastY() + 20;
  }

  /* ---------------- SEÇÃO 5 — PALESTRAS ---------------- */
  y = space(y, 120);
  y = section("5 · PALESTRAS DO FECHAMENTO", y);
  if (d.lectures.length === 0) {
    y = emptyNote(doc, "Nenhuma palestra fechada no período.", M, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Empresa", "Receita", "Materiais", "Taxas", "Resultado", "Participação"]],
      body: d.lectures.map((l) => [
        formatDate(l.date),
        l.company,
        { content: l.revenue == null ? "—" : formatCurrency(l.revenue), styles: { halign: "right" } },
        { content: l.materials == null ? "—" : "-" + formatCurrency(l.materials), styles: { halign: "right", textColor: RED } },
        { content: l.fees == null ? "—" : "-" + formatCurrency(l.fees), styles: { halign: "right", textColor: RED } },
        { content: l.netProfit == null ? "—" : formatCurrency(l.netProfit), styles: { halign: "right" } },
        { content: formatCurrency(l.agentShare), styles: { halign: "right", fontStyle: "bold", textColor: NAVY } },
      ]),
      styles: { fontSize: 7.6, cellPadding: 4, lineColor: [232, 232, 238], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 133 },
        2: { cellWidth: 62, halign: "right" },
        3: { cellWidth: 62, halign: "right" },
        4: { cellWidth: 54, halign: "right" },
        5: { cellWidth: 62, halign: "right" },
        6: { cellWidth: 86, halign: "right" },
      },
      margin: { left: M, right: M },
      theme: "plain",
    });
    y = lastY() + 20;
  }

  /* ---------------- SEÇÃO 6 — ADIANTAMENTOS ---------------- */
  y = space(y, 100);
  y = section("6 · ADIANTAMENTOS", y);
  if (d.advances.length === 0) {
    y = emptyNote(doc, "Nenhum adiantamento no período.", M, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Descrição / Origem", "Palestra", "Valor"]],
      body: d.advances.map((a) => [
        formatDate(a.date),
        a.notes?.trim() || a.source || "Adiantamento",
        a.lecture ?? "—",
        { content: formatCurrency(a.amount), styles: { halign: "right", textColor: RED } },
      ]),
      styles: { fontSize: 8, cellPadding: 5, lineColor: [232, 232, 238], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: "bold" },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: { 0: { cellWidth: 62 }, 3: { cellWidth: 100, halign: "right" } },
      margin: { left: M, right: M },
      theme: "plain",
    });
    y = lastY() + 20;
  }

  /* ---------------- SEÇÃO 7 — CARTÕES LANÇADOS ---------------- */
  y = space(y, 120);
  y = section("7 · CARTÕES LANÇADOS (TODAS AS EMPRESAS)", y);
  if (!d.cards?.length) {
    y = emptyNote(doc, "Nenhum pagamento em cartão registrado no período.", M, y);
  } else {
    const sumC = (pick: (c: CardEntry) => number | null | undefined) =>
      d.cards!.reduce((s, c) => s + Number(pick(c) ?? 0), 0);
    autoTable(doc, {
      startY: y,
      head: [["Data", "Empresa / Palestra", "Bandeira", "Parc.", "Bruto", "Juros", "Líquido"]],
      body: d.cards.map((c) => [
        formatDate(c.date),
        [c.company, c.lecture].filter(Boolean).join(" · "),
        c.brand,
        c.installments ? `${c.installments}x` : "1x",
        { content: formatCurrency(c.amount), styles: { halign: "right" } },
        { content: c.feeAmount != null ? "-" + formatCurrency(c.feeAmount) : "—", styles: { halign: "right", textColor: RED } },
        { content: formatCurrency(c.netAmount ?? c.amount), styles: { halign: "right", fontStyle: "bold", textColor: NAVY } },
      ]),
      foot: [[
        { content: "TOTAL", styles: { fontStyle: "bold", textColor: NAVY } },
        "", "", "",
        { content: formatCurrency(sumC((c) => c.amount)), styles: { halign: "right", fontStyle: "bold" } },
        { content: "-" + formatCurrency(sumC((c) => c.feeAmount)), styles: { halign: "right", fontStyle: "bold", textColor: RED } },
        { content: formatCurrency(sumC((c) => c.netAmount ?? c.amount)), styles: { halign: "right", fontStyle: "bold", textColor: NAVY } },
      ]],
      styles: { fontSize: 7.4, cellPadding: 4, lineColor: [232, 232, 238], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7, fontStyle: "bold" },
      footStyles: { fillColor: LIGHT },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 145 },
        2: { cellWidth: 62 },
        3: { cellWidth: 32, halign: "center" },
        4: { cellWidth: 68, halign: "right" },
        5: { cellWidth: 60, halign: "right" },
        6: { cellWidth: 72, halign: "right" },
      },
      margin: { left: M, right: M },
      theme: "plain",
    });
    y = lastY() + 18;

    // Fotos dos cartões — página dedicada
    const withPhotos = d.cards.filter((c) => c.photos?.some((p) => p.dataUrl || p.url));
    if (withPhotos.length) {
      doc.addPage();
      let py = 56;
      py = section("7.1 · FOTOS DOS CARTÕES", py);
      const tW = (W - 14) / 2;
      const tH = tW * 0.62;
      for (const c of withPhotos) {
        py = space(py, 30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.4);
        doc.setTextColor(...NAVY);
        const label = `${c.company} · ${c.brand} ${c.installments ? `${c.installments}x` : "1x"} · ${formatCurrency(c.amount)}${c.date ? ` · ${formatDate(c.date)}` : ""}`;
        doc.text(doc.splitTextToSize(label, W)[0] ?? "", M, py);
        py += 12;
        let col = 0;
        for (const p of c.photos ?? []) {
          if (col === 0) py = space(py, tH + 34);
          const x = M + col * (tW + 14);
          doc.setDrawColor(215, 215, 220);
          doc.setLineWidth(0.4);
          doc.roundedRect(x, py, tW, tH, 3, 3, "S");
          if (p.dataUrl) {
            try {
              const fmt = (p.mimeType ?? "").toLowerCase().includes("png") ? "PNG" : "JPEG";
              doc.addImage(p.dataUrl, fmt, x + 2, py + 2, tW - 4, tH - 4, undefined, "FAST");
            } catch { /* ignora imagem inválida */ }
          } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text("Arquivo não-imagem", x + 10, py + tH / 2);
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(...MUTED);
          doc.text(doc.splitTextToSize(p.fileName, tW)[0] ?? "", x, py + tH + 10);
          col = (col + 1) % 2;
          if (col === 0) py += tH + 26;
        }
        if (col !== 0) py += tH + 26;
        py += 6;
      }
      y = py + 10;
    }
  }

  /* ---------------- SEÇÃO 8 — DÍZIMO ---------------- */
  y = space(y, 80);
  y = section("8 · DÍZIMO", y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, W, 50, 4, 4, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...GOLD);
  doc.text("DÍZIMO SUGERIDO SOBRE A PARTICIPAÇÃO", M + 14, y + 18, { charSpace: 1.4 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(formatCurrency(d.totals.tithe), M + 14, y + 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize("Valor informativo — não constitui despesa operacional e não é deduzido do saldo da conta corrente.", W - 190),
    M + 170, y + 28,
  );
  y += 66;

  /* ---------------- SEÇÃO 9 — DOCUMENTOS EXTERNOS ---------------- */
  y = space(y, 80);
  y = section("9 · DOCUMENTOS EXTERNOS VINCULADOS", y);
  if (!d.externalDocs?.length) {
    y = emptyNote(doc, "Nenhum documento externo vinculado a esta conta.", M, y);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.6);
    doc.setTextColor(...GRAPHITE);
    for (const ext of d.externalDocs) {
      y = space(y, 16);
      const line = `• ${ext.title}${ext.kind ? ` · ${ext.kind}` : ""}${ext.date ? ` · ${formatDate(ext.date)}` : ""}`;
      doc.text(doc.splitTextToSize(line, W)[0] ?? "", M, y);
      y += 13;
    }
    y += 8;
  }

  /* ---------------- SEÇÃO 10 — OBSERVAÇÕES ---------------- */
  y = space(y, 80);
  y = section("10 · OBSERVAÇÕES", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  const obs = d.notes?.trim() || "Sem observações registradas neste fechamento.";
  const obsLines = doc.splitTextToSize(obs, W);
  obsLines.forEach((ln: string) => { y = space(y, 16); doc.text(ln, M, y); y += 13; });
  y += 14;

  /* ---------------- MENSAGEM DO GRUPO GUERRA ---------------- */
  const msgLines = doc.splitTextToSize(d.thanksMessage, W - 40);
  const boxH = 44 + msgLines.length * 13;
  y = space(y, boxH + 90);
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, W, boxH, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(...GOLD);
  doc.text(`MENSAGEM · ${brand.name}`, M + 20, y + 22, { charSpace: 1.6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  msgLines.forEach((ln: string, i: number) => doc.text(ln, M + 20, y + 40 + i * 13));
  y += boxH + 46;

  /* ---------------- ASSINATURAS ---------------- */
  y = space(y, 70);
  const sigW = (W - 40) / 2;
  [[titleCaseName(brand.name), d.responsible], ["Agendista", d.agentName]].forEach(([role, name], i) => {
    const x = M + i * (sigW + 40);
    doc.setDrawColor(...GRAPHITE);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + sigW, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...NAVY);
    doc.text(name, x, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(role.toUpperCase(), x, y + 25, { charSpace: 1.3 });
  });

  /* ---------------- RODAPÉ ---------------- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 46, pageW - M, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`${d.closingNumber} · v${d.version}`, M, pageH - 32);
    doc.text("Documento oficial · Arquivo Oficial do GBS", pageW / 2, pageH - 32, { align: "center" });
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 32, { align: "right" });
  }

  return doc.output("blob");
}

function titleCaseName(v: string) {
  return v.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function emptyNote(doc: import("jspdf").jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.6);
  doc.setTextColor(...MUTED);
  doc.text(text, x, y);
  return y + 22;
}

/** jsPDF (WinAnsi) não possui glifos para setas — normaliza antes de imprimir. */
function installTextSanitizer(doc: { text: (...a: unknown[]) => unknown }) {
  const raw = doc.text.bind(doc) as (...a: unknown[]) => unknown;
  const fix = (v: unknown): unknown =>
    typeof v === "string"
      ? v.replace(/[\u2192\u21D2\u27A1]/g, "-").replace(/[\u2190\u21D0]/g, "-")
      : Array.isArray(v) ? v.map(fix) : v;
  doc.text = ((t: unknown, ...rest: unknown[]) => raw(fix(t), ...rest)) as typeof doc.text;
}
