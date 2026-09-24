import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { rgbToHex, type DocBrand } from "@/lib/doc-brand";

export type ReportColumn<T> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (row: T) => string;
};

function cellValue<T>(row: T, col: ReportColumn<T>): string {
  if (col.format) return col.format(row);
  const v = (row as Record<string, unknown>)[col.key as string];
  if (v === null || v === undefined) return "";
  return String(v);
}

function fileStem(name: string) {
  const d = new Date().toISOString().slice(0, 10);
  return `${name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${d}`;
}

export function exportCSV<T>(name: string, cols: ReportColumn<T>[], rows: T[]) {
  const header = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const body = rows
    .map((r) => cols.map((c) => `"${cellValue(r, c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${fileStem(name)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportXLSX<T>(name: string, cols: ReportColumn<T>[], rows: T[]) {
  const data = [
    cols.map((c) => c.label),
    ...rows.map((r) => cols.map((c) => cellValue(r, c))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 28) || "Relatorio");
  XLSX.writeFile(wb, `${fileStem(name)}.xlsx`);
}

export function exportPDF<T>(
  name: string,
  cols: ReportColumn<T>[],
  rows: T[],
  subtitle?: string,
  brand?: DocBrand,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const custom = brand && !brand.isDefault;
  const gold = custom ? rgbToHex(brand.accent) : "#B8892A";
  const navy = custom ? rgbToHex(brand.primary) : "#0B1B3F";
  const brandName = brand
    ? brand.name.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ")
    : "Grupo Guerra";

  doc.setFillColor(navy);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold").setFontSize(16).text(custom ? `${brandName} · GBS` : "GBS · Guerra Business System", 40, 28);
  doc.setFont("helvetica", "normal").setFontSize(11).text(name, 40, 46);
  doc.setFontSize(9).setTextColor("#D9C79A")
    .text(new Date().toLocaleString("pt-BR"), doc.internal.pageSize.getWidth() - 40, 46, { align: "right" });

  if (subtitle) {
    doc.setTextColor("#333").setFontSize(10).text(subtitle, 40, 84);
  }

  autoTable(doc, {
    startY: subtitle ? 100 : 84,
    head: [cols.map((c) => c.label)],
    body: rows.map((r) => cols.map((c) => cellValue(r, c))),
    styles: { fontSize: 8, cellPadding: 4, textColor: "#111" },
    headStyles: { fillColor: gold, textColor: "#FFFFFF", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#F7F5EE" },
    margin: { left: 40, right: 40 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor("#888")
      .text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() - 40,
        doc.internal.pageSize.getHeight() - 20, { align: "right" });
    doc.text(`${brandName} — Confidencial`, 40, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`${fileStem(name)}.pdf`);
}
