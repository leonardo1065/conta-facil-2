ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS is_avulsa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS month_ref text;

CREATE INDEX IF NOT EXISTS entries_avulsa_idx ON public.entries (user_id, series_id, month_ref) WHERE is_avulsa;