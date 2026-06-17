
-- Extend stock_items with rich attributes
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS min_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS purchase_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS average_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS notes text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_items_org_sku
  ON public.stock_items(organization_id, sku) WHERE sku IS NOT NULL AND archived_at IS NULL;

-- Extend inventory_batches with cost / supplier / proof
ALTER TABLE public.inventory_batches
  ADD COLUMN IF NOT EXISTS initial_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_inventory_batches_item ON public.inventory_batches(stock_item_id);

-- Extend stock_movements: typed kinds + reservation status + extra links
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS kind text,        -- entrada|saida|reserva|baixa|devolucao|ajuste|cancelamento
  ADD COLUMN IF NOT EXISTS status text,      -- disponivel|reservado|utilizado|cancelado
  ADD COLUMN IF NOT EXISTS occurs_at timestamptz,
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost numeric(14,2),
  ADD COLUMN IF NOT EXISTS total_cost numeric(14,2);

CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_kind ON public.stock_movements(kind);
CREATE INDEX IF NOT EXISTS idx_stock_movements_season ON public.stock_movements(season_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_project ON public.stock_movements(project_id);

-- Audit on inventory_batches
DROP TRIGGER IF EXISTS trg_audit_inventory_batches ON public.inventory_batches;
CREATE TRIGGER trg_audit_inventory_batches
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_batches
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
