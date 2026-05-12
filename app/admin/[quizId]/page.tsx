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
} from "@/lib/types";

type QuestionWithOptions = Question & { answer_options: AnswerOption[] };

export default function QuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
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
      setQuiz((q as Quiz) ?? null);
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
    const lastPos = q.answer_options[q.answer_options.length - 1]?.position ?? -1;
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
      <main className="flex flex-1 items-center justify-center p-8 text-zinc-500">
        טוען…
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p>חידון לא נמצא</p>
        <Link href="/admin" className="text-indigo-600 hover:underline">
          חזרה לרשימה
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-8 bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-3xl">
        <Link href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← חזרה לרשימת חידונים
        </Link>
      </div>

      <input
        defaultValue={quiz.title}
        onBlur={(e) => saveQuizTitle(e.target.value)}
        className="w-full max-w-3xl rounded-xl border border-transparent bg-transparent px-3 py-2 text-3xl font-bold focus:border-indigo-500 focus:outline-none"
        placeholder="שם החידון"
      />

      {error && (
        <p className="w-full max-w-3xl text-rose-600 text-sm">{error}</p>
      )}

      <div className="w-full max-w-3xl flex flex-col gap-4">
        {questions.length === 0 && (
          <p className="text-center text-zinc-500">
            עדיין אין שאלות. לחצי "הוסיפי שאלה" כדי להתחיל.
          </p>
        )}

        {questions.map((q, idx) => (
          <div
            key={q.id}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5"
          >
            <header className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-zinc-500">
                שאלה {idx + 1}
              </h3>
              <button
                onClick={() => deleteQuestion(q.id)}
                className="text-xs text-rose-600 hover:text-rose-500"
              >
                מחיקת שאלה
              </button>
            </header>

            <input
              defaultValue={q.question_text}
              onBlur={(e) => saveQuestionText(q.id, e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-lg focus:border-indigo-500 focus:outline-none"
              placeholder="טקסט השאלה"
            />

            <div className="mt-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`type-${q.id}`}
                  checked={q.type === "multiple_choice"}
                  onChange={() => changeQuestionType(q.id, "multiple_choice")}
                />
                רב-ברירה
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`type-${q.id}`}
                  checked={q.type === "free_response"}
                  onChange={() => changeQuestionType(q.id, "free_response")}
                />
                תגובה חופשית
              </label>
            </div>

            {q.type === "multiple_choice" && (
              <div className="mt-4 flex flex-col gap-2">
                <h4 className="text-xs font-semibold text-zinc-500">
                  אפשרויות (סמני את הנכונה)
                </h4>
                {q.answer_options.map((opt, oidx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={opt.is_correct}
                      onChange={() => setCorrectOption(q.id, opt.id)}
                      className="cursor-pointer"
                      aria-label="סמני כתשובה נכונה"
                    />
                    <input
                      defaultValue={opt.text}
                      onBlur={(e) => saveOptionText(q.id, opt.id, e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                      placeholder={`אפשרות ${oidx + 1}`}
                    />
                    <button
                      onClick={() => deleteOption(q.id, opt.id)}
                      disabled={q.answer_options.length <= 2}
                      className="text-rose-600 hover:text-rose-500 disabled:opacity-30 text-xl px-2"
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
                ))}
                <button
                  onClick={() => addOption(q.id)}
                  className="self-start text-sm text-indigo-600 hover:text-indigo-500"
                >
                  + הוספת אפשרות
                </button>
              </div>
            )}

            {q.type === "free_response" && (
              <p className="mt-3 text-sm text-zinc-500">
                המשתתפים יקלידו תגובה חופשית בטקסט.
              </p>
            )}
          </div>
        ))}

        <button
          onClick={addQuestion}
          className="self-center rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          + הוסיפי שאלה
        </button>
      </div>
    </main>
  );
}
