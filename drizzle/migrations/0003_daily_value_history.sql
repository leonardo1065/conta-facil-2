CREATE TABLE public.daily_value_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount <> 0),
  added_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_value_history TO authenticated;
GRANT ALL ON public.daily_value_history TO service_role;
ALTER TABLE public.daily_value_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_value_history_select ON public.daily_value_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX daily_value_history_owner_entry ON public.daily_value_history (user_id, entry_id, added_at);
CREATE FUNCTION public.record_daily_value_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE delta numeric;
BEGIN
  IF NOT NEW.is_avulsa THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN delta := NEW.amount;
  ELSE delta := NEW.amount - OLD.amount;
  END IF;
  IF delta <> 0 THEN
    INSERT INTO public.daily_value_history (user_id, entry_id, amount)
    VALUES (NEW.user_id, NEW.id, delta);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_daily_value_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER record_daily_value_change AFTER INSERT OR UPDATE OF amount ON public.entries FOR EACH ROW EXECUTE FUNCTION public.record_daily_value_change();
COMMENT ON TABLE public.daily_value_history IS 'Dated amount changes for daily accounts from deployment onward; existing monthly totals remain unchanged and their historical dates are not inferred.';