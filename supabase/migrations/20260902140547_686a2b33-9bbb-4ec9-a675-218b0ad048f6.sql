CREATE TABLE public.account_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT,
  season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  doc_kind text NOT NULL DEFAULT 'fechamento',
  closing_number text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.account_closings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'fechado',
  period_start date,
  period_end date,
  period_label text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  total_revenue numeric(14,2) NOT NULL DEFAULT 0,
  total_materials numeric(14,2) NOT NULL DEFAULT 0,
  total_fees numeric(14,2) NOT NULL DEFAULT 0,
  total_expenses numeric(14,2) NOT NULL DEFAULT 0,
  net_profit numeric(14,2) NOT NULL DEFAULT 0,
  agent_share numeric(14,2) NOT NULL DEFAULT 0,
  tithe numeric(14,2) NOT NULL DEFAULT 0,
  total_advances numeric(14,2) NOT NULL DEFAULT 0,
  total_credits numeric(14,2) NOT NULL DEFAULT 0,
  total_debits numeric(14,2) NOT NULL DEFAULT 0,
  final_balance numeric(14,2) NOT NULL DEFAULT 0,
  lectures_count integer NOT NULL DEFAULT 0,
  companies_count integer NOT NULL DEFAULT 0,
  notes text,
  thanks_message text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  reopened_at timestamptz,
  reopened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reopen_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT account_closings_number_unique UNIQUE (organization_id, closing_number)
);

CREATE INDEX idx_account_closings_org_agent ON public.account_closings (organization_id, agent_id, closed_at DESC);
CREATE INDEX idx_account_closings_season ON public.account_closings (season_id);

GRANT SELECT, INSERT, UPDATE ON public.account_closings TO authenticated;
GRANT ALL ON public.account_closings TO service_role;

ALTER TABLE public.account_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "closings_select_member" ON public.account_closings
  FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));

CREATE POLICY "closings_insert_writer" ON public.account_closings
  FOR INSERT TO authenticated
  WITH CHECK (private.can_write(organization_id));

CREATE POLICY "closings_update_writer" ON public.account_closings
  FOR UPDATE TO authenticated
  USING (private.can_write(organization_id))
  WITH CHECK (private.can_write(organization_id));

CREATE TRIGGER trg_account_closings_updated
  BEFORE UPDATE ON public.account_closings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_account_closings
  AFTER INSERT OR UPDATE OR DELETE ON public.account_closings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE OR REPLACE FUNCTION public.next_closing_number(_org uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_seq integer;
BEGIN
  IF NOT private.is_org_member(_org) THEN
    RAISE EXCEPTION 'not a member of this organization';
  END IF;

  SELECT COALESCE(MAX((regexp_replace(closing_number, '^.*-', ''))::integer), 0) + 1
    INTO v_seq
  FROM public.account_closings
  WHERE organization_id = _org
    AND closing_number LIKE 'GG-' || v_year || '-AG-%';

  RETURN 'GG-' || v_year || '-AG-' || lpad(v_seq::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_closing_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_closing_number(uuid) TO authenticated;

CREATE POLICY "closing_docs_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND (storage.foldername(name))[2] = 'closings'
    AND private.is_org_member(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "closing_docs_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-attachments'
    AND (storage.foldername(name))[2] = 'closings'
    AND private.can_write(((storage.foldername(name))[1])::uuid)
  );