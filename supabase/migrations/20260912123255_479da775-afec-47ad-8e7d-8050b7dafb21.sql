ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'nenhuma',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_count integer;