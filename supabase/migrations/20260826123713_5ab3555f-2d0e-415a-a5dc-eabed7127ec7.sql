ALTER TABLE public.health_events
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval_months integer NOT NULL DEFAULT 1 CHECK (recurrence_interval_months >= 1),
  ADD COLUMN IF NOT EXISTS series_id uuid;

UPDATE public.health_events
SET series_id = gen_random_uuid()
WHERE series_id IS NULL;

ALTER TABLE public.health_events
  ALTER COLUMN series_id SET DEFAULT gen_random_uuid();