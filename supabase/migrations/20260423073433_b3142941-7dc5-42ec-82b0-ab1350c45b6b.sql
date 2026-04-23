
-- 1. Add new status_kind enum values
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'peace';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'gentle';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'healing';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'trying';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'heavy';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'here';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'trusting';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'felt_strong';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'quiet';
ALTER TYPE public.status_kind ADD VALUE IF NOT EXISTS 'proud_you';

-- 2. Reduce status cooldown from 12h to 6h
CREATE OR REPLACE FUNCTION public.enforce_status_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE last_at TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO last_at FROM public.daily_statuses WHERE user_id = NEW.user_id;
  IF last_at IS NOT NULL AND now() - last_at < INTERVAL '6 hours' THEN
    RAISE EXCEPTION 'You can only update your status once every 6 hours';
  END IF;
  RETURN NEW;
END $function$;

-- 3. Unsent thoughts: image_path column
ALTER TABLE public.unsent_thoughts ADD COLUMN IF NOT EXISTS image_path text;

-- 4. unsent-images storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('unsent-images', 'unsent-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own unsent images select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'unsent-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own unsent images insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'unsent-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own unsent images delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'unsent-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Deen: prayer tracker (weekly, 7-day boolean array, 5 prayers)
CREATE TABLE public.deen_prayers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  prayer text NOT NULL,
  days boolean[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, prayer)
);
ALTER TABLE public.deen_prayers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_prayers all" ON public.deen_prayers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Deen: Quran current page (one row per user)
CREATE TABLE public.deen_quran (
  user_id uuid PRIMARY KEY,
  current_page integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deen_quran ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_quran all" ON public.deen_quran
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 7. Deen: Quran daily log (pages added per day)
CREATE TABLE public.deen_quran_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  pages integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deen_quran_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_quran_log all" ON public.deen_quran_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. Deen: Athkar (weekly morning/evening rows)
CREATE TABLE public.deen_athkar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  kind text NOT NULL,
  days boolean[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, kind)
);
ALTER TABLE public.deen_athkar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_athkar all" ON public.deen_athkar
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 9. Deen: Dhikr counts (one row per user per kind)
CREATE TABLE public.deen_dhikr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);
ALTER TABLE public.deen_dhikr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_dhikr all" ON public.deen_dhikr
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 10. Deen: Fasting (weekly 7-day array)
CREATE TABLE public.deen_fasting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  days boolean[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.deen_fasting ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deen_fasting all" ON public.deen_fasting
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
