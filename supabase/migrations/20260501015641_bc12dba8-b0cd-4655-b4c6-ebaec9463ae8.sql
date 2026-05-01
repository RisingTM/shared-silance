CREATE TABLE public.us_favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.us_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favourites select"
  ON public.us_favourites
  FOR SELECT TO authenticated
  USING (journey_id = public.current_journey_id());

CREATE POLICY "favourites insert"
  ON public.us_favourites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = public.current_journey_id());

CREATE POLICY "favourites update"
  ON public.us_favourites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "favourites delete"
  ON public.us_favourites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_us_favourites_journey_created ON public.us_favourites (journey_id, created_at DESC);