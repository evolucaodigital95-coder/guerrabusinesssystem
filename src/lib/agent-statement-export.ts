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

export type ExportContext = {
  agentName: string;
  periodLabel: string;
  emittedAt: string;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  titheAccumulated: number;
  movements: ExportMovement[];
};

const HEADERS = ["Data", "Hora", "Tipo", "Descrição", "Empresa", "Palestra", "Crédito", "Débito", "Saldo"];

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
  return name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "extrato";
}

export function exportStatementCSV(ctx: ExportContext) {
  const meta = [
    ["GBS — Extrato da Conta Corrente do Agendista"],
    ["Agendista", ctx.agentName],
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
  XLSX.writeFile(wb, `${safeFileBase(ctx.agentName)}-extrato.xlsx`);
}

export async function exportStatementPDF(ctx: ExportContext) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;
  let y = 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("GBS — Guerra Business System", marginX, y);
  y += 16;
  doc.setFontSize(11);
  doc.text("Extrato da Conta Corrente do Agendista", marginX, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summary: [string, string][] = [
    ["Agendista", ctx.agentName],
    ["Período", ctx.periodLabel],
    ["Emissão", ctx.emittedAt],
    ["Saldo inicial do período", formatCurrency(ctx.openingBalance)],
    ["Créditos do período", formatCurrency(ctx.totalCredits)],
    ["Débitos do período", formatCurrency(ctx.totalDebits)],
    ["Saldo final do período", formatCurrency(ctx.closingBalance)],
    ["Dízimo sugerido acumulado (informativo)", formatCurrency(ctx.titheAccumulated)],
  ];
  summary.forEach(([k, v]) => {
    doc.setTextColor(120);
    doc.text(`${k}:`, marginX, y);
    doc.setTextColor(20);
    doc.text(v, marginX + 200, y);
    y += 14;
  });
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [HEADERS],
    body: ctx.movements.map(rowValues),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [26, 34, 51], textColor: 255 },
    columnStyles: {
      6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" },
    },
    margin: { left: marginX, right: marginX },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Powered by Grupo Guerra · Página ${i} de ${pageCount}`, marginX, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`${safeFileBase(ctx.agentName)}-extrato.pdf`);
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
