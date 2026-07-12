// Seed the 5 poll questions for the gynaeco-oncology forum (GSK).
// POLL mode: no correct answer — every option is is_correct=false; the app
// just shows the distribution of votes.
//   node scripts/seed-gsk-questions.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const QUIZ_ID = "beac6589-bea0-4e0d-9000-000000000001";
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const QUESTIONS = [
  {
    q: "בת 69 עם סרטן רירית הרחם מסוג endometrioid endometrial cancer בשלב FIGO IIIC1 השלימה ניתוח, אך בדיקת דימות מראה נגע אגני מדיד במיקום של בלוטת לימפה שאינו ניתן לכריתה. הגידול הוא dMMR (אובדן של MLH1/PMS2). איזו אפשרות טיפול יש להציע למטופלת?",
    opts: [
      "כימותרפיה בלבד",
      "כימותרפיה + אימונותרפיה עם פוטנציאל לטיפול קרינתי נוסף",
      "טיפול קרינתי בלבד",
      "כימותרפיה + אימונותרפיה ללא טיפול קרינתי נוסף",
    ],
  },
  {
    q: "אישה בת 58 עברה ניתוח לכריתת רחם, שחלות ובלוטות אגן עקב סרטן רירית הרחם. בבדיקה הפתולוגית נמצאו גורמי סיכון להישנות מקומית, והוחלט על טיפול משלים בקרינה לאגן. מהי המטרה העיקרית של הקרינה לאגן כטיפול משלים לאחר הניתוח?",
    opts: [
      "להקטין את הגידול הראשוני לפני הניתוח",
      "להפחית את הסיכון להישנות מקומית או אזורית של המחלה",
      "לטפל בגרורות מרוחקות בריאות ובכבד",
      "לשפר את יעילות הכימותרפיה בלבד ללא השפעה על הישנות המחלה",
    ],
  },
  {
    q: "כיצד להערכתך ייראה בסיס קבלת ההחלטות הטיפוליות באונקולוגיה בעוד כחמש שנים?",
    opts: [
      "מהפכה מולקולרית מלאה",
      "ההיסטולוגיה תישאר המלכה",
      "גישה היברידית משולבת",
      "אונקולוגיה מבוססת בינה מלאכותית (AI)",
    ],
  },
  {
    q: "בחולה עם סרטן רירית רחם חוזר או גרורתי מסוג pMMR מהי אסטרטגיית הטיפול המועדפת אצלכם?",
    opts: [
      "כימותרפיה + אימונותרפיה בקו הראשון, ובהמשך טיפול אחזקה באימונותרפיה",
      "כימותרפיה + דורבלומאב, ובהמשך אחזקה עם דורבלומאב + אולפריב",
      "כימותרפיה בלבד בקו הראשון, ושמירת פמברוליזומאב + לנבטיניב למחלה מתקדמת לאחר מכן",
      "התאמת האסטרטגיה לפי מאפיינים מולקולריים וקליניים של המטופלת והגידול",
    ],
  },
  {
    q: "אישה בת 58 אובחנה עם סרטן רירית הרחם. בניתוח STAGING התקבלו הנתונים: Grade 2, Deep myometrial invasion, שתי בלוטות סנטינל אגניות חיוביות, ללא מחלה שיורית, ומוטציה פתוגנית ב-POLE. איזה טיפול אדג'ובנטי היית מציע/ה לה?",
    opts: [
      "כימותרפיה + הקרנות",
      "הקרנות בלבד",
      "כימותרפיה בלבד",
      "הפחתת טיפול במסגרת מחקר",
      "אני לא בטוח/ה — המידע עד כה אינו מספק",
    ],
  },
];

if (QUESTIONS.length !== 5) process.exit(1);
if (process.env.EMIT_JSON) {
  console.log(JSON.stringify(QUESTIONS));
  process.exit(0);
}

// Rename the quiz for this event (internal/admin label).
await supabase
  .from("quizzes")
  .update({ title: "פורום דרום גינקואונקולוגי — סקר" })
  .eq("id", QUIZ_ID);

const { error: delErr } = await supabase
  .from("questions")
  .delete()
  .eq("quiz_id", QUIZ_ID);
if (delErr) {
  console.error("delete failed:", delErr);
  process.exit(1);
}
console.log("deleted old questions");

for (let i = 0; i < QUESTIONS.length; i++) {
  const item = QUESTIONS[i];
  const { data: q, error: qErr } = await supabase
    .from("questions")
    .insert({
      quiz_id: QUIZ_ID,
      question_text: item.q,
      type: "multiple_choice",
      position: i,
      time_limit: 30,
    })
    .select()
    .single();
  if (qErr) {
    console.error(`Q${i + 1} insert failed:`, qErr);
    process.exit(1);
  }
  // Poll: no correct answer.
  const opts = item.opts.map((t, idx) => ({
    question_id: q.id,
    text: t,
    is_correct: false,
    position: idx,
  }));
  const { error: oErr } = await supabase.from("answer_options").insert(opts);
  if (oErr) {
    console.error(`Q${i + 1} options insert failed:`, oErr);
    process.exit(1);
  }
  console.log(`Q${i + 1}: ${item.opts.length} opts (poll)`);
}
console.log("✅ seeded 5 poll questions");
