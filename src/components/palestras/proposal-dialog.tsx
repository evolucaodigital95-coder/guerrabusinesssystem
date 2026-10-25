import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDocBrand } from "@/hooks/use-doc-brand";
import { buildProposalPDF, proposalFileName } from "@/lib/proposal-export";

const DEFAULTS_KEY = (org: string) => `gbs-proposta-padrao-${org}`;
const DEFAULT_TERMS =
  "50% na confirmação da data e 50% no dia do evento, via PIX ou transferência.";
const DEFAULT_INCLUDES = [
  "Palestra de até 90 minutos, com interação e perguntas do público",
  "Alinhamento prévio com a equipe do contratante",
  "Material de apoio digital para os participantes",
].join("\n");

export type ProposalLecture = {
  id: string;
  title: string;
  theme: string | null;
  scheduled_at: string | null;
  city: string | null;
  state: string | null;
  location: string | null;
  expected_audience: number | null;
  gross_revenue: number | null;
  company: string | null;
  contact: string | null;
};

/** Gera a proposta comercial da palestra em PDF, pronta para enviar ao contratante. */
export function ProposalDialog({
  open,
  onOpenChange,
  lecture,
  organizationId,
  speakerName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lecture: ProposalLecture;
  organizationId: string;
  speakerName: string;
}) {
  const getBrand = useDocBrand();
  const [f, setF] = useState({
    client: "",
    contact: "",
    title: "",
    theme: "",
    dateLabel: "",
    location: "",
    audience: "",
    duration: "90 minutos",
    investment: "",
    paymentTerms: DEFAULT_TERMS,
    includes: DEFAULT_INCLUDES,
    validityDays: "15",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let saved: Partial<typeof f> = {};
    try {
      saved = JSON.parse(localStorage.getItem(DEFAULTS_KEY(organizationId)) ?? "{}");
    } catch {
      /* sem padrão salvo */
    }
    setF({
      client: lecture.company ?? "",
      contact: lecture.contact ?? "",
      title: lecture.title,
      theme: lecture.theme ?? "",
      dateLabel: lecture.scheduled_at
        ? new Date(lecture.scheduled_at).toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "A definir",
      location: [lecture.location, [lecture.city, lecture.state].filter(Boolean).join(" / ")]
        .filter(Boolean)
        .join(" · "),
      audience: lecture.expected_audience ? String(lecture.expected_audience) : "",
      duration: saved.duration ?? "90 minutos",
      investment: lecture.gross_revenue ? String(lecture.gross_revenue) : "",
      paymentTerms: saved.paymentTerms ?? DEFAULT_TERMS,
      includes: saved.includes ?? DEFAULT_INCLUDES,
      validityDays: saved.validityDays ?? "15",
      notes: "",
    });
  }, [open, lecture, organizationId]);

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function generate() {
    const raw = f.investment.trim();
    const investment = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
    if (!f.client.trim()) return toast.error("Informe o contratante.");
    if (!(investment > 0)) return toast.error("Informe o valor do investimento.");
    setBusy(true);
    try {
      const d = new Date();
      const number = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${lecture.id.slice(0, 4).toUpperCase()}`;
      const data = {
        number,
        client: f.client.trim(),
        contact: f.contact.trim() || null,
        title: f.title.trim() || lecture.title,
        theme: f.theme.trim() || null,
        dateLabel: f.dateLabel.charAt(0).toUpperCase() + f.dateLabel.slice(1),
        location: f.location.trim(),
        audience: f.audience ? Number(f.audience) : null,
        duration: f.duration.trim() || "A combinar",
        investment,
        paymentTerms: f.paymentTerms.trim(),
        includes: f.includes
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        validityDays: Math.max(1, Number(f.validityDays) || 15),
        notes: f.notes.trim() || null,
        speakerName,
        brand: await getBrand(),
      };
      const blob = await buildProposalPDF(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = proposalFileName(data);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      try {
        localStorage.setItem(
          DEFAULTS_KEY(organizationId),
          JSON.stringify({
            duration: f.duration,
            paymentTerms: f.paymentTerms,
            includes: f.includes,
            validityDays: f.validityDays,
          }),
        );
      } catch {
        /* padrão não salvo */
      }
      toast.success("Proposta gerada.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a proposta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <FileText className="h-5 w-5 text-clay" /> Proposta comercial
          </DialogTitle>
          <DialogDescription>
            Revise e gere o PDF. Condições, itens inclusos e validade ficam salvos como padrão para
            as próximas propostas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Contratante" value={f.client} onChange={(v) => set("client", v)} />
          <Field label="Aos cuidados de" value={f.contact} onChange={(v) => set("contact", v)} />
          <div className="md:col-span-2">
            <Field label="Título da palestra" value={f.title} onChange={(v) => set("title", v)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Sobre a palestra</Label>
            <Textarea rows={3} value={f.theme} onChange={(e) => set("theme", e.target.value)} />
          </div>
          <Field label="Data" value={f.dateLabel} onChange={(v) => set("dateLabel", v)} />
          <Field label="Local" value={f.location} onChange={(v) => set("location", v)} />
          <Field
            label="Público estimado"
            value={f.audience}
            onChange={(v) => set("audience", v)}
            inputMode="numeric"
          />
          <Field label="Duração" value={f.duration} onChange={(v) => set("duration", v)} />
          <Field
            label="Investimento (R$)"
            value={f.investment}
            onChange={(v) => set("investment", v)}
            inputMode="decimal"
          />
          <Field
            label="Validade (dias)"
            value={f.validityDays}
            onChange={(v) => set("validityDays", v)}
            inputMode="numeric"
          />
          <div className="space-y-1.5 md:col-span-2">
            <Label>Condições de pagamento</Label>
            <Textarea
              rows={2}
              value={f.paymentTerms}
              onChange={(e) => set("paymentTerms", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>O que está incluso (um item por linha)</Label>
            <Textarea
              rows={4}
              value={f.includes}
              onChange={(e) => set("includes", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" onClick={generate} disabled={busy}>
            <FileText /> {busy ? "Gerando…" : "Gerar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} inputMode={inputMode} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
