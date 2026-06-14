
-- 1) Agentes (agendistas) — campos cadastrais
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_kind text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2) Adiantamentos — origem, comprovante, amortização, palestra
ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS granted_time time,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS paid_by_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS paid_by_label text,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS amount_amortized numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lecture_id uuid REFERENCES public.lectures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_advances_agent ON public.advances(agent_id);
CREATE INDEX IF NOT EXISTS idx_advances_lecture ON public.advances(lecture_id);

-- 3) Palestras — referência de receita e fechamento financeiro
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS gross_revenue numeric(14,2),
  ADD COLUMN IF NOT EXISTS financial_status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);

-- 4) Regras financeiras parametrizadas
CREATE TABLE IF NOT EXISTS public.financial_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'organization',     -- organization | agent | season
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE,
  gustavo_share numeric(6,4) NOT NULL DEFAULT 0.5000,
  agent_share   numeric(6,4) NOT NULL DEFAULT 0.5000,
  fee_percent   numeric(6,4) NOT NULL DEFAULT 0,
  fee_fixed     numeric(14,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT (now()::date),
  effective_to   date,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_rules TO authenticated;
GRANT ALL ON public.financial_rules TO service_role;

ALTER TABLE public.financial_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_rules_member_read" ON public.financial_rules
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "fin_rules_member_insert" ON public.financial_rules
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "fin_rules_member_update" ON public.financial_rules
  FOR UPDATE TO authenticated USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));
CREATE POLICY "fin_rules_admin_delete" ON public.financial_rules
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, 'owner') OR has_org_role(organization_id, 'admin'));

CREATE TRIGGER trg_fin_rules_updated BEFORE UPDATE ON public.financial_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fin_rules_org ON public.financial_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_fin_rules_agent ON public.financial_rules(agent_id);
CREATE INDEX IF NOT EXISTS idx_fin_rules_season ON public.financial_rules(season_id);

-- 5) Snapshots financeiros de palestras (regra congelada no fechamento)
CREATE TABLE IF NOT EXISTS public.lecture_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.financial_rules(id) ON DELETE SET NULL,
  rule_snapshot jsonb NOT NULL,         -- cópia completa da regra
  inputs jsonb NOT NULL,                -- entradas usadas (receita, despesas, adiantamentos)
  breakdown jsonb NOT NULL,             -- saída calculada (taxa, lucro líquido, splits)
  gross_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  total_advances numeric(14,2) NOT NULL DEFAULT 0,
  net_profit numeric(14,2) NOT NULL DEFAULT 0,
  gustavo_amount numeric(14,2) NOT NULL DEFAULT 0,
  agent_amount numeric(14,2) NOT NULL DEFAULT 0,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lecture_financial_snapshots TO authenticated;
GRANT ALL ON public.lecture_financial_snapshots TO service_role;

ALTER TABLE public.lecture_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lec_snap_member_read" ON public.lecture_financial_snapshots
  FOR SELECT TO authenticated USING (is_org_member(organization_id));
CREATE POLICY "lec_snap_member_insert" ON public.lecture_financial_snapshots
  FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
CREATE POLICY "lec_snap_member_update" ON public.lecture_financial_snapshots
  FOR UPDATE TO authenticated USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));
CREATE POLICY "lec_snap_admin_delete" ON public.lecture_financial_snapshots
  FOR DELETE TO authenticated
  USING (has_org_role(organization_id, 'owner') OR has_org_role(organization_id, 'admin'));

CREATE TRIGGER trg_lec_snap_updated BEFORE UPDATE ON public.lecture_financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_lec_snap_lecture ON public.lecture_financial_snapshots(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lec_snap_agent ON public.lecture_financial_snapshots(agent_id);

-- 6) Função e trigger genérico de auditoria
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id  uuid;
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_org := (v_old->>'organization_id')::uuid;
    v_id  := (v_old->>'id')::uuid;
  ELSIF (TG_OP = 'INSERT') THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_org := (v_new->>'organization_id')::uuid;
    v_id  := (v_new->>'id')::uuid;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_org := (v_new->>'organization_id')::uuid;
    v_id  := (v_new->>'id')::uuid;
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF (v_old->k) IS DISTINCT FROM (v_new->k)
         AND k NOT IN ('updated_at','updated_by') THEN
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
      END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.audit_log(organization_id, actor_id, entity_type, entity_id, action, diff)
  VALUES (
    v_org,
    auth.uid(),
    TG_TABLE_NAME,
    v_id,
    lower(TG_OP),
    CASE
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('changes', v_changes)
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('new', v_new)
      ELSE jsonb_build_object('old', v_old)
    END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Anexa o trigger nas tabelas financeiras e correlatas
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'financial_movements','advances','financial_rules',
    'lecture_financial_snapshots','agents','lectures','accounts'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
      t, t
    );
  END LOOP;
END $$;
