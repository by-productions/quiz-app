-- ============================================================
-- Add image support to questions and answer options
-- ============================================================
-- Adds nullable image_url columns to questions and answer_options,
-- plus a public Supabase Storage bucket 'quiz-images' and open
-- RLS policies for the MVP (anonymous upload/read/delete).
-- ============================================================

alter table public.questions add column if not exists image_url text;
alter table public.answer_options add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-images',
  'quiz-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Public read quiz-images"
  on storage.objects for select
  to public
  using (bucket_id = 'quiz-images');

create policy "Public upload quiz-images"
  on storage.objects for insert
  to public
  with check (bucket_id = 'quiz-images');

create policy "Public delete quiz-images"
  on storage.objects for delete
  to public
  using (bucket_id = 'quiz-images');
