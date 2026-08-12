ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS notify_days_before integer NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'consulta',
  title text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time,
  place_type text NOT NULL DEFAULT 'clinica',
  place_name text,
  phone text,
  cep text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  notes text,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_events TO authenticated;
GRANT ALL ON public.health_events TO service_role;

ALTER TABLE public.health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own health events" ON public.health_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER health_events_touch BEFORE UPDATE ON public.health_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();