/**
 * Exportação executiva do Centro Financeiro do Palestrante.
 * Reaproveita a identidade visual navy/gold do extrato do agendista.
 */
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/lib/crm";
import grupoGuerraLogo from "@/assets/grupo-guerra-logo.png.asset.json";

const NAVY: [number, number, number] = [15, 39, 71];
const GOLD: [number, number, number] = [200, 164, 90];
const GRAPHITE: [number, number, number] = [47, 47, 47];
const LIGHT_GRAY: [number, number, number] = [244, 245, 247];
const MUTED: [number, number, number] = [130, 130, 138];

let __logoDataUrlPromise: Promise<string | null> | null = null;
function loadLogoDataUrl(): Promise<string | null> {
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

export type SpeakerKPIs = {
  saldoAtual: number;
  aReceber: number;
  recebido: number;
  adiantamentosAbertos: number;
  lucroMes: number;
  lucroAno: number;
  receitaBruta: number;
  custosTotais: number;
  margem: number; // 0..1
  dizimoSugerido: number;
  totalEmpresas: number;
  totalPalestras: number;
  pessoasImpactadas: number;
};

export type SpeakerStatementRow = {
  date: string | null;
  company: string;
  lecture: string;
  gross: number;
  materials: number;
  cardFees: number;
  otherCosts: number;
  netProfit: number;
  speakerShare: number;
  tithe: number;
  balance: number;
};

export type ByCompanyRow = {
  company: string;
  lectures: number;
  gross: number;
  netProfit: number;
  speakerShare: number;
  agentShare: number;
  audience: number;
  margin: number; // 0..1
};
export type ByAgentRow = {
  agent: string;
  lectures: number;
  gross: number;
  netProfit: number;
  agentShare: number;
  avgTicket: number;
  audience: number;
};
export type ByCityRow = { city: string; lectures: number; gross: number; netProfit: number; audience: number };
export type BySeasonRow = { season: string; gross: number; netProfit: number; lectures: number; companies: number; audience: number };

export type SpeakerReportContext = {
  speakerName: string;
  periodLabel: string;
  emittedAt: string;
  kpis: SpeakerKPIs;
  statement: SpeakerStatementRow[];
  byCompany: ByCompanyRow[];
  byAgent: ByAgentRow[];
  byCity: ByCityRow[];
  bySeason: BySeasonRow[];
  filters?: { label: string; value: string }[];
};

function fileStem(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/gi, "-") + "-" + new Date().toISOString().slice(0, 10);
}

