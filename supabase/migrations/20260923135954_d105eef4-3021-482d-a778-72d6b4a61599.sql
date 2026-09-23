DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('active','suspended','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS status public.org_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS status public.member_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

UPDATE public.organization_members SET joined_at = created_at WHERE joined_at > created_at;

CREATE OR REPLACE FUNCTION private.is_org_active(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org AND o.status = 'active'::public.org_status AND o.archived_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid()
      AND archived_at IS NULL AND status = 'active'::public.member_status
  );
$function$;

CREATE OR REPLACE FUNCTION private.has_org_role(_org uuid, _role org_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org AND m.user_id = auth.uid()
      AND m.role = _role AND m.archived_at IS NULL
      AND m.status = 'active'::public.member_status
      AND o.status = 'active'::public.org_status
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org
      AND m.user_id = auth.uid()
      AND m.archived_at IS NULL
      AND m.status = 'active'::public.member_status
      AND o.status = 'active'::public.org_status
      AND o.archived_at IS NULL
      AND m.role IN ('owner'::org_role, 'admin'::org_role, 'member'::org_role)
  );
$function$;

DROP POLICY IF EXISTS crm_attachments_insert ON storage.objects;
CREATE POLICY crm_attachments_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crm-attachments' AND private.can_write(((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS crm_attachments_update ON storage.objects;
CREATE POLICY crm_attachments_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'crm-attachments' AND private.can_write(((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'crm-attachments' AND private.can_write(((storage.foldername(name))[1])::uuid));