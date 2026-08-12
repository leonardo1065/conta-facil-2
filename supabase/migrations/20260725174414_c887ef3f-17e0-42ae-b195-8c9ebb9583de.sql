ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_interval_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_no integer,
  ADD COLUMN IF NOT EXISTS installment_total integer;