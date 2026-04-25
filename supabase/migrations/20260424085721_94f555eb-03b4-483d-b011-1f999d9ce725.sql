-- 1. Journeys: precise NC start timestamp + pause state
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS nc_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_total_seconds bigint NOT NULL DEFAULT 0;

UPDATE public.journeys
SET nc_start_at = (nc_start_date::timestamp) AT TIME ZONE 'UTC'
WHERE nc_start_at IS NULL;

-- 2. nc_breaks: support pause/resume entries
ALTER TABLE public.nc_breaks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'reset';

ALTER TABLE public.nc_breaks
  ALTER COLUMN broken_by DROP NOT NULL;

-- 3. Deen tables: allow partner read-only access
CREATE POLICY "partner read deen_prayers" ON public.deen_prayers
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());

CREATE POLICY "partner read deen_quran" ON public.deen_quran
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());

CREATE POLICY "partner read deen_quran_log" ON public.deen_quran_log
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());

CREATE POLICY "partner read deen_athkar" ON public.deen_athkar
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());

CREATE POLICY "partner read deen_dhikr" ON public.deen_dhikr
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());

CREATE POLICY "partner read deen_fasting" ON public.deen_fasting
  FOR SELECT TO authenticated
  USING (user_id = public.partner_user_id());