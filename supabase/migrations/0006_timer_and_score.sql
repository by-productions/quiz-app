-- ============================================================
-- Timer + scoring infrastructure
-- ============================================================
-- question_started_at  — timestamp set by the host when the
--                       current question becomes active; clients
--                       use it to render a synchronized countdown
--                       and the host uses it to auto-advance.
-- score                 — cumulative score per participant, used by
--                       the leaderboard. Updated by the host when
--                       transitioning a question into showing_results.
-- ============================================================

alter table public.game_sessions
  add column if not exists question_started_at timestamptz;

alter table public.participants
  add column if not exists score int not null default 0;
