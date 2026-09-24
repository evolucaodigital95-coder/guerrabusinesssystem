import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { rgbToHex, type DocBrand } from "@/lib/doc-brand";
import type {
  SupplierAggregate, BookConsumption, CompanyConsumption, Settlement,
} from "@/lib/supplier-accounts";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

function stamp(name: string) {
  const d = new Date().toISOString().slice(0, 10);
  return `${name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${d}`;
}

export type SupplierReport = {
  supplier: string;
  seasonName: string;
  aggregate: SupplierAggregate;
  books: BookConsumption[];
  companies: CompanyConsumption[];
  settlements: Array<Settlement & { userName?: string | null }>;
  /** Identidade visual da organização ativa (apresentação apenas). */
  brand?: DocBrand;
};

const titleCase = (v: string) =>
  v.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");

export function exportSupplierPDF(report: SupplierReport) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const brand = report.brand;
  const navy = brand && !brand.isDefault ? rgbToHex(brand.primary) : "#0B1B3F";
  const gold = brand && !brand.isDefault ? rgbToHex(brand.accent) : "#B8892A";
  const brandName = brand ? titleCase(brand.name) : "Grupo Guerra";
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(navy);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold").setFontSize(16).text(brand && !brand.isDefault ? `${brandName} · GBS` : "GBS · Guerra Business System", 40, 34);
  doc.setFont("helvetica", "normal").setFontSize(11).text("Prestação de Contas do Fornecedor", 40, 54);
  doc.setFontSize(9).setTextColor("#D9C79A")
    .text(new Date().toLocaleString("pt-BR"), W - 40, 34, { align: "right" });
  doc.setFontSize(10).setTextColor("#FFFFFF")
    .text(`Fornecedor: ${report.supplier}`, 40, 76)
    .text(`Temporada: ${report.seasonName}`, W - 40, 76, { align: "right" });

  // Resumo
  const a = report.aggregate;
  const summary = [
    ["Valor Comprado", BRL.format(a.purchased)],
    ["Valor Utilizado", BRL.format(a.used)],
    ["Valor Já Pago", BRL.format(a.settled)],
    ["Saldo a Acertar", BRL.format(a.balance)],
  ];
  autoTable(doc, {
    startY: 116,
    head: [["Resumo Executivo", "Valor"]],
    body: summary,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: gold, textColor: "#FFFFFF" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });

  const cur = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

  // Livros
  autoTable(doc, {
    startY: cur.finalY + 18,
    head: [["Livro / Material", "Qtd", "Custo Unit.", "Total"]],
    body: report.books.map((b) => [
      b.name,
      `${NUM.format(b.quantity)}${b.unit ? " " + b.unit : ""}`,
      BRL.format(b.avgUnitCost),
      BRL.format(b.totalValue),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: navy, textColor: "#FFFFFF" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(10).setTextColor(navy).setFont("helvetica", "bold")
        .text("Detalhamento por Livro", 40, cur.finalY + 12);
    },
  });

  const cur2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

  // Empresas
  autoTable(doc, {
    startY: cur2.finalY + 18,
    head: [["Empresa", "Valor Consumido"]],
    body: report.companies.map((c) => [c.companyName, BRL.format(c.totalValue)]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: navy, textColor: "#FFFFFF" },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(10).setTextColor(navy).setFont("helvetica", "bold")
        .text("Detalhamento por Empresa", 40, cur2.finalY + 12);
    },
  });

  const cur3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;

  // Histórico de acertos
  autoTable(doc, {
    startY: cur3.finalY + 18,
    head: [["Data", "Valor Pago", "Forma", "Comprovante", "Observação"]],
    body: report.settlements.map((s) => [
      new Date(s.paid_on + "T00:00:00").toLocaleDateString("pt-BR"),
      BRL.format(Number(s.amount_paid)),
      s.payment_method ?? "—",
      s.receipt_number ?? "—",
      s.notes ?? "—",
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: navy, textColor: "#FFFFFF" },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(10).setTextColor(navy).setFont("helvetica", "bold")
        .text("Histórico dos Acertos", 40, cur3.finalY + 12);
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8).setTextColor("#888")
      .text(`${brandName} — Documento confidencial`, 40, H - 20)
      .text(`Página ${i} de ${pages}`, W - 40, H - 20, { align: "right" });
  }

  doc.save(`${stamp(`prestacao-${report.supplier}`)}.pdf`);
}

export function exportSupplierXLSX(report: SupplierReport) {
  const wb = XLSX.utils.book_new();
  const a = report.aggregate;
  const resumo = [
    ["Fornecedor", report.supplier],
    ["Temporada", report.seasonName],
    [],
    ["Valor Comprado", a.purchased],
    ["Valor Utilizado", a.used],
    ["Capital em Estoque", a.inStock],
    ["Valor Já Pago", a.settled],
    ["Saldo a Acertar", a.balance],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Livro", "Quantidade", "Unidade", "Custo Unitário", "Total"],
      ...report.books.map((b) => [b.name, b.quantity, b.unit ?? "", b.avgUnitCost, b.totalValue]),
    ]),
    "Livros",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Empresa", "Valor Consumido"],
      ...report.companies.map((c) => [c.companyName, c.totalValue]),
    ]),
    "Empresas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Data", "Valor Pago", "Forma", "Comprovante", "Observação"],
      ...report.settlements.map((s) => [s.paid_on, Number(s.amount_paid), s.payment_method ?? "", s.receipt_number ?? "", s.notes ?? ""]),
    ]),
    "Acertos",
  );

  XLSX.writeFile(wb, `${stamp(`prestacao-${report.supplier}`)}.xlsx`);
}

export function exportSupplierCSV(report: SupplierReport) {
  const lines: string[] = [];
  const push = (arr: (string | number)[]) =>
    lines.push(arr.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  push(["Fornecedor", report.supplier]);
  push(["Temporada", report.seasonName]);
  push([]);
  push(["Valor Comprado", report.aggregate.purchased]);
  push(["Valor Utilizado", report.aggregate.used]);
  push(["Valor Pago", report.aggregate.settled]);
  push(["Saldo", report.aggregate.balance]);
  push([]);
  push(["LIVROS"]);
  push(["Livro", "Quantidade", "Custo Unitario", "Total"]);
  report.books.forEach((b) => push([b.name, b.quantity, b.avgUnitCost, b.totalValue]));
  push([]);
  push(["EMPRESAS"]);
  push(["Empresa", "Valor Consumido"]);
  report.companies.forEach((c) => push([c.companyName, c.totalValue]));
  push([]);
  push(["ACERTOS"]);
  push(["Data", "Valor", "Forma", "Comprovante", "Observacao"]);
  report.settlements.forEach((s) =>
    push([s.paid_on, Number(s.amount_paid), s.payment_method ?? "", s.receipt_number ?? "", s.notes ?? ""]),
  );
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${stamp(`prestacao-${report.supplier}`)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
