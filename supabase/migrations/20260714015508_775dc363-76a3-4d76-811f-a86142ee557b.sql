DROP POLICY IF EXISTS "audit read members" ON public.audit_log;
DROP POLICY IF EXISTS "audit insert members" ON public.audit_log;

CREATE POLICY "audit read members" ON public.audit_log
FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND private.is_org_member(organization_id));

CREATE POLICY "audit insert members" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (organization_id IS NOT NULL AND private.is_org_member(organization_id));