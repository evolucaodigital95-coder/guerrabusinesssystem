
ALTER TABLE public.lectures
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS scheduled_time time,
  ADD COLUMN IF NOT EXISTS expected_audience integer,
  ADD COLUMN IF NOT EXISTS actual_audience integer,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_lectures_company   ON public.lectures(company_id);
CREATE INDEX IF NOT EXISTS idx_lectures_agent     ON public.lectures(agent_id);
CREATE INDEX IF NOT EXISTS idx_lectures_season    ON public.lectures(season_id);
CREATE INDEX IF NOT EXISTS idx_lectures_campaign  ON public.lectures(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lectures_project   ON public.lectures(project_id);
CREATE INDEX IF NOT EXISTS idx_lectures_scheduled ON public.lectures(scheduled_at);

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS lecture_id uuid REFERENCES public.lectures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_stock_movements_lecture ON public.stock_movements(lecture_id);

-- Auditoria também em contatos e estoque (idempotente)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['contacts','stock_movements','stock_items']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()',
      t, t
    );
  END LOOP;
END $$;
