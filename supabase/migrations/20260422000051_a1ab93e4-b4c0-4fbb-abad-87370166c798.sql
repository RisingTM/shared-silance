-- ===== Existing table additions =====
ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS talking_since date,
  ADD COLUMN IF NOT EXISTS allow_private_deletes boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS counter_label text NOT NULL DEFAULT 'Days of no contact',
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS push_endpoint text,
  ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT false;
-- must_set_password already exists on profiles per current schema; skip.

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS encrypted_body text,
  ADD COLUMN IF NOT EXISTS iv text;

ALTER TABLE public.unsent_thoughts
  ADD COLUMN IF NOT EXISTS encrypted_body text,
  ADD COLUMN IF NOT EXISTS iv text;

-- ===== push_subscriptions =====
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own push select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own push insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own push update" ON public.push_subscriptions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own push delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== checkin_miss_log =====
CREATE TABLE IF NOT EXISTS public.checkin_miss_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  missed_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkin_miss_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own miss select" ON public.checkin_miss_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own miss insert" ON public.checkin_miss_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own miss delete" ON public.checkin_miss_log
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== personal_duas =====
CREATE TABLE IF NOT EXISTS public.personal_duas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_duas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own dua select" ON public.personal_duas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own dua insert" ON public.personal_duas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own dua update" ON public.personal_duas
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own dua delete" ON public.personal_duas
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== thinking_pings =====
CREATE TABLE IF NOT EXISTS public.thinking_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.thinking_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ping sender or receiver select" ON public.thinking_pings
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "own ping insert" ON public.thinking_pings
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "own ping delete" ON public.thinking_pings
  FOR DELETE TO authenticated USING (sender_id = auth.uid());