-- ============================================================
-- More question types: true_false, rating, slide
-- ============================================================
-- true_false: simple yes/no question. Reuses answer_options under
--             the hood (the editor auto-creates two: "נכון"/"לא נכון").
-- rating:     1–5 scale. Players submit answer_data { rating: int }.
-- slide:      info-only slide with no interaction.
-- ============================================================

alter type question_type add value if not exists 'true_false';
alter type question_type add value if not exists 'rating';
alter type question_type add value if not exists 'slide';
