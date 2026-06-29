
-- 1. Card brands & fee tiers
CREATE TABLE public.card_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'credito', -- 'credito' | 'debito'
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_brands TO authenticated;
GRANT ALL ON public.card_brands TO service_role;
ALTER TABLE public.card_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_brands_member_read   ON public.card_brands FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY card_brands_member_insert ON public.card_brands FOR INSERT TO authenticated WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY card_brands_member_update ON public.card_brands FOR UPDATE TO authenticated USING (private.is_org_member(organization_id)) WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY card_brands_admin_delete  ON public.card_brands FOR DELETE TO authenticated USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));
CREATE TRIGGER trg_card_brands_updated BEFORE UPDATE ON public.card_brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_card_brands AFTER INSERT OR UPDATE OR DELETE ON public.card_brands FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE INDEX idx_card_brands_org ON public.card_brands(organization_id);

CREATE TABLE public.card_fee_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_brand_id uuid NOT NULL REFERENCES public.card_brands(id) ON DELETE CASCADE,
  installments int NOT NULL DEFAULT 1,
  fee_percent numeric(7,4) NOT NULL DEFAULT 0,
  days_to_receive int NOT NULL DEFAULT 0,
  effective_from date,
  effective_to   date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_fee_tiers TO authenticated;
GRANT ALL ON public.card_fee_tiers TO service_role;
ALTER TABLE public.card_fee_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_tiers_member_read   ON public.card_fee_tiers FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY card_tiers_member_insert ON public.card_fee_tiers FOR INSERT TO authenticated WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY card_tiers_member_update ON public.card_fee_tiers FOR UPDATE TO authenticated USING (private.is_org_member(organization_id)) WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY card_tiers_admin_delete  ON public.card_fee_tiers FOR DELETE TO authenticated USING (private.has_org_role(organization_id,'owner'::org_role) OR private.has_org_role(organization_id,'admin'::org_role));
CREATE TRIGGER trg_card_tiers_updated BEFORE UPDATE ON public.card_fee_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_audit_card_tiers AFTER INSERT OR UPDATE OR DELETE ON public.card_fee_tiers FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE INDEX idx_card_tiers_brand ON public.card_fee_tiers(card_brand_id, installments);
CREATE INDEX idx_card_tiers_org   ON public.card_fee_tiers(organization_id);

-- 2. financial_movements: payment method + card fields
ALTER TABLE public.financial_movements
  ADD COLUMN payment_method   text,
  ADD COLUMN card_brand_id    uuid REFERENCES public.card_brands(id) ON DELETE SET NULL,
  ADD COLUMN card_installments int,
  ADD COLUMN card_fee_percent numeric(7,4),
  ADD COLUMN card_fee_amount  numeric(14,2),
  ADD COLUMN net_amount       numeric(14,2);
CREATE INDEX idx_fin_mov_card_brand ON public.financial_movements(card_brand_id);

-- 3. lectures + snapshots: speaker_id (future-proof)
ALTER TABLE public.lectures
  ADD COLUMN speaker_id uuid; -- nullable = palestrante padrão (Gustavo)
ALTER TABLE public.lecture_financial_snapshots
  ADD COLUMN speaker_id      uuid,
  ADD COLUMN total_card_fees numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN total_stock_cost numeric(14,2) NOT NULL DEFAULT 0;

