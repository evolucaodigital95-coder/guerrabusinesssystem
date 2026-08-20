ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

CREATE OR REPLACE VIEW public.stock_item_metrics AS
 SELECT i.id AS stock_item_id,
    i.organization_id,
    COALESCE(sum(
        CASE
            WHEN (m.kind = ANY (ARRAY['entrada'::text, 'devolucao'::text])) AND COALESCE(m.status, ''::text) <> ALL (ARRAY['cancelado'::text,'estornado'::text]) AND m.archived_at IS NULL THEN m.quantity
            ELSE 0::numeric
        END), 0::numeric) AS total_purchased,
    COALESCE(sum(
        CASE
            WHEN (m.kind = ANY (ARRAY['saida'::text, 'baixa'::text])) AND COALESCE(m.status, ''::text) <> ALL (ARRAY['cancelado'::text,'estornado'::text]) AND m.archived_at IS NULL THEN m.quantity
            ELSE 0::numeric
        END), 0::numeric) AS total_used,
    COALESCE(sum(
        CASE
            WHEN (m.kind = ANY (ARRAY['saida'::text, 'baixa'::text])) AND COALESCE(m.status, ''::text) <> ALL (ARRAY['cancelado'::text,'estornado'::text]) AND m.archived_at IS NULL THEN COALESCE(m.total_cost, m.unit_cost * m.quantity, 0::numeric)
            ELSE 0::numeric
        END), 0::numeric) AS total_used_cost,
    max(COALESCE(m.occurs_at, m.occurs_on::timestamp with time zone, m.created_at)) AS last_movement_at
   FROM stock_items i
     LEFT JOIN stock_movements m ON m.stock_item_id = i.id
  GROUP BY i.id, i.organization_id;

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
              AND COALESCE(m.status,'') NOT IN ('cancelado','estornado')
              AND m.archived_at IS NULL
          ), 0)
        + COALESCE((
            SELECT SUM(m.quantity)
            FROM public.stock_movements m
            WHERE m.batch_id = b.id
              AND m.kind IN ('devolucao','ajuste','cancelamento')
              AND COALESCE(m.status,'') NOT IN ('cancelado','estornado')
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