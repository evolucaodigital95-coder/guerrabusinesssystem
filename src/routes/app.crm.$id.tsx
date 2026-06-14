import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Globe, Instagram, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  formatCurrency, formatDate, LEAD_STATUS, OPPORTUNITY_STATUS, TIMELINE_KINDS, timelineKindLabel,
} from "@/lib/crm";
import { StagePipeline } from "@/components/crm/stage-pipeline";
import { CompanyFormDialog } from "@/components/crm/company-form-dialog";
import { TagsBar } from "@/components/crm/tags-bar";
import { AttachmentsTab } from "@/components/crm/attachments-tab";
import { useOrgMembers } from "@/hooks/use-org-members";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/crm/$id")({
  head: () => ({
    meta: [{ title: "Empresa — GBS" }],
  }),
  component: CompanyDetailPage,
});

function CompanyDetailPage() {
  const { id } = useParams({ from: "/app/crm/$id" });
  const navigate = useNavigate();
  const { user } = useSession();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const company = useQuery({
    queryKey: ["company", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!company.data) return;
      const { error } = await supabase.from("companies")
        .update({ is_favorite: !company.data.is_favorite }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company", id] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies")
        .update({ archived_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa arquivada");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      navigate({ to: "/app/crm" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (company.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!company.data) {
    return (
      <div className="space-y-4">
        <Link to="/app/crm" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para CRM
        </Link>
        <p className="text-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  const c = company.data;

  return (
    <div className="space-y-10">
      <div>
        <Link to="/app/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-3 w-3" /> CRM
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Empresa</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground">{c.legal_name}</h1>
            {c.trade_name && <p className="mt-1 text-sm text-muted-foreground">{c.trade_name}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {c.document && <span>CNPJ {c.document}</span>}
              {c.segment && <Badge variant="outline" className="font-normal">{c.segment}</Badge>}
              {c.status && <Badge variant="secondary" className="font-normal">{c.status}</Badge>}
              {(c.city || c.state) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" /> {[c.city, c.state].filter(Boolean).join(" / ")}
                </span>
              )}
              {c.website && (
                <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Globe className="h-3 w-3" /> {c.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {c.instagram && (
                <span className="inline-flex items-center gap-1.5">
                  <Instagram className="h-3 w-3" /> {c.instagram}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => toggleFavorite.mutate()}>
              <Star className={cn("mr-1.5 h-4 w-4", c.is_favorite && "fill-[var(--gold)] text-[var(--gold)]")} />
              {c.is_favorite ? "Favorita" : "Favoritar"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => {
                if (confirm("Arquivar esta empresa?")) remove.mutate();
              }}
              className="text-muted-foreground"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Arquivar
            </Button>
          </div>
        </div>
      </div>

      <StagePipeline stage={c.lifecycle_stage} />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/40">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="notes">Notas</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview company={c} />
        </TabsContent>
        <TabsContent value="contacts">
          {organizationId && user && <ContactsTab companyId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="leads">
          {organizationId && user && <LeadsTab companyId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="opportunities">
          {organizationId && user && <OpportunitiesTab companyId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="notes">
          {organizationId && user && <NotesTab companyId={id} organizationId={organizationId} userId={user.id} />}
        </TabsContent>
        <TabsContent value="attachments">
          <EmptyTab
            icon={<Building2 className="h-7 w-7 text-muted-foreground" />}
            title="Anexos em breve"
            description="O módulo de arquivos será habilitado quando o armazenamento for ativado."
          />
        </TabsContent>
        <TabsContent value="timeline">
          {organizationId && <TimelineTab companyId={id} organizationId={organizationId} company={c} />}
        </TabsContent>
      </Tabs>

      {organizationId && user && (
        <CompanyFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          organizationId={organizationId}
          userId={user.id}
          initial={c}
        />
      )}
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ company }: { company: Record<string, unknown> }) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Razão social", company.legal_name as string],
    ["Nome fantasia", company.trade_name as string],
    ["CNPJ", company.document as string],
    ["Segmento", company.segment as string],
    ["Funcionários", company.employees_count != null ? String(company.employees_count) : null],
    ["Status", company.status as string],
    ["Endereço", company.address as string],
    ["Cidade / UF", [company.city, company.state].filter(Boolean).join(" / ") || null],
    ["CEP", company.zip as string],
    ["Site", company.website as string],
    ["Instagram", company.instagram as string],
    ["Cadastro", formatDate(company.created_at as string)],
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 rounded-2xl border border-border bg-card/40 p-6">
        <h3 className="text-sm font-medium text-foreground">Informações cadastrais</h3>
        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-sm text-foreground">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-2xl border border-border bg-card/40 p-6">
        <h3 className="text-sm font-medium text-foreground">Observações</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {(company.notes as string) || "—"}
        </p>
      </div>
    </div>
  );
}

function EmptyTab({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/20 px-8 py-14 text-center">
      <div className="mx-auto inline-flex">{icon}</div>
      <h3 className="mt-3 font-serif text-xl text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Contacts Tab ---------------- */

function ContactsTab({ companyId, organizationId, userId }: { companyId: string; organizationId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["company-contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts")
        .select("id, full_name, role, email, phone, whatsapp, birthday, notes, created_at")
        .eq("company_id", companyId).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="navy" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo contato
        </Button>
      </div>
      {list.data && list.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{c.full_name}</p>
                  {c.role && <p className="text-xs text-muted-foreground">{c.role}</p>}
                </div>
                {c.birthday && <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{formatDate(c.birthday)}</span>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                {c.email && <p>{c.email}</p>}
                {c.phone && <p>Tel: {c.phone}</p>}
                {c.whatsapp && <p>WhatsApp: {c.whatsapp}</p>}
              </div>
              {c.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{c.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyTab
          icon={<Building2 className="h-6 w-6 text-muted-foreground" />}
          title="Nenhum contato"
          description="Adicione contatos para esta empresa."
        />
      )}
      <ContactFormDialog
        open={open} onOpenChange={setOpen}
        companyId={companyId} organizationId={organizationId} userId={userId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["company-contacts", companyId] })}
      />
    </div>
  );
}

function ContactFormDialog({
  open, onOpenChange, companyId, organizationId, userId, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  companyId: string; organizationId: string; userId: string; onSaved: () => void;
}) {
  const [f, setF] = useState({ full_name: "", role: "", email: "", phone: "", whatsapp: "", birthday: "", notes: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!f.full_name.trim()) throw new Error("Informe o nome.");
      const { error } = await supabase.from("contacts").insert({
        organization_id: organizationId,
        company_id: companyId,
        full_name: f.full_name.trim(),
        role: f.role || null,
        email: f.email || null,
        phone: f.phone || null,
        whatsapp: f.whatsapp || null,
        birthday: f.birthday || null,
        notes: f.notes || null,
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato adicionado");
      setF({ full_name: "", role: "", email: "", phone: "", whatsapp: "", birthday: "", notes: "" });
      onSaved(); onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(); }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Novo contato</DialogTitle>
          <DialogDescription>Vinculado a esta empresa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2"><Label>Nome *</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Cargo</Label><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Aniversário</Label><Input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Observações</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Leads Tab ---------------- */

function LeadsTab({ companyId, organizationId, userId }: { companyId: string; organizationId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["company-leads", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads")
        .select("id, source, status, interest, notes, created_at")
        .eq("company_id", companyId).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="navy" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Novo lead
        </Button>
      </div>
      {list.data && list.data.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
          {list.data.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="text-sm text-foreground">{l.source || "Origem não informada"}</p>
                <p className="text-xs text-muted-foreground">{formatDate(l.created_at)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {l.interest && <Badge variant="outline" className="font-normal">{l.interest}</Badge>}
                {l.status && <Badge variant="secondary" className="font-normal">{l.status}</Badge>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyTab icon={<Building2 className="h-6 w-6 text-muted-foreground" />} title="Sem leads" description="Registre o primeiro lead desta empresa." />
      )}
      <LeadFormDialog open={open} onOpenChange={setOpen} companyId={companyId} organizationId={organizationId} userId={userId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["company-leads", companyId] })} />
    </div>
  );
}

function LeadFormDialog({ open, onOpenChange, companyId, organizationId, userId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: string; organizationId: string; userId: string; onSaved: () => void }) {
  const [f, setF] = useState({ source: "", status: "novo", interest: "", notes: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({
        organization_id: organizationId, company_id: companyId,
        source: f.source || null, status: f.status, interest: f.interest || null, notes: f.notes || null,
        owner_id: userId, created_by: userId, updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead criado"); setF({ source: "", status: "novo", interest: "", notes: "" }); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">Novo lead</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3">
          <div className="space-y-1.5"><Label>Origem</Label><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Indicação, evento, inbound…" /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LEAD_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Interesse</Label><Input value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Opportunities Tab ---------------- */

function OpportunitiesTab({ companyId, organizationId, userId }: { companyId: string; organizationId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: ["company-opps", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities")
        .select("id, title, status, amount, currency, probability, expected_close, next_step, notes, created_at")
        .eq("company_id", companyId).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="navy" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova oportunidade
        </Button>
      </div>
      {list.data && list.data.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-foreground">{o.title}</p>
                {o.status && <Badge variant="secondary" className="font-normal">{o.status}</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Valor</p><p className="mt-0.5 text-foreground">{formatCurrency(o.amount, o.currency ?? "BRL")}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Probabilidade</p><p className="mt-0.5 text-foreground">{o.probability != null ? `${o.probability}%` : "—"}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Previsão</p><p className="mt-0.5 text-foreground">{formatDate(o.expected_close)}</p></div>
                <div><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximo passo</p><p className="mt-0.5 text-foreground">{o.next_step || "—"}</p></div>
              </div>
              {o.notes && <p className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{o.notes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyTab icon={<Building2 className="h-6 w-6 text-muted-foreground" />} title="Sem oportunidades" description="Crie a primeira oportunidade desta empresa." />
      )}
      <OpportunityFormDialog open={open} onOpenChange={setOpen} companyId={companyId} organizationId={organizationId} userId={userId}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["company-opps", companyId] })} />
    </div>
  );
}

function OpportunityFormDialog({ open, onOpenChange, companyId, organizationId, userId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; companyId: string; organizationId: string; userId: string; onSaved: () => void }) {
  const [f, setF] = useState({ title: "", status: "aberta", amount: "", probability: "", expected_close: "", next_step: "", notes: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!f.title.trim()) throw new Error("Informe o título.");
      const { error } = await supabase.from("opportunities").insert({
        organization_id: organizationId, company_id: companyId,
        title: f.title.trim(), status: f.status,
        amount: f.amount ? Number(f.amount) : null,
        probability: f.probability ? Number(f.probability) : null,
        expected_close: f.expected_close || null,
        next_step: f.next_step || null, notes: f.notes || null,
        created_by: userId, updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Oportunidade criada"); setF({ title: "", status: "aberta", amount: "", probability: "", expected_close: "", next_step: "", notes: "" }); onSaved(); onOpenChange(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">Nova oportunidade</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2"><Label>Título *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OPPORTUNITY_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Valor previsto</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Probabilidade (%)</Label><Input type="number" min={0} max={100} value={f.probability} onChange={(e) => setF({ ...f, probability: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Data prevista</Label><Input type="date" value={f.expected_close} onChange={(e) => setF({ ...f, expected_close: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Próximo passo</Label><Input value={f.next_step} onChange={(e) => setF({ ...f, next_step: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Observações</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="navy" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Notes Tab ---------------- */

function NotesTab({ companyId, organizationId, userId }: { companyId: string; organizationId: string; userId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const list = useQuery({
    queryKey: ["company-notes", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes")
        .select("id, body, created_at, created_by")
        .eq("entity_type", "company").eq("entity_id", companyId).is("archived_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Escreva uma nota.");
      const { error } = await supabase.from("notes").insert({
        organization_id: organizationId, entity_type: "company", entity_id: companyId,
        body: body.trim(), created_by: userId, updated_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); queryClient.invalidateQueries({ queryKey: ["company-notes", companyId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <Textarea rows={3} placeholder="Adicionar uma nota privada…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-3 flex justify-end">
          <Button variant="navy" size="sm" onClick={() => add.mutate()} disabled={add.isPending || !body.trim()}>
            {add.isPending ? "Salvando…" : "Adicionar nota"}
          </Button>
        </div>
      </div>
      {list.data && list.data.length > 0 ? (
        <ul className="space-y-3">
          {list.data.map((n) => (
            <li key={n.id} className="rounded-2xl border border-border bg-card/30 p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{formatDate(n.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
      )}
    </div>
  );
}

/* ---------------- Timeline Tab ---------------- */

function TimelineTab({ companyId, organizationId, company }: { companyId: string; organizationId: string; company: Record<string, unknown> }) {
  const events = useQuery({
    queryKey: ["company-timeline", companyId],
    queryFn: async () => {
      // Aggregate everything related to this company.
      const [te, leads, opps, contacts] = await Promise.all([
        supabase.from("timeline_events").select("id, kind, title, body, occurs_at")
          .eq("organization_id", organizationId).eq("entity_type", "company").eq("entity_id", companyId)
          .is("archived_at", null),
        supabase.from("leads").select("id, source, status, created_at").eq("company_id", companyId).is("archived_at", null),
        supabase.from("opportunities").select("id, title, status, created_at").eq("company_id", companyId).is("archived_at", null),
        supabase.from("contacts").select("id, full_name, created_at").eq("company_id", companyId).is("archived_at", null),
      ]);
      const items: { id: string; at: string; title: string; subtitle?: string }[] = [];
      items.push({ id: `c-${company.id}`, at: company.created_at as string, title: "Empresa cadastrada", subtitle: company.legal_name as string });
      leads.data?.forEach((l) => items.push({ id: `l-${l.id}`, at: l.created_at, title: "Lead registrado", subtitle: l.source ?? undefined }));
      opps.data?.forEach((o) => items.push({ id: `o-${o.id}`, at: o.created_at, title: `Oportunidade: ${o.title}`, subtitle: o.status ?? undefined }));
      contacts.data?.forEach((c) => items.push({ id: `ct-${c.id}`, at: c.created_at, title: "Contato adicionado", subtitle: c.full_name }));
      te.data?.forEach((e) => items.push({ id: `t-${e.id}`, at: e.occurs_at, title: e.title ?? e.kind ?? "Evento", subtitle: e.body ?? undefined }));
      return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
  });
  if (!events.data || events.data.length === 0) {
    return <EmptyTab icon={<Building2 className="h-6 w-6 text-muted-foreground" />} title="Sem eventos" description="A timeline será preenchida conforme a operação acontece." />;
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {events.data.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-[var(--navy)]" />
          <p className="text-sm text-foreground">{e.title}</p>
          {e.subtitle && <p className="text-xs text-muted-foreground">{e.subtitle}</p>}
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{formatDate(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
