CREATE OR REPLACE FUNCTION public.compute_stock_avg_cost(p_item uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH batches AS (
    SELECT
      b.id,
      b.unit_cost,
      GREATEST(
        COALESCE(b.initial_quantity, b.quantity, 0)
        - COALESCE((
            SELECT SUM(m.quantity)
            FROM public.stock_movements m
            WHERE m.batch_id = b.id
              AND m.kind IN ('saida','baixa')
              AND COALESCE(m.status,'') <> 'cancelado'
              AND m.archived_at IS NULL
          ), 0)
        + COALESCE((
            SELECT SUM(m.quantity)
            FROM public.stock_movements m
            WHERE m.batch_id = b.id
              AND m.kind IN ('devolucao','ajuste','cancelamento')
              AND COALESCE(m.status,'') <> 'cancelado'
              AND m.archived_at IS NULL
          ), 0)
      , 0) AS remaining
    FROM public.inventory_batches b
    WHERE b.stock_item_id = p_item
      AND b.archived_at IS NULL
      AND b.unit_cost IS NOT NULL
  )
  SELECT COALESCE(
    CASE WHEN SUM(remaining) > 0 THEN ROUND(SUM(unit_cost * remaining) / SUM(remaining), 2) END,
    (SELECT average_cost FROM public.stock_items WHERE id = p_item),
    (SELECT purchase_price FROM public.stock_items WHERE id = p_item),
    0
  )
  FROM batches;
$function$;

CREATE OR REPLACE FUNCTION public.stock_mov_autocost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_cost numeric;
BEGIN
  IF NEW.stock_item_id IS NOT NULL THEN
    IF NEW.kind IN ('saida','baixa') AND NEW.unit_cost IS NULL THEN
      SELECT b.unit_cost INTO v_unit_cost
      FROM public.inventory_batches b
      WHERE b.id = NEW.batch_id
        AND b.unit_cost IS NOT NULL;

      NEW.unit_cost := COALESCE(v_unit_cost, public.compute_stock_avg_cost(NEW.stock_item_id));
    END IF;

    IF NEW.kind IN ('entrada','devolucao','ajuste') AND NEW.unit_cost IS NOT NULL THEN
      UPDATE public.stock_items
      SET
        purchase_price = COALESCE(purchase_price, NEW.unit_cost),
        average_cost = COALESCE(public.compute_stock_avg_cost(NEW.stock_item_id), NEW.unit_cost),
        updated_at = now(),
        updated_by = NEW.updated_by
      WHERE id = NEW.stock_item_id;
    END IF;
  END IF;

  IF NEW.unit_cost IS NOT NULL AND NEW.quantity IS NOT NULL THEN
    NEW.total_cost := ROUND(NEW.unit_cost * NEW.quantity, 2);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.stock_item_refresh_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_item uuid;
BEGIN
  v_item := COALESCE(NEW.stock_item_id, OLD.stock_item_id);
  IF v_item IS NOT NULL THEN
    UPDATE public.stock_items
    SET
      average_cost = public.compute_stock_avg_cost(v_item),
      updated_at = now(),
      updated_by = COALESCE(NEW.updated_by, OLD.updated_by)
    WHERE id = v_item;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_mov_autocost ON public.stock_movements;
CREATE TRIGGER trg_stock_mov_autocost
BEFORE INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.stock_mov_autocost();

DROP TRIGGER IF EXISTS trg_stock_mov_refresh_cost ON public.stock_movements;
CREATE TRIGGER trg_stock_mov_refresh_cost
AFTER INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.stock_item_refresh_cost();

DROP TRIGGER IF EXISTS trg_inventory_batch_refresh_cost ON public.inventory_batches;
CREATE TRIGGER trg_inventory_batch_refresh_cost
AFTER INSERT OR UPDATE ON public.inventory_batches
FOR EACH ROW EXECUTE FUNCTION public.stock_item_refresh_cost();

CREATE OR REPLACE FUNCTION public.financial_mov_card_fee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_pct numeric;
BEGIN
  IF NEW.direction = 'in' AND NEW.payment_method IN ('credito','debito') THEN
    IF NEW.card_brand_id IS NOT NULL AND NEW.card_fee_percent IS NULL THEN
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

    NEW.card_installments := GREATEST(COALESCE(NEW.card_installments, 1), 1);
    NEW.card_fee_percent := COALESCE(NEW.card_fee_percent, 0);
    NEW.card_fee_amount := ROUND(COALESCE(NEW.amount, NEW.expected_amount, 0) * NEW.card_fee_percent / 100.0, 2);
    NEW.net_amount := COALESCE(NEW.amount, NEW.expected_amount, 0) - NEW.card_fee_amount;
  ELSIF NEW.direction = 'in' THEN
    NEW.card_brand_id := NULL;
    NEW.card_installments := NULL;
    NEW.card_fee_percent := 0;
    NEW.card_fee_amount := 0;
    NEW.net_amount := COALESCE(NEW.net_amount, NEW.amount, NEW.expected_amount, 0);
  ELSE
    NEW.card_brand_id := NULL;
    NEW.card_installments := NULL;
    NEW.card_fee_percent := 0;
    NEW.card_fee_amount := 0;
    NEW.net_amount := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fin_mov_card_fee ON public.financial_movements;
CREATE TRIGGER trg_fin_mov_card_fee
BEFORE INSERT OR UPDATE ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.financial_mov_card_fee();

CREATE OR REPLACE VIEW public.stock_item_metrics AS
SELECT
  i.id AS stock_item_id,
  i.organization_id,
  COALESCE(SUM(CASE WHEN m.kind IN ('entrada','devolucao') AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN m.quantity ELSE 0 END), 0) AS total_purchased,
  COALESCE(SUM(CASE WHEN m.kind IN ('saida','baixa') AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN m.quantity ELSE 0 END), 0) AS total_used,
  COALESCE(SUM(CASE WHEN m.kind IN ('saida','baixa') AND COALESCE(m.status,'') <> 'cancelado' AND m.archived_at IS NULL THEN COALESCE(m.total_cost, m.unit_cost * m.quantity, 0) ELSE 0 END), 0) AS total_used_cost,
  MAX(COALESCE(m.occurs_at, m.occurs_on::timestamp with time zone, m.created_at)) AS last_movement_at
FROM public.stock_items i
LEFT JOIN public.stock_movements m ON m.stock_item_id = i.id
GROUP BY i.id, i.organization_id;

GRANT SELECT ON public.stock_item_metrics TO authenticated;
GRANT SELECT ON public.stock_item_metrics TO service_role;