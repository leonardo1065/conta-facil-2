ALTER TABLE public.health_events
  DROP CONSTRAINT IF EXISTS health_events_session_total_check;

ALTER TABLE public.health_events
  ADD CONSTRAINT health_events_session_total_check
    CHECK (session_total IS NULL OR session_total >= 1);
