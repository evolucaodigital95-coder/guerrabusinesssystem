
-- Add responsável principal (owner) to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_owner_idx ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS companies_org_idx ON public.companies(organization_id);
CREATE INDEX IF NOT EXISTS taggings_entity_idx ON public.taggings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS notes_entity_idx ON public.notes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS attachments_entity_idx ON public.attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS timeline_events_entity_idx ON public.timeline_events(entity_type, entity_id);

-- Storage policies for crm-attachments (bucket created via tool).
-- Object key convention: <organization_id>/<entity_type>/<entity_id>/<filename>
CREATE POLICY "crm_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "crm_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "crm_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "crm_attachments_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-attachments'
    AND public.is_org_member((storage.foldername(name))[1]::uuid)
  );
