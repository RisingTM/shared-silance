-- Add columns to profiles for last seen presence and Quran completion count
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_last_seen BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS quran_completions INTEGER NOT NULL DEFAULT 0;