/* ============================================================ CSV */
export function exportSpeakerCSV(ctx: SpeakerReportContext) {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Data", "Empresa", "Palestra", "Valor Vendido", "Materiais", "Juros/Taxas", "Outros Custos", "Lucro Líquido", "Parte Palestrante", "Dízimo", "Saldo Acumulado"];
  const lines = [
    ["Centro Financeiro do Palestrante — Grupo Guerra"],
    ["Palestrante", ctx.speakerName],
    ["Período", ctx.periodLabel],
    ["Emissão", ctx.emittedAt],
    [],
    header,
    ...ctx.statement.map((r) => [
      formatDate(r.date), r.company, r.lecture,
      formatCurrency(r.gross), formatCurrency(r.materials), formatCurrency(r.cardFees),
      formatCurrency(r.otherCosts), formatCurrency(r.netProfit),
      formatCurrency(r.speakerShare), formatCurrency(r.tithe), formatCurrency(r.balance),
    ]),
  ].map((row) => row.map(escape).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${fileStem("centro-palestrante")}.csv`);
}

/* ============================================================ XLSX */
export function exportSpeakerXLSX(ctx: SpeakerReportContext) {
  const wb = XLSX.utils.book_new();

  const kpiRows: (string | number)[][] = [
    ["Centro Financeiro do Palestrante"],
    ["Palestrante", ctx.speakerName],
    ["Período", ctx.periodLabel],
    ["Emissão", ctx.emittedAt],
    [],
    ["Indicador", "Valor"],
    ["Saldo Atual", ctx.kpis.saldoAtual],
    ["A Receber", ctx.kpis.aReceber],
    ["Pagamentos Recebidos", ctx.kpis.recebido],
    ["Adiantamentos Abertos", ctx.kpis.adiantamentosAbertos],
    ["Lucro Líquido — Mês", ctx.kpis.lucroMes],
    ["Lucro Líquido — Ano", ctx.kpis.lucroAno],
    ["Receita Bruta", ctx.kpis.receitaBruta],
    ["Custos Totais", ctx.kpis.custosTotais],
    ["Margem de Lucro", ctx.kpis.margem],
    ["Dízimo Sugerido", ctx.kpis.dizimoSugerido],
    ["Empresas Atendidas", ctx.kpis.totalEmpresas],
    ["Total de Palestras", ctx.kpis.totalPalestras],
    ["Pessoas Impactadas", ctx.kpis.pessoasImpactadas],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), "Indicadores");

  const ext = [
    ["Data", "Empresa", "Palestra", "Bruto", "Materiais", "Juros/Taxas", "Outros Custos", "Lucro", "Palestrante", "Dízimo", "Saldo"],
    ...ctx.statement.map((r) => [formatDate(r.date), r.company, r.lecture, r.gross, r.materials, r.cardFees, r.otherCosts, r.netProfit, r.speakerShare, r.tithe, r.balance]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ext), "Extrato");

  const co = [["Empresa", "Palestras", "Receita", "Lucro", "Palestrante", "Agendista", "Público", "Margem"],
    ...ctx.byCompany.map((r) => [r.company, r.lectures, r.gross, r.netProfit, r.speakerShare, r.agentShare, r.audience, r.margin])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(co), "Por Empresa");

  const ag = [["Agendista", "Palestras", "Receita", "Lucro", "Participação", "Ticket Médio", "Público"],
    ...ctx.byAgent.map((r) => [r.agent, r.lectures, r.gross, r.netProfit, r.agentShare, r.avgTicket, r.audience])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ag), "Por Agendista");

  const ci = [["Cidade", "Palestras", "Receita", "Lucro", "Público"],
    ...ctx.byCity.map((r) => [r.city, r.lectures, r.gross, r.netProfit, r.audience])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ci), "Por Cidade");

  const se = [["Temporada", "Receita", "Lucro", "Palestras", "Empresas", "Público"],
    ...ctx.bySeason.map((r) => [r.season, r.gross, r.netProfit, r.lectures, r.companies, r.audience])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(se), "Por Temporada");

  XLSX.writeFile(wb, `${fileStem("centro-palestrante")}.xlsx`);
}

/* ============================================================ PDF Premium */
export async function exportSpeakerPDF(ctx: SpeakerReportContext) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;
  const documentId = `GBS-CFP-${Date.now().toString(36).toUpperCase()}`;

  const logo = await loadLogoDataUrl();

  const drawWatermark = () => {
    doc.saveGraphicsState();
    // @ts-expect-error gState typing
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    if (logo) {
      try { doc.addImage(logo, "PNG", (pageW - 260) / 2, (pageH - 260) / 2, 260, 260, undefined, "FAST"); } catch { /* noop */ }
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(110); doc.setTextColor(...NAVY);
      doc.text("GRUPO GUERRA", pageW / 2, pageH / 2 + 30, { align: "center", angle: 22 });
    }
    doc.restoreGraphicsState();
  };
  const drawFooter = (n: number, tot: number) => {
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.6);
    doc.line(marginX, pageH - 36, pageW - marginX, pageH - 36);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text("Centro Financeiro do Palestrante — Grupo Guerra", marginX, pageH - 22);
    doc.text("Documento executivo confidencial", pageW / 2, pageH - 22, { align: "center" });
    doc.text(`Página ${n} de ${tot}`, pageW - marginX, pageH - 22, { align: "right" });
    doc.setFontSize(7); doc.text(`Doc. ${documentId}`, pageW - marginX, pageH - 12, { align: "right" });
  };
  const section = (title: string, y: number) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(title, marginX, y, { charSpace: 1.8 });
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.6);
    doc.line(marginX, y + 4, marginX + 44, y + 4);
  };
  const ensure = (y: number, need: number) => (y + need > pageH - 50 ? (doc.addPage(), 46) : y);

  /* Header */
  let y = 46;
  if (logo) { try { doc.addImage(logo, "PNG", marginX, y - 8, 42, 42, undefined, "FAST"); } catch { /* noop */ } }
  const bx = marginX + 54;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text("GRUPO GUERRA", bx, y + 8, { charSpace: 1 });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text("CENTRO FINANCEIRO DO PALESTRANTE · GBS", bx, y + 22, { charSpace: 1.4 });

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
  doc.text("RELATÓRIO EXECUTIVO", pageW - marginX, y + 2, { align: "right", charSpace: 1.6 });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text("Painel do palestrante", pageW - marginX, y + 14, { align: "right", charSpace: 1.4 });

  y += 30; doc.setDrawColor(...GOLD); doc.setLineWidth(0.8); doc.line(marginX, y, pageW - marginX, y); y += 22;

  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...NAVY);
  doc.text(ctx.speakerName.toUpperCase(), marginX, y);
  y += 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text("PAINEL EXECUTIVO FINANCEIRO", marginX, y + 6, { charSpace: 1.6 });
  y += 20;

  const meta: [string, string][] = [
    ["Período", ctx.periodLabel],
    ["Emitido em", ctx.emittedAt],
    ["Documento", documentId],
    ["Palestras no período", String(ctx.kpis.totalPalestras)],
  ];
  meta.forEach(([k, v], i) => {
    const col = i < 2 ? marginX : marginX + 380;
    const ly = y + (i % 2) * 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(k.toUpperCase(), col, ly, { charSpace: 1.4 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GRAPHITE);
    doc.text(v, col + 90, ly);
  });
  y += 40;

  /* KPI cards */
  const kpis: { label: string; value: string; highlight?: boolean }[] = [
    { label: "SALDO ATUAL", value: formatCurrency(ctx.kpis.saldoAtual), highlight: true },
    { label: "A RECEBER", value: formatCurrency(ctx.kpis.aReceber) },
    { label: "RECEBIDO", value: formatCurrency(ctx.kpis.recebido) },
    { label: "ADIANTAMENTOS", value: formatCurrency(ctx.kpis.adiantamentosAbertos) },
    { label: "LUCRO — MÊS", value: formatCurrency(ctx.kpis.lucroMes) },
    { label: "LUCRO — ANO", value: formatCurrency(ctx.kpis.lucroAno) },
    { label: "RECEITA BRUTA", value: formatCurrency(ctx.kpis.receitaBruta) },
    { label: "MARGEM", value: `${(ctx.kpis.margem * 100).toFixed(1)}%` },
  ];
  const gap = 8;
  const cardW = (contentW - gap * 3) / 4;
  const cardH = 52;
  kpis.forEach((c, i) => {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const cx = marginX + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    if (c.highlight) {
      doc.setFillColor(...NAVY);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...GOLD);
      doc.text(c.label, cx + 10, cy + 14, { charSpace: 1.4 });
      doc.setFontSize(13); doc.setTextColor(255, 255, 255);
      doc.text(c.value, cx + 10, cy + 36);
    } else {
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(c.label, cx + 10, cy + 14, { charSpace: 1.4 });
      doc.setFontSize(11); doc.setTextColor(...NAVY);
      doc.text(c.value, cx + 10, cy + 36);
    }
  });
  y += 2 * (cardH + gap) + 10;

  /* Empresas */
  if (ctx.byCompany.length) {
    y = ensure(y, 60); section("RESULTADO POR EMPRESA", y); y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Empresa", "Palestras", "Receita", "Lucro", "Palestrante", "Agendista", "Público", "Margem"]],
      body: ctx.byCompany.map((r) => [
        r.company, r.lectures, formatCurrency(r.gross), formatCurrency(r.netProfit),
        formatCurrency(r.speakerShare), formatCurrency(r.agentShare), r.audience,
        `${(r.margin * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
      margin: { left: marginX, right: marginX }, theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  /* Agendistas */
  if (ctx.byAgent.length) {
    y = ensure(y, 60); section("RESULTADO POR AGENDISTA", y); y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Agendista", "Palestras", "Receita", "Lucro", "Participação", "Ticket Médio", "Público"]],
      body: ctx.byAgent.map((r) => [r.agent, r.lectures, formatCurrency(r.gross), formatCurrency(r.netProfit), formatCurrency(r.agentShare), formatCurrency(r.avgTicket), r.audience]),
      styles: { fontSize: 8, cellPadding: 4, lineColor: [230, 230, 235], lineWidth: 0.25 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: marginX, right: marginX }, theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  /* Cidade + Temporada */
  if (ctx.byCity.length) {
    y = ensure(y, 60); section("RESULTADO POR CIDADE", y); y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Cidade", "Palestras", "Receita", "Lucro", "Público"]],
      body: ctx.byCity.map((r) => [r.city, r.lectures, formatCurrency(r.gross), formatCurrency(r.netProfit), r.audience]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: marginX, right: marginX }, theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }
  if (ctx.bySeason.length) {
    y = ensure(y, 60); section("RESULTADO POR TEMPORADA", y); y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Temporada", "Receita", "Lucro", "Palestras", "Empresas", "Público"]],
      body: ctx.bySeason.map((r) => [r.season, formatCurrency(r.gross), formatCurrency(r.netProfit), r.lectures, r.companies, r.audience]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      margin: { left: marginX, right: marginX }, theme: "plain",
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  /* Extrato */
  if (ctx.statement.length) {
    doc.addPage(); y = 46;
    section("EXTRATO FINANCEIRO — PALESTRA A PALESTRA", y); y += 14;
    autoTable(doc, {
      startY: y,
      head: [["Data", "Empresa", "Palestra", "Bruto", "Materiais", "Juros/Taxa", "Custos", "Lucro", "Palestrante", "Dízimo", "Saldo"]],
      body: ctx.statement.map((r) => [
        formatDate(r.date), r.company, r.lecture,
        formatCurrency(r.gross), formatCurrency(r.materials), formatCurrency(r.cardFees),
        formatCurrency(r.otherCosts), formatCurrency(r.netProfit),
        formatCurrency(r.speakerShare), formatCurrency(r.tithe), formatCurrency(r.balance),
      ]),
      styles: { fontSize: 7, cellPadding: 3, lineColor: [230, 230, 235], lineWidth: 0.25, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: LIGHT_GRAY },
      columnStyles: {
        0: { cellWidth: 52 }, 1: { cellWidth: 100 }, 2: { cellWidth: 110 },
        3: { cellWidth: 60, halign: "right" }, 4: { cellWidth: 55, halign: "right" },
        5: { cellWidth: 55, halign: "right" }, 6: { cellWidth: 55, halign: "right" },
        7: { cellWidth: 60, halign: "right" }, 8: { cellWidth: 65, halign: "right" },
        9: { cellWidth: 50, halign: "right" }, 10: { cellWidth: 65, halign: "right", fontStyle: "bold" },
      },
      margin: { left: marginX, right: marginX }, theme: "plain",
      showHead: "everyPage",
    });
  }

  /* Watermark + footer */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawWatermark();
    drawFooter(i, total);
  }
  doc.save(`${fileStem("centro-palestrante")}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