-- 4. Custo médio ponderado dos lotes ativos
CREATE OR REPLACE FUNCTION public.compute_stock_avg_cost(p_item uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH b AS (
    SELECT
      b.id,
      b.unit_cost,
      GREATEST(
        COALESCE(b.initial_quantity, b.quantity, 0)
        + COALESCE((
            SELECT SUM(
              CASE
                WHEN m.kind IN ('entrada','devolucao','ajuste') THEN m.quantity
                WHEN m.kind IN ('saida','baixa') THEN -m.quantity
                ELSE 0
              END
            )
            FROM public.stock_movements m
            WHERE m.batch_id = b.id
              AND COALESCE(m.status,'') <> 'cancelado'
              AND m.archived_at IS NULL
          ), 0)
      , 0) AS remaining
    FROM public.inventory_batches b
    WHERE b.stock_item_id = p_item
      AND b.archived_at IS NULL
      AND b.unit_cost IS NOT NULL
  )
  SELECT CASE
    WHEN SUM(remaining) > 0 THEN ROUND(SUM(unit_cost * remaining) / SUM(remaining), 2)
    ELSE (SELECT purchase_price FROM public.stock_items WHERE id = p_item)
  END
  FROM b;
$$;

-- 5. Trigger custo automático em saídas
CREATE OR REPLACE FUNCTION public.stock_mov_autocost()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('saida','baixa') AND NEW.stock_item_id IS NOT NULL AND NEW.unit_cost IS NULL THEN
    NEW.unit_cost := public.compute_stock_avg_cost(NEW.stock_item_id);
  END IF;
  IF NEW.unit_cost IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    NEW.total_cost := ROUND(NEW.unit_cost * NEW.quantity, 2);
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_stock_mov_autocost
  BEFORE INSERT OR UPDATE OF unit_cost, quantity, kind, stock_item_id
  ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_mov_autocost();

-- 6. Trigger taxa de cartão automática
CREATE OR REPLACE FUNCTION public.financial_mov_card_fee()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_pct numeric;
BEGIN
  IF NEW.direction = 'in' AND NEW.card_brand_id IS NOT NULL THEN
    IF NEW.card_fee_percent IS NULL THEN
      SELECT fee_percent INTO v_pct
      FROM public.card_fee_tiers
      WHERE card_brand_id = NEW.card_brand_id
        AND installments = COALESCE(NEW.card_installments, 1)
        AND archived_at IS NULL
        AND (effective_from IS NULL OR effective_from <= COALESCE(NEW.occurs_on, CURRENT_DATE))
        AND (effective_to   IS NULL OR effective_to   >= COALESCE(NEW.occurs_on, CURRENT_DATE))
      ORDER BY effective_from DESC NULLS LAST
      LIMIT 1;
      NEW.card_fee_percent := COALESCE(v_pct, 0);
    END IF;
    IF NEW.amount IS NOT NULL THEN
      NEW.card_fee_amount := ROUND(NEW.amount * COALESCE(NEW.card_fee_percent,0) / 100.0, 2);
      NEW.net_amount := NEW.amount - NEW.card_fee_amount;
    END IF;
  ELSIF NEW.direction = 'in' THEN
    NEW.card_fee_amount := COALESCE(NEW.card_fee_amount, 0);
    NEW.net_amount := COALESCE(NEW.net_amount, NEW.amount);
  END IF;
  RETURN NEW;
END$$;

CREATE TRIGGER trg_fin_mov_card_fee
  BEFORE INSERT OR UPDATE OF amount, card_brand_id, card_installments, card_fee_percent, direction, occurs_on
  ON public.financial_movements
  FOR EACH ROW EXECUTE FUNCTION public.financial_mov_card_fee();

-- 7. View de indicadores agregados do estoque
CREATE OR REPLACE VIEW public.stock_item_metrics AS
SELECT
  i.id AS stock_item_id,
  i.organization_id,
  COALESCE(SUM(CASE WHEN m.kind IN ('entrada','devolucao') AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN m.quantity ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN m.kind IN ('saida','baixa')       AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN m.quantity ELSE 0 END), 0) AS total_used,
  COALESCE(SUM(CASE WHEN m.kind IN ('saida','baixa')       AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN COALESCE(m.total_cost, 0) ELSE 0 END), 0) AS total_used_cost,
  MAX(COALESCE(m.occurs_at, m.occurs_on::timestamptz, m.created_at)) AS last_movement_at
FROM public.stock_items i
LEFT JOIN public.stock_movements m ON m.stock_item_id = i.id
GROUP BY i.id, i.organization_id;

GRANT SELECT ON public.stock_item_metrics TO authenticated;
GRANT ALL ON public.stock_item_metrics TO service_role;
