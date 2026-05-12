-- ============================================================
-- Add word_cloud question type
-- ============================================================
-- Adds a new value to the question_type enum.
-- Players submit a short word/phrase; the host displays the
-- aggregated cloud sized by frequency.
-- ============================================================

alter type question_type add value if not exists 'word_cloud';
