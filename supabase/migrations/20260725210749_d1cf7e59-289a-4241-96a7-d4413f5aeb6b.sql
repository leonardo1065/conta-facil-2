ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_health boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_hour integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS health_days_before integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref_date date NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'enviado',
  detail text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, ref_date, channel)
);

GRANT SELECT, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notification log read" ON public.notification_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "own notification log delete" ON public.notification_log
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER touch_notification_log_updated_at
  BEFORE UPDATE ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();