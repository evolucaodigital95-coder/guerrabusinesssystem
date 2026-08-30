CREATE TABLE public.agent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'outro',
  reference_period text,
  doc_date date,
  description text,
  reference_amount numeric(14,2),
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  archived_at timestamptz
);

CREATE INDEX idx_agent_documents_agent ON public.agent_documents(agent_id, created_at DESC);
CREATE INDEX idx_agent_documents_org ON public.agent_documents(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_documents TO authenticated;
GRANT ALL ON public.agent_documents TO service_role;

ALTER TABLE public.agent_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_documents_member_read" ON public.agent_documents
  FOR SELECT TO authenticated USING (private.is_org_member(organization_id));
CREATE POLICY "agent_documents_member_insert" ON public.agent_documents
  FOR INSERT TO authenticated WITH CHECK (private.can_write(organization_id));
CREATE POLICY "agent_documents_member_update" ON public.agent_documents
  FOR UPDATE TO authenticated USING (private.can_write(organization_id)) WITH CHECK (private.can_write(organization_id));
CREATE POLICY "agent_documents_admin_delete" ON public.agent_documents
  FOR DELETE TO authenticated USING (
    private.has_org_role(organization_id, 'owner'::org_role) OR private.has_org_role(organization_id, 'admin'::org_role)
  );

CREATE TRIGGER trg_agent_documents_updated
  BEFORE UPDATE ON public.agent_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_agent_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.agent_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();