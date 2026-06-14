
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS notes  text;

ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id        uuid REFERENCES public.agents(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lecture_id      uuid REFERENCES public.lectures(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expected_amount numeric,
  ADD COLUMN IF NOT EXISTS expected_date   date,
  ADD COLUMN IF NOT EXISTS settled_at      date,
  ADD COLUMN IF NOT EXISTS occurs_time     time,
  ADD COLUMN IF NOT EXISTS notes           text;

CREATE INDEX IF NOT EXISTS fin_mov_org_idx     ON public.financial_movements(organization_id);
CREATE INDEX IF NOT EXISTS fin_mov_account_idx ON public.financial_movements(account_id);
CREATE INDEX IF NOT EXISTS fin_mov_company_idx ON public.financial_movements(company_id);
CREATE INDEX IF NOT EXISTS fin_mov_lecture_idx ON public.financial_movements(lecture_id);
CREATE INDEX IF NOT EXISTS fin_mov_agent_idx   ON public.financial_movements(agent_id);
CREATE INDEX IF NOT EXISTS fin_mov_season_idx  ON public.financial_movements(season_id);
CREATE INDEX IF NOT EXISTS fin_mov_date_idx    ON public.financial_movements(occurs_on);
CREATE INDEX IF NOT EXISTS accounts_org_idx    ON public.accounts(organization_id);
