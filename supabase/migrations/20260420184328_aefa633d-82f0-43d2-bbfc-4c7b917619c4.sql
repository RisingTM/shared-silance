
-- =====================================================================
-- OUR JOURNEY — full schema
-- =====================================================================

-- Enums
CREATE TYPE public.user_role AS ENUM ('owner', 'partner');
CREATE TYPE public.status_kind AS ENUM ('okay','praying','miss','strong','hard','proud');
CREATE TYPE public.broken_by AS ENUM ('him','her');

-- ---------------------------------------------------------------------
-- journeys: one row per paired bond
-- ---------------------------------------------------------------------
CREATE TABLE public.journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nc_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  has_been_reset BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- profiles: one per auth user, linked to a journey
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role public.user_role NOT NULL,
  must_set_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_journey ON public.profiles(journey_id);

-- Helper: get current user's journey id (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.current_journey_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT journey_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- daily_statuses
-- ---------------------------------------------------------------------
CREATE TABLE public.daily_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  status public.status_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_user_created ON public.daily_statuses(user_id, created_at DESC);
CREATE INDEX idx_status_journey ON public.daily_statuses(journey_id, created_at DESC);

-- 12-hour cooldown enforcement
CREATE OR REPLACE FUNCTION public.enforce_status_cooldown()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE last_at TIMESTAMPTZ;
BEGIN
  SELECT MAX(created_at) INTO last_at FROM public.daily_statuses WHERE user_id = NEW.user_id;
  IF last_at IS NOT NULL AND now() - last_at < INTERVAL '12 hours' THEN
    RAISE EXCEPTION 'You can only update your status once every 12 hours';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER status_cooldown BEFORE INSERT ON public.daily_statuses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_cooldown();

-- ---------------------------------------------------------------------
-- nc_breaks
-- ---------------------------------------------------------------------
CREATE TABLE public.nc_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES public.journeys(id) ON DELETE CASCADE,
  broken_by public.broken_by NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_breaks_journey ON public.nc_breaks(journey_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Private per-user tables
-- ---------------------------------------------------------------------

-- Why I'm Here (single editable note)
CREATE TABLE public.why_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Building Toward (single editable note)
CREATE TABLE public.building_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal entries
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_journal_user ON public.journal_entries(user_id, created_at DESC);

-- Stayed Strong log
CREATE TABLE public.strong_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_strong_user ON public.strong_moments(user_id, created_at DESC);

-- Trigger log
CREATE TABLE public.trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  what_happened TEXT NOT NULL,
  the_urge TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_triggers_user ON public.trigger_logs(user_id, created_at DESC);

-- Mood entries (one per day per user)
CREATE TABLE public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);
CREATE INDEX idx_mood_user ON public.mood_entries(user_id, entry_date DESC);

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_user ON public.goals(user_id, created_at DESC);

-- Sealed Letter (write once)
CREATE TABLE public.sealed_letters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sealed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Block updates and deletes on sealed_letters
CREATE OR REPLACE FUNCTION public.block_letter_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Sealed letters cannot be modified or deleted'; END $$;
CREATE TRIGGER sealed_letters_no_update BEFORE UPDATE ON public.sealed_letters
  FOR EACH ROW EXECUTE FUNCTION public.block_letter_change();
CREATE TRIGGER sealed_letters_no_delete BEFORE DELETE ON public.sealed_letters
  FOR EACH ROW EXECUTE FUNCTION public.block_letter_change();

-- Memory vault
CREATE TABLE public.memory_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  unlock_day INTEGER NOT NULL CHECK (unlock_day > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vault_user ON public.memory_vault(user_id, unlock_day);

-- Weekly reflections (answers keyed by ISO year-week)
CREATE TABLE public.weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_week TEXT NOT NULL, -- e.g. "2026-W16"
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year_week)
);

