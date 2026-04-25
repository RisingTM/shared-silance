
-- Helper: is current user the owner of their journey?
CREATE OR REPLACE FUNCTION public.is_journey_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner'
  )
$$;

-- 1. Us password on journeys
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS us_password_hash text;

-- 2. Gallery
CREATE TABLE public.us_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.us_albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_albums select" ON public.us_albums FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id() AND (is_shared OR owner_id = auth.uid()));
CREATE POLICY "us_albums insert" ON public.us_albums FOR INSERT TO authenticated
  WITH CHECK (journey_id = public.current_journey_id() AND owner_id = auth.uid());
CREATE POLICY "us_albums update" ON public.us_albums FOR UPDATE TO authenticated
  USING (journey_id = public.current_journey_id() AND (owner_id = auth.uid() OR public.is_journey_owner()));
CREATE POLICY "us_albums delete" ON public.us_albums FOR DELETE TO authenticated
  USING (journey_id = public.current_journey_id() AND (owner_id = auth.uid() OR public.is_journey_owner()));

CREATE TABLE public.us_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  album_id uuid REFERENCES public.us_albums(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.us_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "us_photos select" ON public.us_photos FOR SELECT TO authenticated
  USING (
    journey_id = public.current_journey_id()
    AND (
      album_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.us_albums a
        WHERE a.id = us_photos.album_id
          AND a.journey_id = public.current_journey_id()
          AND (a.is_shared OR a.owner_id = auth.uid())
      )
    )
  );
CREATE POLICY "us_photos insert" ON public.us_photos FOR INSERT TO authenticated
  WITH CHECK (
    journey_id = public.current_journey_id()
    AND uploader_id = auth.uid()
    AND (
      album_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.us_albums a
        WHERE a.id = us_photos.album_id
          AND a.journey_id = public.current_journey_id()
          AND (a.is_shared OR a.owner_id = auth.uid())
      )
    )
  );
CREATE POLICY "us_photos update" ON public.us_photos FOR UPDATE TO authenticated
  USING (journey_id = public.current_journey_id() AND (uploader_id = auth.uid() OR public.is_journey_owner()));
CREATE POLICY "us_photos delete" ON public.us_photos FOR DELETE TO authenticated
  USING (journey_id = public.current_journey_id() AND (uploader_id = auth.uid() OR public.is_journey_owner()));

-- 3. Habits
CREATE TABLE public.us_habit_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  journey_id uuid NOT NULL,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.us_habit_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_sections select" ON public.us_habit_sections FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "habit_sections insert" ON public.us_habit_sections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = public.current_journey_id());
CREATE POLICY "habit_sections update" ON public.us_habit_sections FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "habit_sections delete" ON public.us_habit_sections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.us_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  journey_id uuid NOT NULL,
  section_id uuid REFERENCES public.us_habit_sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','visible','shared')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.us_habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits select" ON public.us_habits FOR SELECT TO authenticated
  USING (
    journey_id = public.current_journey_id()
    AND (user_id = auth.uid() OR visibility IN ('visible','shared'))
  );
CREATE POLICY "habits insert" ON public.us_habits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = public.current_journey_id());
CREATE POLICY "habits update" ON public.us_habits FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "habits delete" ON public.us_habits FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.us_habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES public.us_habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  days boolean[] NOT NULL DEFAULT ARRAY[false,false,false,false,false,false,false],
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, user_id, week_start)
);
ALTER TABLE public.us_habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs select" ON public.us_habit_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.us_habits h
      WHERE h.id = us_habit_logs.habit_id
        AND h.journey_id = public.current_journey_id()
        AND h.visibility IN ('visible','shared')
    )
  );
CREATE POLICY "habit_logs insert" ON public.us_habit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "habit_logs update" ON public.us_habit_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "habit_logs delete" ON public.us_habit_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Studying
CREATE TABLE public.us_syllabus (
  journey_id uuid PRIMARY KEY,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.us_syllabus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "syllabus select" ON public.us_syllabus FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "syllabus insert" ON public.us_syllabus FOR INSERT TO authenticated
  WITH CHECK (journey_id = public.current_journey_id() AND public.is_journey_owner());
CREATE POLICY "syllabus update" ON public.us_syllabus FOR UPDATE TO authenticated
  USING (journey_id = public.current_journey_id() AND public.is_journey_owner());
CREATE POLICY "syllabus delete" ON public.us_syllabus FOR DELETE TO authenticated
  USING (journey_id = public.current_journey_id() AND public.is_journey_owner());

CREATE TABLE public.us_syllabus_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL,
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  rating int NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (journey_id, user_id, item_key)
);
ALTER TABLE public.us_syllabus_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings select" ON public.us_syllabus_ratings FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());
CREATE POLICY "ratings insert" ON public.us_syllabus_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = public.current_journey_id());
CREATE POLICY "ratings update" ON public.us_syllabus_ratings FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ratings delete" ON public.us_syllabus_ratings FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. Storage bucket for gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('us-gallery', 'us-gallery', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: paths are <journey_id>/<uuid>.<ext>
CREATE POLICY "us-gallery read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'us-gallery' AND (storage.foldername(name))[1] = public.current_journey_id()::text);
CREATE POLICY "us-gallery insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'us-gallery' AND (storage.foldername(name))[1] = public.current_journey_id()::text);
CREATE POLICY "us-gallery delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'us-gallery' AND (storage.foldername(name))[1] = public.current_journey_id()::text);
