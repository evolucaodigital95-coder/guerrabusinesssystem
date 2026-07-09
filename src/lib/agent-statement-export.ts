import { formatCurrency, formatDate } from "@/lib/crm";
import * as XLSX from "xlsx";

export type ExportMovement = {
  date: string | null;
  time: string | null;
  type: string;
  description: string;
  company?: string | null;
  lecture?: string | null;
  credit: number;
  debit: number;
  balance: number;
};

export type CreditComposition = {
  company: string;
  lecture: string;
  grossRevenue: number | null;
  materials: number | null;
  fees: number | null;
  otherCosts: number | null;
  netProfit: number | null;
  agentShare: number;
  tithe: number;
};

export type CompanySummary = { company: string; amount: number };
export type AdvanceExportRow = { date: string | null; amount: number; source?: string | null; lecture?: string | null; notes?: string | null };
export type PayoutExportRow = { date: string | null; amount: number; method?: string | null; description?: string | null };
export type FilterInfo = { label: string; value: string };

export type ExportContext = {
  agentName: string;
  teamName?: string | null;
  periodLabel: string;
  emittedAt: string;
  documentId?: string;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  titheAccumulated: number;
  movements: ExportMovement[];
  companySummary?: CompanySummary[];
  creditsComposition?: CreditComposition[];
  advances?: AdvanceExportRow[];
  payouts?: PayoutExportRow[];
  filters?: FilterInfo[];
};

const HEADERS = ["Data", "Hora", "Tipo", "Descrição", "Empresa", "Palestra", "Crédito", "Débito", "Saldo"];

// Brand palette
const NAVY: [number, number, number] = [15, 39, 71];      // #0F2747
const GOLD: [number, number, number] = [200, 164, 90];    // #C8A45A
const GRAPHITE: [number, number, number] = [47, 47, 47];  // #2F2F2F
const LIGHT_GRAY: [number, number, number] = [244, 245, 247]; // #F4F5F7
const MUTED: [number, number, number] = [130, 130, 138];

function rowValues(m: ExportMovement) {
  return [
    formatDate(m.date),
    m.time ?? "",
    m.type,
    m.description,
    m.company ?? "",
    m.lecture ?? "",
    m.credit ? formatCurrency(m.credit) : "",
    m.debit ? formatCurrency(m.debit) : "",
    formatCurrency(m.balance),
  ];
}

function safeFileBase(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "extrato";
}