-- Quran & Dhikr daily
CREATE TABLE public.worship_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  pages INTEGER NOT NULL DEFAULT 0 CHECK (pages >= 0),
  adhkar INTEGER NOT NULL DEFAULT 0 CHECK (adhkar >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

-- Unsent Thoughts (text + audio entries)
CREATE TABLE public.unsent_thoughts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text','audio')),
  text_content TEXT,
  audio_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_unsent_user ON public.unsent_thoughts(user_id, created_at DESC);

-- Unlock preferences (per user, what they share with partner after 365 days)
CREATE TABLE public.unlock_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  share_why BOOLEAN NOT NULL DEFAULT FALSE,
  share_journal BOOLEAN NOT NULL DEFAULT FALSE,
  share_strong BOOLEAN NOT NULL DEFAULT FALSE,
  share_triggers BOOLEAN NOT NULL DEFAULT FALSE,
  share_mood BOOLEAN NOT NULL DEFAULT FALSE,
  share_goals BOOLEAN NOT NULL DEFAULT FALSE,
  share_letter BOOLEAN NOT NULL DEFAULT FALSE,
  share_building BOOLEAN NOT NULL DEFAULT FALSE,
  share_reflections BOOLEAN NOT NULL DEFAULT FALSE,
  share_worship BOOLEAN NOT NULL DEFAULT FALSE,
  share_unsent_text BOOLEAN NOT NULL DEFAULT FALSE,
  share_unsent_audio BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- Helper: partner user id (for shared-view RLS)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.partner_user_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p2.id FROM public.profiles p1
  JOIN public.profiles p2 ON p2.journey_id = p1.journey_id AND p2.id <> p1.id
  WHERE p1.id = auth.uid()
  LIMIT 1
$$;

-- Helper: did partner explicitly share this section
CREATE OR REPLACE FUNCTION public.partner_shares(section TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE pid UUID; row public.unlock_prefs%ROWTYPE;
BEGIN
  pid := public.partner_user_id();
  IF pid IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO row FROM public.unlock_prefs WHERE user_id = pid;
  IF NOT FOUND OR NOT row.is_unlocked THEN RETURN FALSE; END IF;
  RETURN CASE section
    WHEN 'why' THEN row.share_why
    WHEN 'journal' THEN row.share_journal
    WHEN 'strong' THEN row.share_strong
    WHEN 'triggers' THEN row.share_triggers
    WHEN 'mood' THEN row.share_mood
    WHEN 'goals' THEN row.share_goals
    WHEN 'letter' THEN row.share_letter
    WHEN 'building' THEN row.share_building
    WHEN 'reflections' THEN row.share_reflections
    WHEN 'worship' THEN row.share_worship
    WHEN 'unsent_text' THEN row.share_unsent_text
    WHEN 'unsent_audio' THEN row.share_unsent_audio
    ELSE FALSE END;
END $$;

-- =====================================================================
-- Enable RLS on everything
-- =====================================================================
ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nc_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.why_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strong_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sealed_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worship_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unsent_thoughts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_prefs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- journeys: members can see their own
CREATE POLICY "members read journey" ON public.journeys FOR SELECT TO authenticated
  USING (id = public.current_journey_id());
CREATE POLICY "members update journey" ON public.journeys FOR UPDATE TO authenticated
  USING (id = public.current_journey_id());

-- profiles: members of the same journey can read each other's basic profile;
-- only self can update
CREATE POLICY "read own profile and partner" ON public.profiles FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- daily_statuses: members of journey can read; only self can insert their own
CREATE POLICY "read journey statuses" ON public.daily_statuses FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "insert own status" ON public.daily_statuses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = public.current_journey_id());

-- nc_breaks: members read, members insert (either can reset)
CREATE POLICY "read journey breaks" ON public.nc_breaks FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "insert journey break" ON public.nc_breaks FOR INSERT TO authenticated
  WITH CHECK (journey_id = public.current_journey_id());

-- Generic owner-only policy template applied per-table
-- why_notes
CREATE POLICY "own why select" ON public.why_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('why')));
CREATE POLICY "own why upsert" ON public.why_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own why update" ON public.why_notes FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- building_notes
CREATE POLICY "own building select" ON public.building_notes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('building')));
CREATE POLICY "own building upsert" ON public.building_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own building update" ON public.building_notes FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- journal_entries
CREATE POLICY "own journal select" ON public.journal_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('journal')));
CREATE POLICY "own journal insert" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own journal update" ON public.journal_entries FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own journal delete" ON public.journal_entries FOR DELETE TO authenticated USING (user_id = auth.uid());

-- strong_moments
CREATE POLICY "own strong select" ON public.strong_moments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('strong')));
CREATE POLICY "own strong insert" ON public.strong_moments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own strong delete" ON public.strong_moments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- trigger_logs
CREATE POLICY "own triggers select" ON public.trigger_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('triggers')));
CREATE POLICY "own triggers insert" ON public.trigger_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own triggers delete" ON public.trigger_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- mood_entries
CREATE POLICY "own mood select" ON public.mood_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('mood')));
CREATE POLICY "own mood insert" ON public.mood_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own mood update" ON public.mood_entries FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- goals
CREATE POLICY "own goals select" ON public.goals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('goals')));
CREATE POLICY "own goals insert" ON public.goals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own goals update" ON public.goals FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own goals delete" ON public.goals FOR DELETE TO authenticated USING (user_id = auth.uid());

-- sealed_letters (no update/delete possible due to triggers)
CREATE POLICY "own letter select" ON public.sealed_letters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('letter')));
CREATE POLICY "own letter insert" ON public.sealed_letters FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- memory_vault (only self ever sees)
CREATE POLICY "own vault select" ON public.memory_vault FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own vault insert" ON public.memory_vault FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own vault delete" ON public.memory_vault FOR DELETE TO authenticated USING (user_id = auth.uid());

-- weekly_reflections
CREATE POLICY "own refl select" ON public.weekly_reflections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('reflections')));
CREATE POLICY "own refl insert" ON public.weekly_reflections FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own refl update" ON public.weekly_reflections FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- worship_logs
CREATE POLICY "own worship select" ON public.worship_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (user_id = public.partner_user_id() AND public.partner_shares('worship')));
CREATE POLICY "own worship insert" ON public.worship_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own worship update" ON public.worship_logs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- unsent_thoughts (text vs audio share toggles handled per row)
CREATE POLICY "own unsent select" ON public.unsent_thoughts FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id = public.partner_user_id() AND kind = 'text' AND public.partner_shares('unsent_text'))
    OR (user_id = public.partner_user_id() AND kind = 'audio' AND public.partner_shares('unsent_audio'))
  );
CREATE POLICY "own unsent insert" ON public.unsent_thoughts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own unsent delete" ON public.unsent_thoughts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- unlock_prefs: self read/write; partner can read (so UI can show "what they shared")
CREATE POLICY "self or partner unlock select" ON public.unlock_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id = public.partner_user_id());
CREATE POLICY "own unlock insert" ON public.unlock_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own unlock update" ON public.unlock_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =====================================================================
-- Storage bucket for unsent audio (private)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('unsent-audio', 'unsent-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-only on first folder = user id; partner can read if shared
CREATE POLICY "audio owner read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'unsent-audio'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (
        public.partner_user_id()::text = (storage.foldername(name))[1]
        AND public.partner_shares('unsent_audio')
      )
    )
  );
CREATE POLICY "audio owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'unsent-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "audio owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'unsent-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
