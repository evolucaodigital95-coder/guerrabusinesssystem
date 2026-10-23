-- =====================================================================
-- Integridade de dados: lançamentos financeiros e estoque
--
-- Até aqui as regras só existiam nas telas. Esta migração leva as regras
-- essenciais para o banco, que passa a recusar dados inválidos venham de
-- onde vierem (qualquer tela, importação ou duas pessoas ao mesmo tempo).
--
-- As CHECK constraints usam NOT VALID: valem para tudo que for criado ou
-- alterado daqui em diante, sem bloquear a migração por causa de dados
-- antigos. Registros antigos fora da regra continuam legíveis; só precisam
-- ser corrigidos quando forem editados.
-- =====================================================================

-- ---------- LANÇAMENTOS FINANCEIROS ----------

ALTER TABLE public.financial_movements
  DROP CONSTRAINT IF EXISTS fin_mov_direction_chk,
  DROP CONSTRAINT IF EXISTS fin_mov_amount_nonneg_chk,
  DROP CONSTRAINT IF EXISTS fin_mov_status_chk,
  DROP CONSTRAINT IF EXISTS fin_mov_settled_amount_chk,
  DROP CONSTRAINT IF EXISTS fin_mov_description_chk;

-- Tipo obrigatório: entrada ou saída.
ALTER TABLE public.financial_movements
  ADD CONSTRAINT fin_mov_direction_chk
  CHECK (direction IN ('in', 'out')) NOT VALID;

-- Valores nunca negativos (o sinal vem do tipo entrada/saída).
ALTER TABLE public.financial_movements
  ADD CONSTRAINT fin_mov_amount_nonneg_chk
  CHECK (
    (amount IS NULL OR amount >= 0)
    AND (expected_amount IS NULL OR expected_amount >= 0)
  ) NOT VALID;

-- Status coerente com o tipo do lançamento.
ALTER TABLE public.financial_movements
  ADD CONSTRAINT fin_mov_status_chk
  CHECK (
    status IS NULL
    OR (direction = 'in'  AND status IN ('previsto', 'parcial', 'recebido', 'cancelado'))
    OR (direction = 'out' AND status IN ('prevista', 'parcial', 'paga', 'cancelada'))
  ) NOT VALID;

-- Recebido/pago/parcial exige valor realizado maior que zero.
ALTER TABLE public.financial_movements
  ADD CONSTRAINT fin_mov_settled_amount_chk
  CHECK (
    status IS NULL
    OR status NOT IN ('recebido', 'paga', 'parcial')
    OR COALESCE(amount, 0) > 0
  ) NOT VALID;

-- Descrição obrigatória.
ALTER TABLE public.financial_movements
  ADD CONSTRAINT fin_mov_description_chk
  CHECK (description IS NOT NULL AND length(btrim(description)) > 0) NOT VALID;

-- Ao marcar como recebido/pago sem data de liquidação, usa a data do lançamento.
CREATE OR REPLACE FUNCTION public.financial_mov_default_settled_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IN ('recebido', 'paga') AND NEW.settled_at IS NULL THEN
    NEW.settled_at := COALESCE(NEW.occurs_on, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_fin_mov_default_settled_at ON public.financial_movements;
CREATE TRIGGER trg_fin_mov_default_settled_at
BEFORE INSERT OR UPDATE ON public.financial_movements
FOR EACH ROW EXECUTE FUNCTION public.financial_mov_default_settled_at();


-- ---------- ESTOQUE ----------

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_mov_direction_chk,
  DROP CONSTRAINT IF EXISTS stock_mov_quantity_chk;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_mov_direction_chk
  CHECK (direction IN ('in', 'out')) NOT VALID;

-- Quantidade nunca zero; negativa só em "ajuste" (correção de inventário).
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_mov_quantity_chk
  CHECK (
    quantity IS NOT NULL
    AND quantity <> 0
    AND (quantity > 0 OR kind = 'ajuste')
  ) NOT VALID;

-- Efeito de uma movimentação no saldo DISPONÍVEL do item.
-- Espelha calcOnHand() em src/lib/stock.ts:
--   * cancelado/estornado ou kind 'cancelamento' não contam;
--   * reserva ainda não utilizada reduz o disponível;
--   * demais: entrada soma, saída subtrai.
CREATE OR REPLACE FUNCTION public.stock_mov_available_effect(
  _kind text, _direction text, _status text, _quantity numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _quantity IS NULL OR _quantity = 0 THEN 0
    WHEN _status IN ('cancelado', 'estornado') OR _kind = 'cancelamento' THEN 0
    WHEN _kind = 'reserva' AND COALESCE(_status, '') <> 'utilizado' THEN -_quantity
    WHEN COALESCE(_direction, CASE WHEN _kind IN ('saida','reserva','baixa','devolucao_fornecedor') THEN 'out' ELSE 'in' END) = 'out'
      THEN -_quantity
    ELSE _quantity
  END;
$function$;

-- Impede que o saldo disponível de um item fique negativo.
-- Trava a linha do item (FOR UPDATE) para que duas saídas simultâneas
-- sejam avaliadas uma depois da outra.
CREATE OR REPLACE FUNCTION public.stock_mov_prevent_negative()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_effect numeric := 0;
  v_old_effect numeric := 0;
  v_available  numeric;
  v_name       text;
  v_unit       text;
BEGIN
  IF NEW.stock_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.archived_at IS NULL THEN
    v_new_effect := public.stock_mov_available_effect(NEW.kind, NEW.direction, NEW.status, NEW.quantity);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.stock_item_id IS NOT DISTINCT FROM NEW.stock_item_id
     AND OLD.archived_at IS NULL THEN
    v_old_effect := public.stock_mov_available_effect(OLD.kind, OLD.direction, OLD.status, OLD.quantity);
  END IF;

  -- Só verifica quando a alteração reduz o disponível.
  IF v_new_effect - v_old_effect >= 0 THEN
    RETURN NEW;
  END IF;

  SELECT name, unit INTO v_name, v_unit
  FROM public.stock_items
  WHERE id = NEW.stock_item_id
  FOR UPDATE;

  SELECT COALESCE(SUM(public.stock_mov_available_effect(m.kind, m.direction, m.status, m.quantity)), 0)
  INTO v_available
  FROM public.stock_movements m
  WHERE m.stock_item_id = NEW.stock_item_id
    AND m.archived_at IS NULL
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF v_available + v_new_effect < 0 THEN
    IF v_new_effect < 0 THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%": disponível % %, tentou retirar %.',
        COALESCE(v_name, 'item'),
        trim(to_char(GREATEST(v_available, 0), 'FM999999990.###')),
        COALESCE(v_unit, 'un'),
        trim(to_char(-v_new_effect, 'FM999999990.###'))
        USING ERRCODE = 'check_violation';
    ELSE
      -- Estorno/arquivamento de uma entrada que já foi consumida.
      RAISE EXCEPTION 'Não é possível: o estoque de "%" ficaria negativo (% %). Estorne antes as saídas que usaram este material.',
        COALESCE(v_name, 'item'),
        trim(to_char(v_available + v_new_effect, 'FM999999990.###')),
        COALESCE(v_unit, 'un')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_stock_mov_prevent_negative ON public.stock_movements;
CREATE TRIGGER trg_stock_mov_prevent_negative
BEFORE INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.stock_mov_prevent_negative();
