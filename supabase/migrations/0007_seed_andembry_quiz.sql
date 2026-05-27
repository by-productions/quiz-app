-- ============================================================
-- Seed: "Beyond the Attack" Andembry launch quiz
-- 5 hand-picked HAE / garadacimab questions, MC, 30s timer.
-- Fixed quiz UUID so the app can reference it directly.
-- Idempotent: re-running clears + re-seeds the same quiz UUID.
-- ============================================================

do $$
declare
  v_quiz_id constant uuid := 'beac6589-bea0-4e0d-9000-000000000001';
  v_q_id    uuid;
begin
  -- Clean any prior seed (cascades to questions + options)
  delete from public.quizzes where id = v_quiz_id;

  insert into public.quizzes (id, title, design_settings)
  values (
    v_quiz_id,
    'Beyond the Attack — HAE & garadacimab',
    jsonb_build_object(
      'primary', '#04b49d',
      'secondary', '#173d6e',
      'default_time_limit', 30
    )
  );

  -- ------- Q1 — Mechanism of garadacimab -------
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו מנגנון הפעולה המרכזי של garadacimab?', 'multiple_choice', 0, 30)
  returning id into v_q_id;

  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'עיכוב kallikrein',                  false, 0),
    (v_q_id, 'עיכוב bradykinin receptor',         false, 1),
    (v_q_id, 'עיכוב activated Factor XIIa',        true,  2),
    (v_q_id, 'תוספת C1-INH',                       false, 3);

  -- ------- Q2 — VANGUARD efficacy conclusion -------
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מה הייתה מסקנת מחקר VANGUARD לגבי יעילות garadacimab?', 'multiple_choice', 1, 30)
  returning id into v_q_id;

  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'לא נמצא הבדל מול פלצבו',                          false, 0),
    (v_q_id, 'הפחית משמעותית התקפי HAE לעומת פלצבו',           true,  1),
    (v_q_id, 'יעיל רק בהתקפים עוריים',                          false, 2),
    (v_q_id, 'יעיל רק בחולים עם HAE type II',                  false, 3);

  -- ------- Q3 — HAE mediator -------
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו המתווך המרכזי בהתקפי HAE מסוג I/II?', 'multiple_choice', 2, 30)
  returning id into v_q_id;

  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'היסטמין',       false, 0),
    (v_q_id, 'ברדיקינין',      true,  1),
    (v_q_id, 'IgE',           false, 2),
    (v_q_id, 'לויקוטריאנים',   false, 3);

  -- ------- Q4 — Severe risk in HAE -------
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו הסיכון החמור ביותר ב־HAE?', 'multiple_choice', 3, 30)
  returning id into v_q_id;

  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'פריחה עורית',              false, 0),
    (v_q_id, 'התקף גרוני עם סכנת חנק',    true,  1),
    (v_q_id, 'דלקת מפרקים',              false, 2),
    (v_q_id, 'יתר לחץ דם',                false, 3);

  -- ------- Q5 — Main unmet need -------
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו ה-unmet need המרכזי כיום ב-HAE?', 'multiple_choice', 4, 30)
  returning id into v_q_id;

  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'אבחון מוקדם',                     false, 0),
    (v_q_id, 'שליטה מלאה בהתקפים',              false, 1),
    (v_q_id, 'איכות חיים וחרדה מהתקפים',         true,  2),
    (v_q_id, 'נגישות לטיפולים',                  false, 3);
end;
$$;
