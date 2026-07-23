
CREATE TABLE public.supplier_settlements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  amount_paid NUMERIC(14,2) NOT NULL,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  receipt_number TEXT,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_settlements TO authenticated;
GRANT ALL ON public.supplier_settlements TO service_role;

ALTER TABLE public.supplier_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_settlements_member_read" ON public.supplier_settlements FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));
CREATE POLICY "supplier_settlements_member_insert" ON public.supplier_settlements FOR INSERT TO authenticated
  WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY "supplier_settlements_member_update" ON public.supplier_settlements FOR UPDATE TO authenticated
  USING (private.is_org_member(organization_id))
  WITH CHECK (private.is_org_member(organization_id));
CREATE POLICY "supplier_settlements_admin_delete" ON public.supplier_settlements FOR DELETE TO authenticated
  USING (private.has_org_role(organization_id, 'owner'::public.org_role) OR private.has_org_role(organization_id, 'admin'::public.org_role));

CREATE INDEX idx_supplier_settlements_org ON public.supplier_settlements(organization_id);
CREATE INDEX idx_supplier_settlements_season ON public.supplier_settlements(season_id);
CREATE INDEX idx_supplier_settlements_supplier ON public.supplier_settlements(supplier);

CREATE TRIGGER trg_supplier_settlements_updated
  BEFORE UPDATE ON public.supplier_settlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_supplier_settlements
  AFTER INSERT OR UPDATE OR DELETE ON public.supplier_settlements
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
