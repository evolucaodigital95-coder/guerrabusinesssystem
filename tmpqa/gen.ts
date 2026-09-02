const orig = globalThis.fetch;
globalThis.fetch = ((u: any, o: any) => orig(typeof u === "string" && u.startsWith("/") ? "http://localhost:8080" + u : u, o)) as any;

import { buildClosingTermPDF, DEFAULT_THANKS_MESSAGE } from "@/lib/closing-term-export";
import { exportStatementPDF } from "@/lib/agent-statement-export";
import { writeFileSync } from "fs";

const mov = Array.from({ length: 9 }, (_, i) => ({
  date: `2026-0${(i % 8) + 1}-1${i % 9}`, time: "10:00", type: "credito",
  description: `Crédito referente à palestra de treinamento corporativo ${i + 1}`,
  company: "Metalúrgica São Bento Indústria e Comércio Ltda", lecture: "Liderança de Alta Performance",
  credit: i % 3 ? 4500.5 : 0, debit: i % 3 ? 0 : 1200.75, balance: 10000 + i * 900,
}));
const comp = Array.from({ length: 2 }, (_, i) => ({
  company: "Metalúrgica São Bento Indústria e Comércio Ltda", lecture: "Liderança de Alta Performance " + i,
  date: "2026-05-14", grossRevenue: 48000, materials: 6200.35, cardFees: 1830.9, ruleFee: 500,
  fees: 2330.9, otherCosts: 1250, netProfit: 39000, agentShare: 19500, tithe: 1950,
  expenseLines: Array.from({ length: 6 }, (_, k) => ({ label: `Material didático premium linha ${k + 1}`, amount: 320.55 * (k + 1), category: "materials" as const })),
}));

const blob = await buildClosingTermPDF({
  closingNumber: "FEC-2026-0007", version: 2, status: "oficial",
  agentName: "Maria Aparecida de Souza Guerra", organizationName: "Grupo Guerra",
  seasonName: "Temporada 2026 · Sudeste", periodLabel: "01/01/2026 → 30/06/2026",
  closedAtLabel: "02/09/2026", responsible: "diretoria@grupoguerra.com.br",
  totals: { companies: 7, lectures: 12, revenue: 480000, materials: 62000, fees: 18300, expenses: 12500, netProfit: 387200, agentShare: 193600, tithe: 19360, advances: 45000, credits: 193600, debits: 45000, openingBalance: 3200, finalBalance: 151800 },
  movements: mov, lectures: comp.map(c => ({ date: c.date, company: c.company, lecture: c.lecture, revenue: c.grossRevenue, materials: c.materials, fees: c.fees, netProfit: c.netProfit, agentShare: c.agentShare })),
  advances: [{ date: "2026-03-02", amount: 15000, source: "pix", lecture: "Liderança", notes: "Adiantamento acordado" }],
  externalDocs: [{ title: "Extrato Julho", kind: "Extrato", date: "2026-07-31" }],
  notes: null, thanksMessage: DEFAULT_THANKS_MESSAGE,
});
writeFileSync("/tmp/qa/termo.pdf", Buffer.from(await blob.arrayBuffer()));

const b2 = await exportStatementPDF({
  agentName: "Maria Aparecida de Souza Guerra", teamName: null, periodLabel: "01/01/2026 → 30/06/2026",
  emittedAt: "02/09/2026 10:00", documentId: "GBS-20260902-MAR",
  openingBalance: 3200, totalCredits: 193600, totalDebits: 45000, closingBalance: 151800,
  titheAccumulated: 19360, movements: mov, companySummary: [{ company: "Metalúrgica São Bento", amount: 193600 }],
  creditsComposition: comp, advances: [], payouts: [],
} as any, { output: "blob" }) as Blob;
writeFileSync("/tmp/qa/extrato.pdf", Buffer.from(await b2.arrayBuffer()));
console.log("ok");
