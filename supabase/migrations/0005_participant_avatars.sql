-- ============================================================
-- Add avatar_url to participants
-- ============================================================
-- Participants can optionally take a selfie after joining. The
-- URL points to an object in the existing quiz-images bucket
-- (avatars/ prefix) and is displayed on host screens, in
-- response cards, and on the upcoming leaderboard.
-- ============================================================

alter table public.participants add column if not exists avatar_url text;
