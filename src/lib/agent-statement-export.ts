import { formatCurrency, formatDate } from "@/lib/crm";
import * as XLSX from "xlsx";
import grupoGuerraLogo from "@/assets/grupo-guerra-logo.png.asset.json";

/**
 * Cache do dataURL da logo do Grupo Guerra para reuso entre gerações de PDF.
 * O CDN de assets é servido a partir do mesmo origin, então uma única
 * requisição basta e o browser cacheia.
 */
let __logoDataUrlPromise: Promise<string | null> | null = null;
function loadGuerraLogoDataUrl(): Promise<string | null> {
  if (__logoDataUrlPromise) return __logoDataUrlPromise;
  __logoDataUrlPromise = (async () => {
    try {
      const res = await fetch(grupoGuerraLogo.url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();
  return __logoDataUrlPromise;
}

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

export type CompositionExpenseLine = {
  label: string;
  amount: number;
  category: "materials" | "cardFees" | "ruleFee" | "tax" | "cost" | "expense";
};

export type CreditComposition = {
  company: string;
  lecture: string;
  date?: string | null;
  grossRevenue: number | null;
  materials: number | null;
  cardFees?: number | null;
  ruleFee?: number | null;
  fees: number | null; // legacy — juros/taxa cartão + taxa regra (se cardFees/ruleFee não informados)
  otherCosts: number | null;
  netProfit: number | null;
  agentShare: number;
  tithe: number;
  expenseLines?: CompositionExpenseLine[];
};

export type CompanySummary = { company: string; amount: number };
export type AdvanceExportRow = {
  date: string | null;
  amount: number;
  source?: string | null;
  lecture?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
};
export type PayoutExportRow = {
  date: string | null;
  amount: number;
  method?: string | null;
  description?: string | null;
  receiptUrl?: string | null;
};
export type FilterInfo = { label: string; value: string };

export type ReceiptItem = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt?: string | null;
  /** data URL (image/*) — quando presente, é embutido como thumbnail no PDF */
  dataUrl?: string | null;
  /** URL assinada (para não-imagens ou fallback) — vira link clicável */
  url?: string | null;
  source?: "attachment" | "advance";
};

export type ReceiptGroup = {
  company: string;
  lecture?: string | null;
  date?: string | null;
  items: ReceiptItem[];
};

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
  receipts?: ReceiptGroup[];
};

const HEADERS = ["Data", "Hora", "Tipo", "Descrição", "Empresa", "Palestra", "Crédito", "Débito", "Saldo"];

// Brand palette
const NAVY: [number, number, number] = [15, 39, 71];
const GOLD: [number, number, number] = [200, 164, 90];
const GRAPHITE: [number, number, number] = [47, 47, 47];
const LIGHT_GRAY: [number, number, number] = [244, 245, 247];
const MUTED: [number, number, number] = [130, 130, 138];
const CREDIT_GREEN: [number, number, number] = [22, 101, 52];
const DEBIT_RED: [number, number, number] = [159, 18, 57];

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

/* ============================================================
 * CSV
 * ============================================================ */
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
  const rowValues = (m: ExportMovement) => [
    formatDate(m.date), m.time ?? "", m.type, m.description,
    m.company ?? "", m.lecture ?? "",
    m.credit ? formatCurrency(m.credit) : "",
    m.debit ? formatCurrency(m.debit) : "",
    formatCurrency(m.balance),
  ];
  const lines = [
    ...meta.map((row) => row.map(escape).join(";")),
    HEADERS.map(escape).join(";"),
    ...ctx.movements.map((m) => rowValues(m).map(escape).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${safeFileBase(ctx.agentName)}-extrato.csv`);
}

/* ============================================================
 * XLSX
 * ============================================================ */
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
    const head = ["Empresa", "Palestra", "Data", "Valor vendido", "Materiais", "Juros/Taxa cartão", "Taxa da regra", "Outros custos", "Lucro líquido", "Participação", "Dízimo sugerido"];
    const rows2 = ctx.creditsComposition.map((c) => [
      c.company, c.lecture, formatDate(c.date ?? null),
      c.grossRevenue ?? "—",
      c.materials ?? "—",
      c.cardFees ?? "—",
      c.ruleFee ?? "—",
      c.otherCosts ?? "—",
      c.netProfit ?? "—",
      c.agentShare, c.tithe,
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([head, ...rows2]);
    XLSX.utils.book_append_sheet(wb, ws3, "Composição");
  }
  if (ctx.advances?.length) {
    const rows3 = [["Data", "Valor", "Origem", "Palestra", "Observação"], ...ctx.advances.map((a) => [formatDate(a.date), a.amount, a.source ?? "", a.lecture ?? "", a.notes ?? ""])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows3), "Adiantamentos");
  }
  if (ctx.payouts?.length) {
    const rows4 = [["Data", "Valor", "Forma", "Descrição"], ...ctx.payouts.map((p) => [formatDate(p.date), p.amount, p.method ?? "", p.description ?? ""])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows4), "Pagamentos");
  }
  XLSX.writeFile(wb, `${safeFileBase(ctx.agentName)}-extrato.xlsx`);
}

/* ============================================================
 * PREMIUM EXECUTIVE PDF — Landscape "Private Banking"
 * ============================================================ */
export async function exportStatementPDF(ctx: ExportContext) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const pageW = doc.internal.pageSize.getWidth();  // ~842
  const pageH = doc.internal.pageSize.getHeight(); // ~595
  const marginX = 40;
  const contentW = pageW - marginX * 2;            // ~762

  const documentId = ctx.documentId ?? `GBS-${Date.now().toString(36).toUpperCase()}`;
  const watermark = (ctx.teamName?.trim() || "GRUPO GUERRA").toUpperCase();

  const drawWatermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error jspdf gState typing
    doc.setGState(new doc.GState({ opacity: 0.04 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(110);
    doc.setTextColor(...NAVY);
    doc.text(watermark, pageW / 2, pageH / 2 + 30, { align: "center", angle: 22 });
    doc.restoreGraphicsState();
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.line(marginX, pageH - 36, pageW - marginX, pageH - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Powered by Grupo Guerra", marginX, pageH - 22);
    doc.text("Documento financeiro confidencial", pageW / 2, pageH - 22, { align: "center" });
    doc.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, pageH - 22, { align: "right" });
    doc.setFontSize(7);
    doc.text(`Doc. ${documentId}`, pageW - marginX, pageH - 12, { align: "right" });
  };

  /* ---------------- HEADER (page 1) ---------------- */
  let y = 46;
  doc.setFillColor(...GOLD);
  doc.circle(marginX + 5, y + 3, 3.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text("GBS", marginX + 16, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("GUERRA BUSINESS SYSTEM", marginX + 16, y + 20, { charSpace: 1.4 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("EXTRATO EXECUTIVO", pageW - marginX, y + 2, { align: "right", charSpace: 1.6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("CONTA CORRENTE DO AGENDISTA", pageW - marginX, y + 14, { align: "right", charSpace: 1.4 });

  y += 30;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageW - marginX, y);
  y += 22;

  // Title + meta (2 columns)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text(ctx.agentName.toUpperCase(), marginX, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("CONTA CORRENTE DO AGENDISTA", marginX, y + 6, { charSpace: 1.6 });
  y += 20;

  // Meta grid (right side)
  const metaLeft = marginX;
  const metaRightX = marginX + 380;
  const metaPairs: [string, string][] = [
    ["Equipe", ctx.teamName?.trim() || "Grupo Guerra"],
    ["Período", ctx.periodLabel],
    ["Emitido em", ctx.emittedAt],
    ["Documento", documentId],
  ];
  let my = y;
  metaPairs.forEach(([k, v], i) => {
    const col = i < 2 ? metaLeft : metaRightX;
    const line = i % 2;
    const ly = y + line * 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), col, ly, { charSpace: 1.4 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text(v, col + 70, ly);
    my = Math.max(my, ly);
  });
  y = my + 20;

  // Filters
  if (ctx.filters?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text("FILTROS APLICADOS", marginX, y, { charSpace: 1.6 });
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAPHITE);
    const chunks = ctx.filters.map((f) => `${f.label}: ${f.value}`).join("   •   ");
    const wrapped = doc.splitTextToSize(chunks, contentW);
    wrapped.forEach((line: string) => { doc.text(line, marginX, y); y += 11; });
    y += 4;
  }

  /* ---------------- SUMMARY CARDS ---------------- */
  const cards = [
    { label: "SALDO INICIAL", value: formatCurrency(ctx.openingBalance) },
    { label: "CRÉDITOS DO PERÍODO", value: formatCurrency(ctx.totalCredits) },
    { label: "DÉBITOS DO PERÍODO", value: formatCurrency(ctx.totalDebits) },
    { label: "SALDO FINAL", value: formatCurrency(ctx.closingBalance), highlight: true },
  ];
  const cardGap = 12;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 60;

  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + cardGap);
    if (c.highlight) {
      doc.setFillColor(...NAVY);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");
      doc.setTextColor(...GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(c.label, x + 12, y + 18, { charSpace: 1.6 });
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(c.value, x + 12, y + 42);
    } else {
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(c.label, x + 12, y + 18, { charSpace: 1.6 });
      doc.setTextColor(...NAVY);
      doc.setFontSize(13);
      doc.text(c.value, x + 12, y + 42);
    }
  });
  y += cardH + 14;

  // Tithe row
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentW, 42, 3, 3, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...GOLD);
  doc.text("DÍZIMO SUGERIDO ACUMULADO", marginX + 14, y + 16, { charSpace: 1.8 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text(formatCurrency(ctx.titheAccumulated), marginX + 14, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "10% da participação individual apurada nos fechamentos. Informativo — não deduzido automaticamente do saldo.",
    marginX + 250, y + 26,
  );
  y += 58;

  /* ---------------- RESULTADO POR EMPRESA ---------------- */
  if (ctx.companySummary?.length) {
    y = ensureSpace(doc, y, 40, pageH);
    sectionTitle(doc, "RESULTADO POR EMPRESA", marginX, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      head: [["Empresa", "Total"]],
      body: [
        ...ctx.companySummary.map((c) => [c.company, formatCurrency(c.amount)]),
        [
          { content: "TOTAL", styles: { fontStyle: "bold", textColor: NAVY } },
          { content: formatCurrency(ctx.companySummary.reduce((s, c) => s + c.amount, 0)),
            styles: { fontStyle: "bold", halign: "right", textColor: NAVY } },
        ],
      ],
      styles: { fontSize: 9, cellPadding: 5, lineColor: [225, 225, 230], lineWidth: 0.3 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 1: { halign: "right", cellWidth: 140 } },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  /* ---------------- MOVIMENTAÇÕES ---------------- */
  y = ensureSpace(doc, y, 60, pageH);
  sectionTitle(doc, "MOVIMENTAÇÕES DO PERÍODO", marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "Todos os créditos e débitos do agendista no período — comissões, adiantamentos, pagamentos e ajustes.",
    marginX, y + 6,
  );
  y += 14;

  if (ctx.movements.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Nenhuma movimentação no período.", marginX, y);
    y += 20;
  } else {
    // Column widths sum ≤ contentW (~762)
    const cols = {
      date: 56,      // Data
      time: 34,      // Hora
      type: 68,      // Tipo
      desc: 168,     // Descrição
      company: 96,   // Empresa
      lecture: 108,  // Palestra
      credit: 66,    // Crédito
      debit: 66,     // Débito
      balance: 74,   // Saldo
    };
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
        { content: m.credit ? formatCurrency(m.credit) : "", styles: { textColor: m.credit ? CREDIT_GREEN : MUTED, halign: "right" } },
        { content: m.debit ? formatCurrency(m.debit) : "", styles: { textColor: m.debit ? DEBIT_RED : MUTED, halign: "right" } },
        { content: formatCurrency(m.balance), styles: { fontStyle: "bold", halign: "right", textColor: NAVY } },
      ]),
      styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 235], lineWidth: 0.25, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "left" },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: {
        0: { cellWidth: cols.date },
        1: { cellWidth: cols.time },
        2: { cellWidth: cols.type },
        3: { cellWidth: cols.desc },
        4: { cellWidth: cols.company },
        5: { cellWidth: cols.lecture },
        6: { cellWidth: cols.credit, halign: "right" },
        7: { cellWidth: cols.debit, halign: "right" },
        8: { cellWidth: cols.balance, halign: "right" },
      },
      margin: { left: marginX, right: marginX },
      theme: "plain",
      showHead: "everyPage",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  }

  /* ---------------- COMPOSIÇÃO DOS CRÉDITOS ---------------- */
  if (ctx.creditsComposition?.length) {
    y = ensureSpace(doc, y, 50, pageH);
    sectionTitle(doc, "COMPOSIÇÃO DETALHADA DOS CRÉDITOS", marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Como cada comissão foi apurada: valor bruto vendido → deduções (materiais, juros do cartão, taxas, custos) → lucro → participação.",
      marginX, y + 6,
    );
    y += 16;

    for (const c of ctx.creditsComposition) {
      const lineCount = c.expenseLines?.length ?? 0;
      const cardHeight = 100 + Math.min(lineCount, 12) * 10;
      y = ensureSpace(doc, y, cardHeight + 12, pageH);

      // Card frame
      doc.setDrawColor(220, 220, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, y, contentW, cardHeight, 3, 3, "S");

      // Left column — company/lecture
      const leftX = marginX + 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...GOLD);
      doc.text("EMPRESA", leftX, y + 16, { charSpace: 1.4 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      const companyLines = doc.splitTextToSize(c.company.toUpperCase(), 240);
      doc.text(companyLines[0] ?? "", leftX, y + 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...GOLD);
      doc.text("PALESTRA", leftX, y + 48, { charSpace: 1.4 });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAPHITE);
      const lecLines = doc.splitTextToSize(c.lecture, 240);
      doc.text(lecLines[0] ?? "", leftX, y + 62);

      if (c.date) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GOLD);
        doc.text("DATA", leftX, y + 80, { charSpace: 1.4 });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...GRAPHITE);
        doc.text(formatDate(c.date), leftX, y + 92);
      }

      // Middle column — expense line details
      const midX = marginX + 280;
      const midW = 200;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...NAVY);
      doc.text("DEDUÇÕES DETALHADAS", midX, y + 16, { charSpace: 1.4 });

      let ey = y + 30;
      if (c.expenseLines && c.expenseLines.length > 0) {
        c.expenseLines.slice(0, 12).forEach((ln) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(...GRAPHITE);
          const labelLines = doc.splitTextToSize(ln.label, midW - 60);
          doc.text(labelLines[0] ?? "", midX, ey);
          doc.setTextColor(...DEBIT_RED);
          doc.text("-" + formatCurrency(Math.abs(ln.amount)), midX + midW, ey, { align: "right" });
          ey += 10;
        });
        if (c.expenseLines.length > 12) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(...MUTED);
          doc.text(`+ ${c.expenseLines.length - 12} outros lançamentos`, midX, ey);
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Sem deduções registradas.", midX, ey);
      }

      // Right column — breakdown totals
      const rightX = pageW - marginX - 14;
      const labelX = pageW - marginX - 220;
      let ry = y + 16;
      const putLine = (label: string, value: number | null, opts: { neg?: boolean; bold?: boolean; rule?: boolean } = {}) => {
        if (opts.rule) {
          doc.setDrawColor(...GOLD);
          doc.setLineWidth(0.3);
          doc.line(labelX, ry - 4, rightX, ry - 4);
        }
        doc.setFont("helvetica", opts.bold ? "bold" : "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...(opts.bold ? NAVY : MUTED));
        doc.text(label, labelX, ry);
        doc.setTextColor(...(opts.bold ? NAVY : GRAPHITE));
        const txt = value == null ? "—" : (opts.neg ? "-" : "") + formatCurrency(Math.abs(value));
        doc.text(txt, rightX, ry, { align: "right" });
        ry += 11;
      };
      putLine("Valor bruto vendido", c.grossRevenue, { bold: true });
      putLine("(-) Materiais / Estoque", c.materials, { neg: true });
      putLine("(-) Juros / Taxa do cartão", c.cardFees ?? null, { neg: true });
      putLine("(-) Taxa da regra", c.ruleFee ?? null, { neg: true });
      putLine("(-) Outros custos operacionais", c.otherCosts, { neg: true });
      putLine("(=) Lucro líquido operacional", c.netProfit, { bold: true, rule: true });
      putLine("Participação do agendista", c.agentShare, { bold: true });
      putLine("Dízimo sugerido (informativo)", c.tithe);

      y += cardHeight + 10;
    }
  }

  /* ---------------- ADIANTAMENTOS ---------------- */
  if (ctx.advances?.length) {
    y = ensureSpace(doc, y, 50, pageH);
    sectionTitle(doc, "ADIANTAMENTOS RECEBIDOS", marginX, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Valor", "Origem", "Palestra", "Observação"]],
      body: ctx.advances.map((a) => [
        formatDate(a.date),
        { content: formatCurrency(a.amount), styles: { halign: "right", textColor: DEBIT_RED } },
        a.source ?? "—",
        a.lecture ?? "—",
        a.notes ?? "",
      ]),
      foot: [[
        { content: "TOTAL", styles: { fontStyle: "bold", textColor: NAVY } },
        { content: formatCurrency(ctx.advances.reduce((s, a) => s + a.amount, 0)),
          styles: { fontStyle: "bold", halign: "right", textColor: NAVY } },
        "", "", "",
      ]],
      styles: { fontSize: 8, cellPadding: 5, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      footStyles: { fillColor: LIGHT_GRAY },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 90, halign: "right" },
        2: { cellWidth: 110 },
        3: { cellWidth: 180 },
      },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  /* ---------------- PAGAMENTOS ---------------- */
  if (ctx.payouts?.length) {
    y = ensureSpace(doc, y, 50, pageH);
    sectionTitle(doc, "PAGAMENTOS REALIZADOS AO AGENDISTA", marginX, y);
    y += 16;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Valor", "Forma", "Descrição"]],
      body: ctx.payouts.map((p) => [
        formatDate(p.date),
        { content: formatCurrency(p.amount), styles: { halign: "right", textColor: DEBIT_RED } },
        p.method ?? "—",
        p.description ?? "",
      ]),
      foot: [[
        { content: "TOTAL", styles: { fontStyle: "bold", textColor: NAVY } },
        { content: formatCurrency(ctx.payouts.reduce((s, p) => s + p.amount, 0)),
          styles: { fontStyle: "bold", halign: "right", textColor: NAVY } },
        "", "",
      ]],
      styles: { fontSize: 8, cellPadding: 5, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      footStyles: { fillColor: LIGHT_GRAY },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 90, halign: "right" },
        2: { cellWidth: 130 },
      },
      margin: { left: marginX, right: marginX },
      theme: "plain",
    });
  }

  /* ---------------- COMPROVANTES POR EMPRESA ---------------- */
  if (ctx.receipts?.length) {
    // Sempre inicia em página nova para facilitar leitura/impressão
    doc.addPage();
    let ry = 46;
    sectionTitle(doc, "COMPROVANTES ANEXADOS", marginX, ry);
    ry += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Notas fiscais, recibos e comprovantes anexados às palestras e adiantamentos do período. Imagens exibidas em tamanho reduzido — arquivos PDF/DOC aparecem como links.",
      marginX, ry + 6,
    );
    ry += 20;

    const thumbW = 150;
    const thumbH = 100;
    const thumbGap = 14;
    const thumbsPerRow = Math.max(1, Math.floor((contentW + thumbGap) / (thumbW + thumbGap)));

    for (const group of ctx.receipts) {
      if (!group.items?.length) continue;

      // Header da empresa
      ry = ensureSpace(doc, ry, 60, pageH);
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(marginX, ry, contentW, 40, 3, 3, "F");
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.6);
      doc.line(marginX, ry + 40, marginX + contentW, ry + 40);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...GOLD);
      doc.text("EMPRESA", marginX + 14, ry + 15, { charSpace: 1.4 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(group.company.toUpperCase(), marginX + 70, ry + 15);

      if (group.lecture) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...GOLD);
        doc.text("PALESTRA", marginX + 14, ry + 32, { charSpace: 1.4 });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...GRAPHITE);
        const lecTxt = group.date ? `${group.lecture} · ${formatDate(group.date)}` : group.lecture;
        doc.text(doc.splitTextToSize(lecTxt, contentW - 240)[0] ?? "", marginX + 70, ry + 32);
      }
      // contador
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text(
        `${group.items.length} ${group.items.length === 1 ? "comprovante" : "comprovantes"}`,
        pageW - marginX - 14, ry + 24, { align: "right" },
      );

      ry += 54;

      // Separa imagens e outros
      const images = group.items.filter((it) => it.dataUrl);
      const others = group.items.filter((it) => !it.dataUrl);

      // Grade de miniaturas
      if (images.length > 0) {
        let col = 0;
        for (const it of images) {
          if (col === 0) {
            ry = ensureSpace(doc, ry, thumbH + 40, pageH);
          }
          const x = marginX + col * (thumbW + thumbGap);
          // Moldura
          doc.setDrawColor(215, 215, 220);
          doc.setLineWidth(0.4);
          doc.roundedRect(x, ry, thumbW, thumbH, 3, 3, "S");
          try {
            const fmt = (it.mimeType ?? "").toLowerCase().includes("png") ? "PNG" : "JPEG";
            doc.addImage(it.dataUrl!, fmt, x + 2, ry + 2, thumbW - 4, thumbH - 4, undefined, "FAST");
          } catch {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text("Falha ao renderizar imagem", x + 8, ry + thumbH / 2);
          }
          // Legenda
          const cap = doc.splitTextToSize(it.fileName, thumbW);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(...NAVY);
          doc.text(cap[0] ?? "", x, ry + thumbH + 12);
          if (it.createdAt) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(...MUTED);
            doc.text(formatDate(it.createdAt), x, ry + thumbH + 22);
          }
          col = (col + 1) % thumbsPerRow;
          if (col === 0) ry += thumbH + 32;
        }
        if (col !== 0) ry += thumbH + 32;
      }

      // Lista de outros arquivos (PDF, DOC, etc.)
      if (others.length > 0) {
        ry = ensureSpace(doc, ry, 30 + others.length * 14, pageH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...NAVY);
        doc.text("OUTROS ARQUIVOS", marginX, ry, { charSpace: 1.4 });
        ry += 12;
        for (const it of others) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...GRAPHITE);
          const line = `• ${it.fileName}${it.mimeType ? ` · ${it.mimeType}` : ""}${it.createdAt ? ` · ${formatDate(it.createdAt)}` : ""}`;
          doc.text(line, marginX, ry);
          if (it.url) {
            doc.setTextColor(...GOLD);
            doc.textWithLink("abrir arquivo →", pageW - marginX, ry, { url: it.url, align: "right" });
          }
          ry += 13;
        }
        ry += 6;
      }

      ry += 10;
    }
  }

  /* ---------------- Watermark + footer on all pages ---------------- */
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
  doc.line(x, y + 4, x + 44, y + 4);
}

function ensureSpace(doc: import("jspdf").jsPDF, y: number, needed: number, pageH: number): number {
  if (y + needed > pageH - 50) {
    doc.addPage();
    return 46;
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
