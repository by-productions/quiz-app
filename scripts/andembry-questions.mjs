// 5 questions for the "Beyond the Attack" launch quiz — a tight, representative
// mix: mechanism → trial efficacy → pathophysiology → clinical urgency → expert view.

/** @typedef {{ q: string; options: [string, string, string, string]; correct: 0|1|2|3 }} Q */

/** @type {Q[]} */
export const ANDEMBRY_QUESTIONS = [
  {
    q: "מהו מנגנון הפעולה המרכזי של garadacimab?",
    options: [
      "עיכוב kallikrein",
      "עיכוב bradykinin receptor",
      "עיכוב activated Factor XIIa",
      "תוספת C1-INH",
    ],
    correct: 2,
  },
  {
    q: "מה הייתה מסקנת מחקר VANGUARD לגבי יעילות garadacimab?",
    options: [
      "לא נמצא הבדל מול פלצבו",
      "הפחית משמעותית התקפי HAE לעומת פלצבו",
      "יעיל רק בהתקפים עוריים",
      "יעיל רק בחולים עם HAE type II",
    ],
    correct: 1,
  },
  {
    q: "מהו המתווך המרכזי בהתקפי HAE מסוג I/II?",
    options: ["היסטמין", "ברדיקינין", "IgE", "לויקוטריאנים"],
    correct: 1,
  },
  {
    q: "מהו הסיכון החמור ביותר ב־HAE?",
    options: [
      "פריחה עורית",
      "התקף גרוני עם סכנת חנק",
      "דלקת מפרקים",
      "יתר לחץ דם",
    ],
    correct: 1,
  },
  {
    q: "מהו ה-unmet need המרכזי כיום ב-HAE?",
    options: [
      "אבחון מוקדם",
      "שליטה מלאה בהתקפים",
      "איכות חיים וחרדה מהתקפים",
      "נגישות לטיפולים",
    ],
    correct: 2,
  },
];
