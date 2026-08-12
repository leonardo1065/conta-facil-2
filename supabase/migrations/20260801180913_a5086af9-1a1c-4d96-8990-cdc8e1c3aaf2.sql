ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_subject_tpl text,
  ADD COLUMN IF NOT EXISTS email_body_tpl text;