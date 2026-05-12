-- ============================================================
-- Quiz App — Initial Schema
-- Run ONCE on a fresh Supabase project, in the SQL Editor.
-- ============================================================

-- Enums
create type question_type as enum ('multiple_choice', 'free_response', 'poll', 'ranking');
create type session_state as enum ('waiting', 'question_active', 'showing_results', 'ended');

-- ============================================================
-- Tables
-- ============================================================

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  design_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  type question_type not null default 'multiple_choice',
  position int not null default 0,
  time_limit int,
  created_at timestamptz not null default now()
);
create index questions_quiz_id_position_idx on public.questions(quiz_id, position);

create table public.answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index answer_options_question_id_position_idx on public.answer_options(question_id, position);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  join_code text not null unique,
  state session_state not null default 'waiting',
  current_question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index game_sessions_quiz_id_idx on public.game_sessions(quiz_id);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  nickname text not null,
  joined_at timestamptz not null default now()
);
create index participants_session_id_idx on public.participants(session_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_data jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, participant_id, question_id)
);
create index responses_session_question_idx on public.responses(session_id, question_id);

-- ============================================================
-- Row Level Security
-- Open policies for MVP — we'll tighten with auth in a later step.
-- ============================================================

alter table public.quizzes        enable row level security;
alter table public.questions      enable row level security;
alter table public.answer_options enable row level security;
alter table public.game_sessions  enable row level security;
alter table public.participants   enable row level security;
alter table public.responses      enable row level security;

create policy "open access" on public.quizzes        for all using (true) with check (true);
create policy "open access" on public.questions      for all using (true) with check (true);
create policy "open access" on public.answer_options for all using (true) with check (true);
create policy "open access" on public.game_sessions  for all using (true) with check (true);
create policy "open access" on public.participants   for all using (true) with check (true);
create policy "open access" on public.responses      for all using (true) with check (true);

-- ============================================================
-- Realtime — tables that the app subscribes to for live updates
-- ============================================================

alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.responses;
alter publication supabase_realtime add table public.participants;
