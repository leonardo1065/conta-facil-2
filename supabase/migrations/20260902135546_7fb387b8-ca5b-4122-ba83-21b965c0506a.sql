ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS health_notify_email text,
  ADD COLUMN IF NOT EXISTS health_notify_whatsapp text,
  ADD COLUMN IF NOT EXISTS health_via_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS health_via_whatsapp boolean NOT NULL DEFAULT false;