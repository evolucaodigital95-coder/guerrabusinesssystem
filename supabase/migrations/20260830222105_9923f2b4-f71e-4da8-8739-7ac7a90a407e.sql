ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopen_reason text;

CREATE TABLE IF NOT EXISTS public.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  title text NOT NULL,
  reference_date date NOT NULL DEFAULT current_date,
  gbs_amount numeric(14,2) NOT NULL DEFAULT 0,
  external_amount numeric(14,2) NOT NULL DEFAULT 0,
  difference numeric(14,2) GENERATED ALWAYS AS (round(gbs_amount - external_amount, 2)) STORED,
  status text NOT NULL DEFAULT 'divergencia',
  document_ref text,
  notes text,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reconciliations_org_idx ON public.reconciliations (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reconciliations_entity_idx ON public.reconciliations (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliations TO authenticated;
GRANT ALL ON public.reconciliations TO service_role;

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconciliations_select" ON public.reconciliations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
                 WHERE m.organization_id = reconciliations.organization_id
                   AND m.user_id = auth.uid()));

CREATE POLICY "reconciliations_insert" ON public.reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (private.can_write(organization_id));

CREATE POLICY "reconciliations_update" ON public.reconciliations
  FOR UPDATE TO authenticated
  USING (private.can_write(organization_id))
  WITH CHECK (private.can_write(organization_id));

CREATE POLICY "reconciliations_delete" ON public.reconciliations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m
                 WHERE m.organization_id = reconciliations.organization_id
                   AND m.user_id = auth.uid()
                   AND m.role IN ('owner','admin')));

CREATE TRIGGER reconciliations_set_updated_at
  BEFORE UPDATE ON public.reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reconciliations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();