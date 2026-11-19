ALTER TABLE public.health_events
  ADD COLUMN IF NOT EXISTS therapy_type text,
  ADD COLUMN IF NOT EXISTS session_frequency text,
  ADD COLUMN IF NOT EXISTS session_number integer,
  ADD COLUMN IF NOT EXISTS session_total integer;

ALTER TABLE public.health_events
  ADD CONSTRAINT health_events_therapy_type_check
    CHECK (therapy_type IS NULL OR therapy_type IN ('acupuntura', 'fisioterapia')),
  ADD CONSTRAINT health_events_session_frequency_check
    CHECK (session_frequency IS NULL OR session_frequency IN ('diaria', 'semanal')),
  ADD CONSTRAINT health_events_session_number_check
    CHECK (session_number IS NULL OR session_number > 0),
  ADD CONSTRAINT health_events_session_total_check
    CHECK (session_total IS NULL OR session_total IN (5, 10, 15));