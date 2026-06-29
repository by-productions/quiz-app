-- ============================================================
-- Replace Andembry quiz questions with the 20 from the event script.
-- Correct answers confirmed by the client. Run in the Supabase SQL editor.
-- Idempotent: clears the quiz's questions (cascades to options + responses)
-- and re-seeds these 20 in order.
-- ============================================================
do $$
declare
  v_quiz_id constant uuid := 'beac6589-bea0-4e0d-9000-000000000001';
  v_q_id uuid;
begin
  delete from public.questions where quiz_id = v_quiz_id;

  -- Q1
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'איזה סימן קליני תומך באנגיואדמה תורשתית ולא באנגיואדמה אלרגית?', 'multiple_choice', 0, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'אורטיקריה מגרדת', false, 0),
    (v_q_id, 'בצקות חוזרות ללא אורטיקריה', true , 1),
    (v_q_id, 'תגובה מהירה לאנטיהיסטמינים', false, 2),
    (v_q_id, 'ברונכוספזם', false, 3);

  -- Q2
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מה נכון לגבי אסטרוגן ואנגיואדמה תורשתית?', 'multiple_choice', 1, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'תמיד משפר התקפים', false, 0),
    (v_q_id, 'עלול להחמיר התקפים בחלק מהמטופלות', true , 1),
    (v_q_id, 'אינו קשור למחלה', false, 2),
    (v_q_id, 'משמש טיפול מניעתי', false, 3);

  -- Q3
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'בחולה עם אנגיואדמה תורשתית טייפ 1 נמצאה מוטציה הגורמת להיעדר כמעט מוחלט של C1-INHIBITOR. למרות זאת, במהלך מעקב של שנים החולה סובל ממספר קטן יחסית של התקפים. מהו ההסבר הסביר ביותר?', 'multiple_choice', 2, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'רמת C4 מנבאת באופן מלא את חומרת המחלה', false, 0),
    (v_q_id, 'קיימים גורמים גנטיים ומודולטורים נוספים המשפיעים על יצירת ברדיקינין', true , 1),
    (v_q_id, 'רמת C1-INHIBITOR אינה קשורה כלל למחלה', false, 2),
    (v_q_id, 'חומרת המחלה נקבעת רק על ידי רמת אסטרוגן', false, 3),
    (v_q_id, 'לכל החולים עם אותה מוטציה פנוטיפ זהה', false, 4);

  -- Q4
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מטופל בן 35 עם בצקות חוזרות בפנים ובגפיים מאז גיל ההתבגרות, מלוות לעיתים בכאבי בטן עזים, ללא אורטיקריה. לאחיו ולאביו תלונות דומות. מהו דפוס ההורשה הצפוי במחלה זו?', 'multiple_choice', 3, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'אוטוזומלי רצסיבי', false, 0),
    (v_q_id, 'אוטוזומלי דומיננטי', true , 1),
    (v_q_id, 'תורשה תלוית X', false, 2),
    (v_q_id, 'תורשה מיטוכונדריאלית', false, 3);

  -- Q5
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'איזה מהמנגנונים הבאים הוא הייחודי ביותר ל-HAE-ANGPT1 (אנגיופויטין) בהשוואה לשאר סוגי HAE?', 'multiple_choice', 4, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'יצירת ברדיקינין מוגברת', false, 0),
    (v_q_id, 'פגיעה ישירה ביציבות מחסום האנדותל', true , 1),
    (v_q_id, 'חסר תפקודי ב-C1 inhibitor', false, 2),
    (v_q_id, 'הפעלת mast cells', false, 3),
    (v_q_id, 'עלייה בטריפטאז', false, 4);

  -- Q6
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'אישה בת 20 ממוצא יהודי-מרוקאי עם היסטוריה של מספר שנים של כאבי בטן ממושכים חוזרים, ובצקות חוזרות בפנים, בשפתיים, בלשון ובגפיים — ללא פריחה או גירוד. מהי הבדיקה שתאשר את האבחנה?', 'multiple_choice', 5, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'רמות C1q', false, 0),
    (v_q_id, 'רמת טריפטאז', false, 1),
    (v_q_id, 'בדיקה גנטית (WES)', true , 2),
    (v_q_id, 'DDM', false, 3);

  -- Q7
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מה נכון לגבי אנגיואדמה נרכשת (AAE)?', 'multiple_choice', 6, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'לרוב אינה מגיבה לטיפולים on demand בתרכיז האנזים C1E, בגלל שהבעיה אינה חוסר מולד שלו', false, 0),
    (v_q_id, 'לרוב אינה מגיבה לטיפול באיקטיבנט', false, 1),
    (v_q_id, 'אין צורך בטיפול נוסף ברגע שהמחלה היסודית מקבלת מענה', false, 2),
    (v_q_id, 'לא נערכו מחקרים שבחנו נתוני יעילות ובטיחות של טיפולי מניעה מתקדמים במקרים של אנגיואדמה נרכשת', true , 3);

  -- Q8
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'אישה צעירה עם HAE-FXII מבקשת ייעוץ בבחירת אמצעי מניעה. איזה אמצעי מניעה מתאים לה ביותר?', 'multiple_choice', 7, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'גלולות משולבות (אסטרוגן + פרוגסטין)', false, 0),
    (v_q_id, 'קונדום', false, 1),
    (v_q_id, 'אמצעי מניעה מבוסס פרוגסטין בלבד או התקן תוך-רחמי', true , 2),
    (v_q_id, 'מדבקת אסטרוגן טרנסדרמלית', false, 3);

  -- Q9
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'נשים עם אנגיואדמה תורשתית (מכל התתי-סוגים) סובלות לעיתים קרובות מהחמרה דרמטית בתדירות ובעוצמת ההתקפים בתקופות מסוימות בחיים. מהו המנגנון ההורמונלי המרכזי שמסביר תופעה זו?', 'multiple_choice', 8, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'אסטרוגן מגביר את יצירת הקאלקרין דרך ה-⁦heat-shock protein 90⁩', true , 0),
    (v_q_id, 'רמות גבוהות של פרוגסטרון מעכבות ישירות את שעתוק הגן SERPING1', false, 1),
    (v_q_id, 'הורמון ה-LH (Luteinizing hormone) נקשר לקולטני ברדיקינין ומפעיל אותם בצורה צולבת', false, 2),
    (v_q_id, 'פרולקטין גורם לירידה חדה בייצור המשלים בכבד במהלך תקופת ההנקה בלבד', false, 3);

  -- Q10
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מטופל עם אנגיואדמה תורשתית מסוג 1 מטופל באופן קבוע במעכבי קליקראין למניעה. הוא מגיע לחדר מיון עקב אוטם שריר הלב ועובר צנתור דחוף. במהלך הפרוצדורה מוחלט לתת לו מעכב תחרותי של תרומבין (הפרין). מה עשויה להיות ההשפעה של חוסר ב-C1-INH על חולה זה?', 'multiple_choice', 9, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'החולה נמצא בסיכון מוגבר משמעותית לדימומים ספונטניים עקב חוסר היכולת להפעיל את פקטור 11', false, 0),
    (v_q_id, 'הפרין יכול להפעיל את פקטור 12 כך שתיאורטית עלול להגביר יצור ברדיקינין, אך לא נמצאה לכך עדות קלינית', true , 1),
    (v_q_id, 'מערכת הקרישה של חולי HAE מושבתת לחלוטין ולכן הם מוגנים באופן מוחלט מפני אוטם שריר הלב', false, 2),
    (v_q_id, 'ההפרין ינטרל את ההשפעה של הברדיקינין ובכך ירפא את האנגיואדמה לצמיתות', false, 3);

  -- Q11
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מתי יש לשקול טיפול מניעתי לפי ההנחיות?', 'multiple_choice', 10, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'רק אחרי אשפוז בטיפול נמרץ', false, 0),
    (v_q_id, 'בכל ביקור, לפי נטל המחלה והעדפת המטופל', true , 1),
    (v_q_id, 'רק אם יש התקף שבועי', false, 2),
    (v_q_id, 'רק בילדים', false, 3);

  -- Q12
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'האם מטופל שמקבל טיפול מניעתי עדיין יזדקק לטיפול קצר טווח לפני פרוצדורות?', 'multiple_choice', 11, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'תלוי בסוג הפעולה הרפואית', false, 0),
    (v_q_id, 'לא כי מרבית הפעולות אינן גורמות להתקף', false, 1),
    (v_q_id, 'כן, כי אין מספיק מידע לגבי יעילות תרופות המניעה בזמן פרוצדורות העלולות לעורר התקף', true , 2),
    (v_q_id, 'לא, כי טיפול מניעתי מכסה גם פעולות העלולות לעורר התקף', false, 3);

  -- Q13
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהי ההמלצה לגבי טיפול אקוטי (on demand) גם בחולים על טיפול מניעתי?', 'multiple_choice', 12, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'אין צורך בטיפול אקוטי', false, 0),
    (v_q_id, 'יש לשאת טיפול אקוטי זמין', true , 1),
    (v_q_id, 'להשתמש רק בסטרואידים', false, 2),
    (v_q_id, 'להגיע תמיד למיון לפני טיפול', false, 3);

  -- Q14
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהם השיקולים העיקריים למעבר מטיפול מניעתי קיים לטיפול מניעתי חדש?', 'multiple_choice', 13, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'איזון בין שליטה קיימת, העומס הטיפולי והעדפת המטופל', true , 0),
    (v_q_id, 'תדירות מתן הטיפול החדש', false, 1),
    (v_q_id, 'גיל המטופל', false, 2),
    (v_q_id, 'סוג ותדירות ההתקפים', false, 3);

  -- Q15
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מה ייחודי במנגנון הפעולה של עיכוב FXIIa לעומת הטיפולים הקיימים?', 'multiple_choice', 14, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'טיפול אקוטי בלבד', false, 0),
    (v_q_id, 'מתן תוך־ורידי בלבד', false, 1),
    (v_q_id, 'טיפול המעכב את סוף מסלול המחלה', false, 2),
    (v_q_id, 'טיפול המעכב את תחילת מסלול המחלה (מערכת המגע)', true , 3);

  -- Q16
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו מנגנון הפעולה המרכזי של אנדמברי?', 'multiple_choice', 15, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'עיכוב האנזים kallikrein', false, 0),
    (v_q_id, 'עיכוב bradykinin receptor', false, 1),
    (v_q_id, 'עיכוב activated Factor XIIa', true , 2),
    (v_q_id, 'חידוש מלאי C1-INH', false, 3);

  -- Q17
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהם היתרונות של מתן אנדמברי בטיפול מניעתי?', 'multiple_choice', 16, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'מתן חד-חודשי באמצעות עט אוטומטי המקל על הטיפול ומאפשר פחות עומס טיפולי', false, 0),
    (v_q_id, 'השפעה מהירה (early onset) ונתוני יעילות ובטיחות מוכחים', false, 1),
    (v_q_id, 'מנגנון פעולה ייחודי המטרגט את F12a הממוקם בתחילת מסלול המחלה', false, 2),
    (v_q_id, 'כל התשובות נכונות', true , 3);

  -- Q18
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו הנתון המשמעותי הראשון מבחינת ריסון התקפי המחלה שעלה במחקרי garadacimab?', 'multiple_choice', 17, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'לכל החולים היו התקפים', false, 0),
    (v_q_id, 'נמצא שרק 15% היו חופשיים מהתקפים', false, 1),
    (v_q_id, 'הפחתה של 95% מהתקפים (חציון) בהשוואה לתקופה לפני הטיפול', true , 2),
    (v_q_id, 'הפחתה של 50% מהתקפים (חציון) בהשוואה לתקופה לפני הטיפול', false, 3);

  -- Q19
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מהו הנתון המשמעותי השני מבחינת ריסון התקפי המחלה?', 'multiple_choice', 18, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'לכל החולים היו התקפים', false, 0),
    (v_q_id, 'כ־62% מהמטופלים ב־garadacimab היו חופשיים מהתקפים בכל תקופת הטיפול', true , 1),
    (v_q_id, 'רק 5% חופשיים מהתקפים', false, 2),
    (v_q_id, 'הנתון לא נבדק', false, 3);

  -- Q20
  insert into public.questions (quiz_id, question_text, type, position, time_limit)
  values (v_quiz_id, 'מטופלת עם אנגיואדמה תורשתית המקבלת טיפול מניעתי מדווחת שעד כה סבלה מצריבה וכאב באתר ההזרקה עם הטיפול המניעתי הקודם, וכי המעבר לאנדמברי הקל עליה משמעותית בהיבט זה. מהו המאפיין של פורמולציית אנדמברי שמסביר את ההבדל?', 'multiple_choice', 19, 30) returning id into v_q_id;
  insert into public.answer_options (question_id, text, is_correct, position) values
    (v_q_id, 'הפורמולציה נטולת ציטראט (citrate-free), מה שמפחית כאב וצריבה באתר ההזרקה', true , 0),
    (v_q_id, 'הטיפול ניתן תוך-ורידי ולכן אין תגובות מקומיות כלל', false, 1),
    (v_q_id, 'הפורמולציה מכילה הרדמה מקומית (לידוקאין) המובנית במזרק', false, 2),
    (v_q_id, 'הזרקה איטית על פני מספר דקות מפחיתה את הצריבה', false, 3);
end;
$$;
