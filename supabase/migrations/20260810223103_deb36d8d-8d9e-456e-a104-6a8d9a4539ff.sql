CREATE OR REPLACE FUNCTION private.can_write(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = auth.uid()
      AND archived_at IS NULL
      AND role IN ('owner'::org_role, 'admin'::org_role, 'member'::org_role)
  );
$function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (policyname LIKE '%member_insert' OR policyname LIKE '%member_update')
  LOOP
    IF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'ALTER POLICY %I ON public.%I WITH CHECK (private.can_write(organization_id))',
        r.policyname, r.tablename);
    ELSE
      EXECUTE format(
        'ALTER POLICY %I ON public.%I USING (private.can_write(organization_id)) WITH CHECK (private.can_write(organization_id))',
        r.policyname, r.tablename);
    END IF;
  END LOOP;
END $$;