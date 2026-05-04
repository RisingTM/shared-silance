
-- Study sessions
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subject_key TEXT,
  subject_name TEXT,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_sessions select" ON public.study_sessions FOR SELECT TO authenticated USING (journey_id = current_journey_id());
CREATE POLICY "study_sessions insert" ON public.study_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND journey_id = current_journey_id());
CREATE POLICY "study_sessions update" ON public.study_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "study_sessions delete" ON public.study_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_study_sessions_journey_started ON public.study_sessions(journey_id, started_at DESC);

-- Study syllabus (one per journey)
CREATE TABLE public.study_syllabus (
  journey_id UUID PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.study_syllabus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_syllabus select" ON public.study_syllabus FOR SELECT TO authenticated USING (journey_id = current_journey_id());
CREATE POLICY "study_syllabus insert" ON public.study_syllabus FOR INSERT TO authenticated WITH CHECK (journey_id = current_journey_id() AND is_journey_owner());
CREATE POLICY "study_syllabus update" ON public.study_syllabus FOR UPDATE TO authenticated USING (journey_id = current_journey_id() AND is_journey_owner());
CREATE POLICY "study_syllabus delete" ON public.study_syllabus FOR DELETE TO authenticated USING (journey_id = current_journey_id() AND is_journey_owner());

-- Study ratings
CREATE TABLE public.study_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('not_started','in_progress','confident')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, user_id, item_key)
);
ALTER TABLE public.study_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_ratings select" ON public.study_ratings FOR SELECT TO authenticated USING (journey_id = current_journey_id());
CREATE POLICY "study_ratings insert" ON public.study_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND journey_id = current_journey_id());
CREATE POLICY "study_ratings update" ON public.study_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "study_ratings delete" ON public.study_ratings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Study achievements
CREATE TABLE public.study_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, user_id, achievement_key)
);
ALTER TABLE public.study_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "study_achievements select" ON public.study_achievements FOR SELECT TO authenticated USING (journey_id = current_journey_id());
CREATE POLICY "study_achievements insert" ON public.study_achievements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND journey_id = current_journey_id());
CREATE POLICY "study_achievements delete" ON public.study_achievements FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Profile defaults for timer
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS study_session_duration_default INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS study_break_duration_default INTEGER NOT NULL DEFAULT 20;
