import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Minus, Search, Package, AlertTriangle, Boxes, MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-shell";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCurrency } from "@/lib/crm";
import {
  STOCK_CATEGORIES, STOCK_ITEM_STATUS, calcOnHand,
} from "@/lib/stock";
import { ItemFormDialog } from "@/components/estoque/item-form-dialog";
import { MovementFormDialog } from "@/components/estoque/movement-form-dialog";
import { SupplierAccountsTab } from "@/components/estoque/supplier-accounts-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/app/estoque/")({
  head: () => ({
    meta: [
      { title: "Estoque — GBS" },
      { name: "description", content: "Materiais, livros, folders, brindes, camisetas, certificados e equipamentos — rastreáveis por lote e movimentação." },
    ],
  }),
  component: EstoquePage,
});

type Item = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string | null;
  status: string | null;
  min_quantity: number | null;
  average_cost: number | null;
  purchase_price: number | null;
  supplier: string | null;
  location: string | null;
  photo_url: string | null;
};

type Mvt = {
  stock_item_id: string | null;
  kind: string | null;
  direction: string | null;
  status: string | null;
  quantity: number | null;
};

const ALL = "__all__";

function EstoquePage() {
  const { user } = useSession();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const [itemOpen, setItemOpen] = useState(false);
  const [mvtOpen, setMvtOpen] = useState(false);
  const [mvtType, setMvtType] = useState<"entrada" | "saida_palestra">("entrada");
  const [search, setSearch] = useState("");
  const [fCat, setFCat] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);

  function openMovement(type: "entrada" | "saida_palestra") {
    setMvtType(type);
    setMvtOpen(true);
  }


  const items = useQuery({
    queryKey: ["stock-items", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, sku, category, unit, status, min_quantity, average_cost, purchase_price, supplier, location, photo_url")
        .eq("organization_id", organizationId!).is("archived_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const movements = useQuery({
    queryKey: ["stock-movements", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Mvt[]> => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("stock_item_id, kind, direction, status, quantity")
        .eq("organization_id", organizationId!).is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as Mvt[];
    },
  });

  const balances = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calcOnHand>>();
    const list = movements.data ?? [];
    for (const it of items.data ?? []) {
      map.set(it.id, calcOnHand(list.filter((m) => m.stock_item_id === it.id)));
    }
    return map;
  }, [items.data, movements.data]);

  const filtered = useMemo(() => {
    let list = items.data ?? [];
    if (fCat !== ALL) list = list.filter((i) => i.category === fCat);
    if (fStatus !== ALL) list = list.filter((i) => (i.status ?? "ativo") === fStatus);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        [i.name, i.sku, i.category, i.supplier, i.location]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [items.data, search, fCat, fStatus]);

  const totals = useMemo(() => {
    const list = items.data ?? [];
    let totalItems = list.length;
    let lowStock = 0;
    let totalValue = 0;
    let reserved = 0;
    for (const it of list) {
      const b = balances.get(it.id);
      if (!b) continue;
      reserved += b.reserved;
      const min = Number(it.min_quantity ?? 0);
      if (min > 0 && b.onHand <= min) lowStock += 1;
      const cost = Number(it.average_cost ?? it.purchase_price ?? 0);
      totalValue += b.onHand * cost;
    }
    return { totalItems, lowStock, totalValue, reserved };
  }, [items.data, balances]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operação"
        title="Estoque"
        description="Tudo o que entra, sai, é reservado ou utilizado nas palestras e operações do Grupo Guerra."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setMvtOpen(true)} disabled={!organizationId}>
              <ArrowDownUp className="mr-1.5 h-4 w-4" /> Nova movimentação
            </Button>
            <Button variant="navy" className="rounded-full" onClick={() => setItemOpen(true)} disabled={!organizationId}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo item
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items">Itens & Movimentações</TabsTrigger>
          <TabsTrigger value="supplier">Prestação de Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Itens cadastrados" value={String(totals.totalItems)} />
            <Summary label="Estoque baixo" value={String(totals.lowStock)} highlight={totals.lowStock > 0} />
            <Summary label="Reservado" value={new Intl.NumberFormat("pt-BR").format(totals.reserved)} />
            <Summary label="Valor estimado" value={formatCurrency(totals.totalValue)} />
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-6">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, SKU, fornecedor, localização…" className="rounded-full pl-9" />
              </div>
              <div className="md:col-span-3">
                <Select value={fCat} onValueChange={setFCat}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as categorias</SelectItem>
                    {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger className="rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os status</SelectItem>
                    {STOCK_ITEM_STATUS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {orgLoading || items.isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/30 px-8 py-16 text-center">
              <Boxes className="mx-auto h-7 w-7 text-muted-foreground" />
              <h3 className="mt-3 font-serif text-2xl text-foreground">Nenhum item</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {(items.data?.length ?? 0) > 0 ? "Ajuste os filtros." : "Cadastre o primeiro item do estoque."}
              </p>
              <Button variant="navy" className="mt-6 rounded-full" onClick={() => setItemOpen(true)} disabled={!organizationId}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo item
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((it) => {
                const b = balances.get(it.id) ?? { onHand: 0, reserved: 0, available: 0 };
                const min = Number(it.min_quantity ?? 0);
                const low = min > 0 && b.onHand <= min;
                const noSupplier = !it.supplier;
                return (
                  <Link
                    key={it.id} to="/app/estoque/$id" params={{ id: it.id }}
                    className="group rounded-2xl border border-border bg-card/40 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-card/70 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {it.category ?? "Sem categoria"}{it.sku ? ` · ${it.sku}` : ""}
                        </p>
                        <p className="mt-1 truncate font-serif text-lg text-foreground">{it.name}</p>
                      </div>
                      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <Stat label="Em estoque" value={`${b.onHand}${it.unit ? ` ${it.unit}` : ""}`} />
                      <Stat label="Reservado" value={`${b.reserved}`} muted />
                      <Stat label="Disponível" value={`${b.available}`} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {it.location && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {it.location}</span>
                      )}
                      {it.supplier && <span>· {it.supplier}</span>}
                    </div>

                    {(low || noSupplier) && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {low && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Estoque baixo
                          </Badge>
                        )}
                        {noSupplier && (
                          <Badge variant="outline" className="text-muted-foreground">Sem fornecedor</Badge>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="supplier">
          {organizationId && user ? (
            <SupplierAccountsTab organizationId={organizationId} userId={user.id} />
          ) : (
            <ListSkeleton />
          )}
        </TabsContent>
      </Tabs>


      {organizationId && user && (
        <>
          <ItemFormDialog open={itemOpen} onOpenChange={setItemOpen} organizationId={organizationId} userId={user.id} />
          <MovementFormDialog open={mvtOpen} onOpenChange={setMvtOpen} organizationId={organizationId} userId={user.id} />
        </>
      )}
    </div>
  );
}

function Summary({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border ${highlight ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card/40"} p-5`}>
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-3 font-serif text-2xl tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-serif text-base tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
