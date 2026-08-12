-- 1. Enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.entry_kind AS ENUM ('despesa', 'receita');
CREATE TYPE public.entry_status AS ENUM ('pendente', 'pago');

-- 2. Profiles table
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text,
    notify_email text,
    whatsapp text,
    notify_days_before integer NOT NULL DEFAULT 3,
    notify_enabled boolean NOT NULL DEFAULT true,
    notify_health boolean NOT NULL DEFAULT true,
    notify_hour integer NOT NULL DEFAULT 8,
    health_days_before integer NOT NULL DEFAULT 1,
    notify_whatsapp boolean NOT NULL DEFAULT false,
    email_subject_tpl text,
    email_body_tpl text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON public.profiles
    FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Categories table
CREATE TABLE public.categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind public.entry_kind NOT NULL DEFAULT 'despesa',
    color text NOT NULL DEFAULT '#64748b',
    icon text NOT NULL DEFAULT 'Tag',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX categories_user_idx ON public.categories(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories" ON public.categories
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Entries table
CREATE TABLE public.entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0,
    due_date date NOT NULL,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    kind public.entry_kind NOT NULL DEFAULT 'despesa',
    status public.entry_status NOT NULL DEFAULT 'pendente',
    paid_at date,
    notes text,
    attachment_path text,
    barcode text,
    series_id uuid,
    is_recurring boolean NOT NULL DEFAULT false,
    recurrence_interval_months integer NOT NULL DEFAULT 1,
    recurrence_unit text NOT NULL DEFAULT 'mes' CHECK (recurrence_unit IN ('mes', 'semana')),
    installment_no integer,
    installment_total integer,
    is_avulsa boolean NOT NULL DEFAULT false,
    month_ref text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX entries_user_due_idx ON public.entries(user_id, due_date);
CREATE INDEX entries_avulsa_idx ON public.entries (user_id, series_id, month_ref) WHERE is_avulsa;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO authenticated;
GRANT ALL ON public.entries TO service_role;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entries" ON public.entries
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Health Events table
CREATE TABLE public.health_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE POLICY "Users can manage their own health events" ON public.health_events
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Notification Log table
CREATE TABLE public.notification_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind text NOT NULL,
    ref_date date NOT NULL,
    channel text NOT NULL DEFAULT 'email',
    status text NOT NULL DEFAULT 'enviado',
    detail text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, kind, ref_date, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification log" ON public.notification_log
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notification log" ON public.notification_log
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Triggers and Functions
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER entries_touch BEFORE UPDATE ON public.entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER health_events_touch BEFORE UPDATE ON public.health_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER notification_log_touch BEFORE UPDATE ON public.notification_log FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.categories (user_id, name, kind, color, icon)
    VALUES 
        (NEW.id,'Água','despesa','#38bdf8','Droplet'),
        (NEW.id,'Luz','despesa','#facc15','Zap'),
        (NEW.id,'Internet','despesa','#818cf8','Wifi'),
        (NEW.id,'Convênio','despesa','#f472b6','HeartPulse'),
        (NEW.id,'Hotel','despesa','#fb923c','BedDouble'),
        (NEW.id,'Prestação de carro','despesa','#22d3ee','Car'),
        (NEW.id,'IPVA','despesa','#f87171','ReceiptText'),
        (NEW.id,'IPTU','despesa','#a78bfa','Home'),
        (NEW.id,'Consórcio','despesa','#34d399','Landmark'),
        (NEW.id,'Mercado','despesa','#4ade80','ShoppingCart'),
        (NEW.id,'Empregada','despesa','#f0abfc','Sparkles'),
        (NEW.id,'Combustível','despesa','#fbbf24','Fuel'),
        (NEW.id,'Salário','receita','#22c55e','Wallet'),
        (NEW.id,'Outras receitas','receita','#14b8a6','TrendingUp');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