function pdfFileName(ctx: ExportContext) {
  const base = `GBS_Extrato_${safeFileBase(ctx.agentName)}`;
  const today = new Date().toISOString().slice(0, 10);
  const period = /(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/.exec(ctx.periodLabel);
  if (period) return `${base}_${period[1]}_a_${period[2]}.pdf`;
  return `${base}_${today}.pdf`;
}

export function exportStatementCSV(ctx: ExportContext) {
  const meta = [
    ["GBS — Extrato da Conta Corrente do Agendista"],
    ["Agendista", ctx.agentName],
    ["Equipe", ctx.teamName ?? "Grupo Guerra"],
    ["Período", ctx.periodLabel],
    ["Emissão", ctx.emittedAt],
    ["Saldo inicial", formatCurrency(ctx.openingBalance)],
    ["Créditos do período", formatCurrency(ctx.totalCredits)],
    ["Débitos do período", formatCurrency(ctx.totalDebits)],
    ["Saldo final", formatCurrency(ctx.closingBalance)],
    ["Dízimo sugerido acumulado (informativo)", formatCurrency(ctx.titheAccumulated)],
    [],
  ];
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ...meta.map((row) => row.map(escape).join(";")),
    HEADERS.map(escape).join(";"),
    ...ctx.movements.map((m) => rowValues(m).map(escape).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${safeFileBase(ctx.agentName)}-extrato.csv`);
}

export function exportStatementXLSX(ctx: ExportContext) {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [
    ["GBS — Extrato da Conta Corrente do Agendista"],
    ["Agendista", ctx.agentName],
    ["Equipe", ctx.teamName ?? "Grupo Guerra"],
    ["Período", ctx.periodLabel],
    ["Emissão", ctx.emittedAt],
    ["Saldo inicial", ctx.openingBalance],
    ["Créditos do período", ctx.totalCredits],
    ["Débitos do período", ctx.totalDebits],
    ["Saldo final", ctx.closingBalance],
    ["Dízimo sugerido acumulado (informativo)", ctx.titheAccumulated],
    [],
    HEADERS,
    ...ctx.movements.map((m) => [
      formatDate(m.date), m.time ?? "", m.type, m.description,
      m.company ?? "", m.lecture ?? "",
      m.credit || "", m.debit || "", m.balance,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 40 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Extrato");

  if (ctx.companySummary?.length) {
    const cs = [["Empresa", "Total (R$)"], ...ctx.companySummary.map((c) => [c.company, c.amount])];
    const ws2 = XLSX.utils.aoa_to_sheet(cs);
    ws2["!cols"] = [{ wch: 40 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Por Empresa");
  }
  if (ctx.creditsComposition?.length) {
    const head = ["Empresa", "Palestra", "Valor vendido", "Materiais", "Taxas/Juros", "Outros", "Lucro líquido", "Participação", "Dízimo sugerido"];
    const rows2 = ctx.creditsComposition.map((c) => [
      c.company, c.lecture,
      c.grossRevenue ?? "—", c.materials ?? "—", c.fees ?? "—", c.otherCosts ?? "—",
      c.netProfit ?? "—", c.agentShare, c.tithe,
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([head, ...rows2]);
    XLSX.utils.book_append_sheet(wb, ws3, "Composição");
  }
  XLSX.writeFile(wb, `${safeFileBase(ctx.agentName)}-extrato.xlsx`);
}

/* ============================================================
 * PREMIUM EXECUTIVE PDF
 * ============================================================ */
export async function exportStatementPDF(ctx: ExportContext) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentW = pageW - marginX * 2;

  const documentId = ctx.documentId ?? `GBS-${Date.now().toString(36).toUpperCase()}`;
  const watermark = (ctx.teamName?.trim() || "GRUPO GUERRA").toUpperCase();

  // Draw watermark on every page (behind content)
  const drawWatermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error jspdf gState typing
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(90);
    doc.setTextColor(...NAVY);
    doc.text(watermark, pageW / 2, pageH / 2 + 30, {
      align: "center",
      angle: 30,
    });
    doc.restoreGraphicsState();
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    // Gold hairline
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(marginX, pageH - 42, pageW - marginX, pageH - 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Powered by Grupo Guerra", marginX, pageH - 26);
    doc.text("Documento financeiro confidencial", pageW / 2, pageH - 26, { align: "center" });
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, pageH - 26, { align: "right" });
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text(`Doc. ${documentId}`, pageW - marginX, pageH - 14, { align: "right" });
  };

  /* ------------- HEADER (drawn only on page 1) ------------- */
  let y = 54;

  // Logo mark: gold dot + wordmark
  doc.setFillColor(...GOLD);
  doc.circle(marginX + 5, y + 3, 3.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text("GBS", marginX + 16, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("GUERRA BUSINESS SYSTEM", marginX + 16, y + 20, { charSpace: 1.4 });

  // Right side eyebrow
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("EXTRATO EXECUTIVO", pageW - marginX, y + 2, { align: "right", charSpace: 1.6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("CONTA CORRENTE", pageW - marginX, y + 14, { align: "right", charSpace: 1.4 });

  y += 34;
  // Gold hairline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageW - marginX, y);
  y += 28;

  // Document title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("CONTA CORRENTE DO AGENDISTA", marginX, y, { charSpace: 1.8 });
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text(ctx.agentName.toUpperCase(), marginX, y);
  y += 22;

  // Meta block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  const metaPairs: [string, string][] = [
    ["Equipe", ctx.teamName?.trim() || "Grupo Guerra"],
    ["Período", ctx.periodLabel],
    ["Emitido em", ctx.emittedAt],
    ["Documento", documentId],
  ];
  metaPairs.forEach(([k, v]) => {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(k.toUpperCase(), marginX, y, { charSpace: 1.4 });
    doc.setTextColor(...GRAPHITE);
    doc.setFont("helvetica", "bold");
    doc.text(v, marginX + 90, y);
    y += 14;
  });
  y += 8;

  // Filters block
  if (ctx.filters?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text("FILTROS APLICADOS", marginX, y, { charSpace: 1.6 });
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    ctx.filters.forEach((f) => {
      doc.text(`${f.label}: ${f.value}`, marginX, y);
      y += 12;
    });
    y += 4;
  }

  /* ------------- FINANCIAL SUMMARY CARDS ------------- */
  const cards = [
    { label: "SALDO INICIAL", value: formatCurrency(ctx.openingBalance) },
    { label: "CRÉDITOS", value: formatCurrency(ctx.totalCredits) },
    { label: "DÉBITOS", value: formatCurrency(ctx.totalDebits) },
    { label: "SALDO FINAL", value: formatCurrency(ctx.closingBalance), highlight: true },
  ];
  const cardGap = 10;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 66;

  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + cardGap);
    if (c.highlight) {
      doc.setFillColor(...NAVY);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");
      doc.setTextColor(...GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(c.label, x + 12, y + 20, { charSpace: 1.6 });
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(c.value, x + 12, y + 46);
    } else {
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(c.label, x + 12, y + 20, { charSpace: 1.6 });
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(c.value, x + 12, y + 46);
    }
  });
  y += cardH + 18;

  /* ------------- TITHE BLOCK ------------- */
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentW, 58, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("DÍZIMO SUGERIDO", marginX + 16, y + 20, { charSpace: 1.8 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(formatCurrency(ctx.titheAccumulated), marginX + 16, y + 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const titheNote = "Valor informativo, correspondente a 10% da participação individual apurada\nnos fechamentos financeiros. Não deduzido automaticamente do saldo.";
  doc.text(titheNote, marginX + 200, y + 24);
  y += 74;

  /* ------------- RESULTADO POR EMPRESA ------------- */
  if (ctx.companySummary?.length) {
    y = ensureSpace(doc, y, 40, pageH);
    sectionTitle(doc, "RESULTADO POR EMPRESA", marginX, y);
    y += 18;
    autoTable(doc, {
      startY: y,
      head: [["Empresa", "Total"]],
      body: [
        ...ctx.companySummary.map((c) => [c.company, formatCurrency(c.amount)]),
        [{ content: "TOTAL", styles: { fontStyle: "bold", textColor: NAVY } },
         { content: formatCurrency(ctx.companySummary.reduce((s, c) => s + c.amount, 0)),
           styles: { fontStyle: "bold", halign: "right", textColor: NAVY } }],
      ],
      styles: { fontSize: 9, cellPadding: 6, lineColor: [225, 225, 230], lineWidth: 0.3 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8, halign: "left" },
      columnStyles: { 1: { halign: "right" } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  /* ------------- MOVIMENTAÇÕES DO PERÍODO ------------- */
  y = ensureSpace(doc, y, 60, pageH);
  sectionTitle(doc, "MOVIMENTAÇÕES DO PERÍODO", marginX, y);
  y += 18;

  if (ctx.movements.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Nenhuma movimentação no período.", marginX, y);
    y += 20;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Data", "Hora", "Tipo", "Descrição", "Empresa", "Palestra", "Crédito", "Débito", "Saldo"]],
      body: ctx.movements.map((m) => [
        formatDate(m.date),
        m.time ?? "",
        m.type,
        m.description,
        m.company ?? "",
        m.lecture ?? "",
        { content: m.credit ? formatCurrency(m.credit) : "", styles: { textColor: m.credit ? [22, 101, 52] : MUTED, halign: "right" } },
        { content: m.debit ? formatCurrency(m.debit) : "", styles: { textColor: m.debit ? [159, 18, 57] : MUTED, halign: "right" } },
        { content: formatCurrency(m.balance), styles: { fontStyle: "bold", halign: "right", textColor: NAVY } },
      ]),
      styles: { fontSize: 8, cellPadding: 5, lineColor: [230, 230, 235], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "left" },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: {
        0: { cellWidth: 54 },
        1: { cellWidth: 32 },
        2: { cellWidth: 60 },
        3: { cellWidth: 110 },
        4: { cellWidth: 90 },
        5: { cellWidth: 80 },
        6: { cellWidth: 56, halign: "right" },
        7: { cellWidth: 56, halign: "right" },
        8: { cellWidth: 64, halign: "right" },
      },
      margin: { left: marginX, right: marginX },
      theme: "plain",
      showHead: "everyPage",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  /* ------------- COMPOSIÇÃO DOS CRÉDITOS ------------- */
  if (ctx.creditsComposition?.length) {
    y = ensureSpace(doc, y, 60, pageH);
    sectionTitle(doc, "COMPOSIÇÃO DOS CRÉDITOS", marginX, y);
    y += 18;

    for (const c of ctx.creditsComposition) {
      y = ensureSpace(doc, y, 130, pageH);
      // Card
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, y, contentW, 118, 3, 3, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text("EMPRESA", marginX + 14, y + 18, { charSpace: 1.4 });
      doc.setTextColor(...NAVY);
      doc.setFontSize(10);
      doc.text(c.company.toUpperCase(), marginX + 14, y + 32);
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.text("PALESTRA", marginX + 14, y + 48, { charSpace: 1.4 });
      doc.setTextColor(...GRAPHITE);
      doc.setFontSize(10);
      doc.text(c.lecture, marginX + 14, y + 62);

      // Right-aligned breakdown
      const rightX = pageW - marginX - 14;
      let ry = y + 18;
      const putLine = (label: string, value: number | null, neg = false, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...(bold ? NAVY : MUTED));
        doc.text(label, marginX + 200, ry);
        doc.setTextColor(...(bold ? NAVY : GRAPHITE));
        const txt = value == null ? "—" : (neg ? "-" : "") + formatCurrency(value);
        doc.text(txt, rightX, ry, { align: "right" });
        ry += 12;
      };
      putLine("Valor vendido", c.grossRevenue);
      putLine("(-) Materiais", c.materials, true);
      putLine("(-) Taxas / Juros", c.fees, true);
      putLine("(-) Outros custos", c.otherCosts, true);
      putLine("(=) Lucro líquido", c.netProfit, false, true);
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.3);
      doc.line(marginX + 200, ry - 2, rightX, ry - 2);
      ry += 4;
      putLine("Participação do agendista", c.agentShare, false, true);
      putLine("Dízimo sugerido", c.tithe);

      y += 128;
    }
  }

  /* ------------- ADIANTAMENTOS ------------- */
  if (ctx.advances?.length) {
    y = ensureSpace(doc, y, 50, pageH);
    sectionTitle(doc, "ADIANTAMENTOS", marginX, y);
    y += 18;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Valor", "Origem", "Palestra", "Observação"]],
      body: ctx.advances.map((a) => [
        formatDate(a.date),
        formatCurrency(a.amount),
        a.source ?? "—",
        a.lecture ?? "—",
        a.notes ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 5, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  /* ------------- PAGAMENTOS REALIZADOS ------------- */
  if (ctx.payouts?.length) {
    y = ensureSpace(doc, y, 50, pageH);
    sectionTitle(doc, "PAGAMENTOS REALIZADOS", marginX, y);
    y += 18;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Valor", "Forma", "Descrição"]],
      body: ctx.payouts.map((p) => [
        formatDate(p.date),
        formatCurrency(p.amount),
        p.method ?? "—",
        p.description ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 5, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
  }

  /* ------------- Watermark + footer on all pages ------------- */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawWatermark();
    drawFooter(i, totalPages);
  }

  doc.save(pdfFileName(ctx));
}

/* ============ helpers ============ */
function sectionTitle(doc: import("jspdf").jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(text, x, y, { charSpace: 1.8 });
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(x, y + 4, x + 40, y + 4);
}

function ensureSpace(doc: import("jspdf").jsPDF, y: number, needed: number, pageH: number): number {
  if (y + needed > pageH - 60) {
    doc.addPage();
    return 60;
  }
  return y;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
