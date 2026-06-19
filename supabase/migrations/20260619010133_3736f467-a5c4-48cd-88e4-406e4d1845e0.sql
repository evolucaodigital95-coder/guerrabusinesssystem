
-- Remover índices duplicados
DROP INDEX IF EXISTS public.accounts_org_idx;
DROP INDEX IF EXISTS public.attachments_entity_idx;
DROP INDEX IF EXISTS public.companies_org_idx;
DROP INDEX IF EXISTS public.notes_entity_idx;
DROP INDEX IF EXISTS public.taggings_entity_idx;
DROP INDEX IF EXISTS public.timeline_events_entity_idx;

-- Endurecer funções SECURITY DEFINER internas
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_row_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user()  TO service_role;

-- Índices auxiliares (escala)
CREATE INDEX IF NOT EXISTS idx_companies_org_legal_name
  ON public.companies (organization_id, lower(legal_name));
CREATE INDEX IF NOT EXISTS idx_companies_org_trade_name
  ON public.companies (organization_id, lower(trade_name));

CREATE INDEX IF NOT EXISTS idx_contacts_org_full_name
  ON public.contacts (organization_id, lower(full_name));

CREATE INDEX IF NOT EXISTS idx_lectures_org_status
  ON public.lectures (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_fin_mov_org_direction
  ON public.financial_movements (organization_id, direction);
CREATE INDEX IF NOT EXISTS idx_fin_mov_org_category
  ON public.financial_movements (organization_id, category);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org_status
  ON public.stock_movements (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_org_kind
  ON public.stock_movements (organization_id, kind);

CREATE INDEX IF NOT EXISTS idx_audit_org_created
  ON public.audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_timeline_entity_created
  ON public.timeline_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_entity_created
  ON public.attachments (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_entity_created
  ON public.notes (entity_type, entity_id, created_at DESC);
