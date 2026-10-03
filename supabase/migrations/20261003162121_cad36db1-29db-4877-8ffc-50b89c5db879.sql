CREATE TABLE private.closing_number_counters (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, year)
);
REVOKE ALL ON private.closing_number_counters FROM PUBLIC, anon, authenticated;

INSERT INTO private.closing_number_counters (organization_id, year, last_seq)
SELECT organization_id, substring(closing_number from '^GG-(\d{4})-AG-')::int,
       max((regexp_replace(closing_number, '^.*-', ''))::int)
FROM public.account_closings
WHERE closing_number ~ '^GG-\d{4}-AG-\d+$'
GROUP BY 1, 2;

CREATE OR REPLACE FUNCTION private.reserve_closing_number(_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE v_year int := extract(year from now())::int; v_seq int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _org IS NULL OR NOT private.can_write(_org) THEN
    RAISE EXCEPTION 'not allowed to close accounts in this organization' USING ERRCODE = '42501';
  END IF;
  INSERT INTO private.closing_number_counters AS c (organization_id, year, last_seq)
  VALUES (_org, v_year, 1)
  ON CONFLICT (organization_id, year) DO UPDATE SET last_seq = c.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO v_seq;
  RETURN 'GG-' || v_year || '-AG-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION private.reserve_closing_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.reserve_closing_number(uuid) TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION public.next_closing_number(_org uuid)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.reserve_closing_number(_org);
$$;
REVOKE ALL ON FUNCTION public.next_closing_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_closing_number(uuid) TO authenticated;