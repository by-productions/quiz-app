"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Quiz,
  Question,
  AnswerOption,
  QuestionType,
  DesignSettings,
} from "@/lib/types";
import { getOptionStyle, OptionShape } from "@/lib/optionStyle";
import { designStyle, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from "@/lib/design";

type QuestionWithOptions = Question & { answer_options: AnswerOption[] };

export default function QuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [design, setDesign] = useState<DesignSettings>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;
    (async () => {
      const { data: q } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();
      const { data: qs } = await supabase
        .from("questions")
        .select("*, answer_options(*)")
        .eq("quiz_id", quizId)
        .order("position");
      if (cancelled) return;
      const quizRow = (q as Quiz) ?? null;
      setQuiz(quizRow);
      setDesign(quizRow?.design_settings ?? {});
      const list = ((qs ?? []) as unknown as QuestionWithOptions[]).map(
        (qq) => ({
          ...qq,
          answer_options: [...qq.answer_options].sort(
            (a, b) => a.position - b.position,
          ),
        }),
      );
      setQuestions(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [quizId, supabase]);

  async function saveQuizTitle(title: string) {
    if (!quiz) return;
    const trimmed = title.trim() || "חידון ללא שם";
    if (quiz.title === trimmed) return;
    setQuiz({ ...quiz, title: trimmed });
    const { error: e } = await supabase
      .from("quizzes")
      .update({ title: trimmed })
      .eq("id", quiz.id);
    if (e) setError("שמירת כותרת נכשלה: " + e.message);
  }

  async function saveDesign(next: DesignSettings) {
    if (!quiz) return;
    const { error: e } = await supabase
      .from("quizzes")
      .update({ design_settings: next })
      .eq("id", quiz.id);
    if (e) setError("שמירת עיצוב נכשלה: " + e.message);
  }

  function updateDesign(patch: Partial<DesignSettings>) {
    setDesign((prev) => {
      const next = { ...prev, ...patch };
      return next;
    });
  }

  function resetDesign() {
    const next: DesignSettings = {};
    setDesign(next);
    saveDesign(next);
  }

  async function addQuestion() {
    if (!quiz) return;
    const lastPos = questions[questions.length - 1]?.position ?? -1;
    const { data: newQ, error: qErr } = await supabase
      .from("questions")
      .insert({
        quiz_id: quiz.id,
        question_text: "",
        type: "multiple_choice",
        position: lastPos + 1,
      })
      .select()
      .single();
    if (qErr || !newQ) {
      setError("שגיאה ביצירת שאלה: " + (qErr?.message ?? ""));
      return;
    }
    const { data: opts } = await supabase
      .from("answer_options")
      .insert([
        {
          question_id: (newQ as Question).id,
          text: "",
          position: 0,
          is_correct: false,
        },
        {
          question_id: (newQ as Question).id,
          text: "",
          position: 1,
          is_correct: false,
        },
      ])
      .select();
    setQuestions((prev) => [
      ...prev,
      {
        ...(newQ as Question),
        answer_options: (opts ?? []) as AnswerOption[],
      },
    ]);
  }

  async function deleteQuestion(qid: string) {
    if (!confirm("למחוק את השאלה?")) return;
    const { error: e } = await supabase
      .from("questions")
      .delete()
      .eq("id", qid);
    if (e) {
      setError("שגיאה במחיקת שאלה: " + e.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
  }

  async function saveQuestionText(qid: string, question_text: string) {
    const orig = questions.find((q) => q.id === qid);
    if (!orig || orig.question_text === question_text) return;
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, question_text } : q)),
    );
    const { error: e } = await supabase
      .from("questions")
      .update({ question_text })
      .eq("id", qid);
    if (e) setError("שמירת שאלה נכשלה: " + e.message);
  }

  async function changeQuestionType(qid: string, type: QuestionType) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qid ? { ...q, type } : q)),
    );
    const { error: e } = await supabase
      .from("questions")
      .update({ type })
      .eq("id", qid);
    if (e) setError("שינוי סוג שאלה נכשל: " + e.message);
  }

  async function addOption(qid: string) {
    const q = questions.find((qq) => qq.id === qid);
    if (!q) return;
    const lastPos =
      q.answer_options[q.answer_options.length - 1]?.position ?? -1;
    const { data, error: e } = await supabase
      .from("answer_options")
      .insert({
        question_id: qid,
        text: "",
        position: lastPos + 1,
        is_correct: false,
      })
      .select()
      .single();
    if (e || !data) {
      setError("הוספת אפשרות נכשלה: " + (e?.message ?? ""));
      return;
    }
    setQuestions((prev) =>
      prev.map((qq) =>
        qq.id === qid
          ? {
              ...qq,
              answer_options: [...qq.answer_options, data as AnswerOption],
            }
          : qq,
      ),
    );
  }

  async function deleteOption(qid: string, oid: string) {
    const { error: e } = await supabase
      .from("answer_options")
      .delete()
      .eq("id", oid);
    if (e) {
      setError("מחיקת אפשרות נכשלה: " + e.message);
      return;
    }
    setQuestions((prev) =>
      prev.map((qq) =>
        qq.id === qid
          ? {
              ...qq,
              answer_options: qq.answer_options.filter((o) => o.id !== oid),
            }
          : qq,
      ),
    );
  }

  async function saveOptionText(qid: string, oid: string, text: string) {
    const orig = questions
      .find((q) => q.id === qid)
      ?.answer_options.find((o) => o.id === oid);
    if (!orig || orig.text === text) return;
    setQuestions((prev) =>
      prev.map((qq) =>
        qq.id === qid
          ? {
              ...qq,
              answer_options: qq.answer_options.map((o) =>
                o.id === oid ? { ...o, text } : o,
              ),
            }
          : qq,
      ),
    );
    const { error: e } = await supabase
      .from("answer_options")
      .update({ text })
      .eq("id", oid);
    if (e) setError("שמירת אפשרות נכשלה: " + e.message);
  }

  async function setCorrectOption(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((qq) =>
        qq.id === qid
          ? {
              ...qq,
              answer_options: qq.answer_options.map((o) => ({
                ...o,
                is_correct: o.id === oid,
              })),
            }
          : qq,
      ),
    );
    await supabase
      .from("answer_options")
      .update({ is_correct: false })
      .eq("question_id", qid);
    await supabase
      .from("answer_options")
      .update({ is_correct: true })
      .eq("id", oid);
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-white/50">
        טוען…
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-white/70">חידון לא נמצא</p>
        <Link href="/admin" className="text-white/60 hover:text-white">
          חזרה לרשימה
        </Link>
      </main>
    );
  }

  const primaryColor = design.primary ?? DEFAULT_PRIMARY;
  const secondaryColor = design.secondary ?? DEFAULT_SECONDARY;
  const hasCustomDesign =
    design.primary !== undefined || design.secondary !== undefined;

  return (
    <main
      style={designStyle(design)}
      className="flex flex-1 flex-col items-center gap-6 p-6 sm:p-8"
    >
      <div className="w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-white/50 hover:text-white">
          ← חזרה לרשימת חידונים
        </Link>
      </div>

      <input
        defaultValue={quiz.title}
        onBlur={(e) => saveQuizTitle(e.target.value)}
        className="w-full max-w-3xl bg-transparent border-b-2 border-transparent focus:border-(--accent-from) px-2 py-3 text-3xl sm:text-4xl font-bold text-white focus:outline-none"
        style={{ borderBottomColor: "transparent" }}
        placeholder="שם החידון"
      />

      <div className="w-full max-w-3xl glass rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider text-white/40">
            עיצוב החידון
          </h3>
          {hasCustomDesign && (
            <button
              onClick={resetDesign}
              className="text-xs text-white/40 hover:text-white"
            >
              איפוס לברירת מחדל
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50">צבע ראשי</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => updateDesign({ primary: e.target.value })}
                onBlur={() => saveDesign(design)}
                className="h-10 w-14 cursor-pointer rounded-xl border border-white/10 bg-transparent"
              />
              <span className="font-mono text-sm text-white/70">
                {primaryColor.toUpperCase()}
              </span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50">צבע משני</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => updateDesign({ secondary: e.target.value })}
                onBlur={() => saveDesign(design)}
                className="h-10 w-14 cursor-pointer rounded-xl border border-white/10 bg-transparent"
              />
              <span className="font-mono text-sm text-white/70">
                {secondaryColor.toUpperCase()}
              </span>
            </div>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-white/50">תצוגה מקדימה</span>
            <div className="flex items-center gap-3">
              <div className="gradient-bg brand-glow rounded-full px-5 py-2 text-sm font-semibold text-white">
                כפתור
              </div>
              <div className="gradient-text text-xl font-bold">כותרת</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="w-full max-w-3xl text-rose-400 text-sm">{error}</p>
      )}

      <div className="w-full max-w-3xl flex flex-col gap-4">
        {questions.length === 0 && (
          <p className="text-center text-white/50 glass rounded-2xl p-8">
            עדיין אין שאלות. לחצי "הוסיפי שאלה" כדי להתחיל.
          </p>
        )}

        {questions.map((q, idx) => (
          <div key={q.id} className="glass rounded-3xl p-5 sm:p-6">
            <header className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs uppercase tracking-wider text-white/40">
                שאלה {idx + 1}
              </h3>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-xs text-rose-300 hover:text-rose-200"
              >
                מחיקת שאלה
              </button>
            </header>

            <input
              defaultValue={q.question_text}
              onBlur={(e) => saveQuestionText(q.id, e.target.value)}
              className="input-surface w-full rounded-2xl px-4 py-3 text-lg"
              placeholder="טקסט השאלה"
            />

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {(
                [
                  { value: "multiple_choice", label: "רב-ברירה" },
                  { value: "free_response", label: "תגובה חופשית" },
                  { value: "word_cloud", label: "ענן מילים" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 cursor-pointer rounded-full px-4 py-1.5 transition-colors ${
                    q.type === option.value
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  <input
                    type="radio"
                    name={`type-${q.id}`}
                    checked={q.type === option.value}
                    onChange={() => changeQuestionType(q.id, option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {q.type === "multiple_choice" && (
              <div className="mt-4 flex flex-col gap-2">
                <h4 className="text-xs uppercase tracking-wider text-white/40">
                  אפשרויות
                </h4>
                {q.answer_options.map((opt, oidx) => {
                  const style = getOptionStyle(oidx);
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div
                        className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${style.gradient} p-2`}
                      >
                        <OptionShape
                          shape={style.shape}
                          className="h-full w-full text-white"
                        />
                      </div>
                      <input
                        defaultValue={opt.text}
                        onBlur={(e) =>
                          saveOptionText(q.id, opt.id, e.target.value)
                        }
                        className="input-surface flex-1 rounded-xl px-3 py-2"
                        placeholder={`אפשרות ${oidx + 1}`}
                      />
                      <label
                        className="cursor-pointer flex items-center gap-1 text-xs text-white/60 hover:text-white"
                        title="סמני כתשובה נכונה"
                      >
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={opt.is_correct}
                          onChange={() => setCorrectOption(q.id, opt.id)}
                        />
                        נכון
                      </label>
                      <button
                        onClick={() => deleteOption(q.id, opt.id)}
                        disabled={q.answer_options.length <= 2}
                        className="text-rose-300 hover:text-rose-200 disabled:opacity-30 text-lg px-2"
                        aria-label="מחיקת אפשרות"
                        title={
                          q.answer_options.length <= 2
                            ? "צריך לפחות 2 אפשרויות"
                            : "מחיקה"
                        }
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <button
                  onClick={() => addOption(q.id)}
                  className="self-start mt-1 text-sm text-white/60 hover:text-white"
                >
                  + הוספת אפשרות
                </button>
              </div>
            )}

            {q.type === "free_response" && (
              <p className="mt-4 text-sm text-white/50">
                המשתתפים יקלידו תגובה חופשית בטקסט.
              </p>
            )}

            {q.type === "word_cloud" && (
              <p className="mt-4 text-sm text-white/50">
                המשתתפים ישלחו מילה או ביטוי קצר. המסך הראשי יציג ענן —
                מילים שחוזרות יגדלו אוטומטית.
              </p>
            )}
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="self-center gradient-bg brand-glow rounded-full px-7 py-3 font-bold text-white hover:scale-105 transition-transform"
        >
          + הוסיפי שאלה
        </button>
      </div>
    </main>
  );
}
