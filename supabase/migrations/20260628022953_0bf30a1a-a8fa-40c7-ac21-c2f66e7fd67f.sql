
-- 1) season_snapshots: restrict DELETE to admin/owner
DROP POLICY IF EXISTS "season_snapshots org delete" ON public.season_snapshots;
DROP POLICY IF EXISTS "season_snapshots_org_delete" ON public.season_snapshots;
DROP POLICY IF EXISTS "season_snapshots_member_delete" ON public.season_snapshots;
DROP POLICY IF EXISTS "season_snapshots_admin_delete" ON public.season_snapshots;
CREATE POLICY "season_snapshots_admin_delete"
  ON public.season_snapshots FOR DELETE TO authenticated
  USING (
    public.has_org_role(organization_id, 'owner') OR
    public.has_org_role(organization_id, 'admin')
  );

-- 2) storage: align crm-attachments DELETE with DB-level admin restriction
DROP POLICY IF EXISTS "crm_attachments_delete" ON storage.objects;
CREATE POLICY "crm_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND (
      public.has_org_role((storage.foldername(name))[1]::uuid, 'owner') OR
      public.has_org_role((storage.foldername(name))[1]::uuid, 'admin')
    )
  );

-- 3) Move SECURITY DEFINER RLS helpers out of the API-exposed public schema.
-- Policies reference functions by OID, so ALTER ... SET SCHEMA preserves all RLS bindings.
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_org_member(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_org_role(uuid, public.org_role) SET SCHEMA private;

-- Lock down direct callability through PostgREST (private schema is not API-exposed,
-- but revoke explicitly so the linter and any future schema exposure stay safe).
REVOKE ALL ON FUNCTION private.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_org_role(uuid, public.org_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_org_role(uuid, public.org_role) TO authenticated, service_role;
