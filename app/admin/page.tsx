"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Quiz } from "@/lib/types";

export default function AdminIndexPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("quizzes")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setQuizzes((data ?? []) as Quiz[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function createQuiz() {
    setCreating(true);
    setError(null);
    const { data, error: insertErr } = await supabase
      .from("quizzes")
      .insert({ title: "חידון חדש" })
      .select()
      .single();
    if (insertErr || !data) {
      setError("שגיאה: " + (insertErr?.message ?? "לא ידוע"));
      setCreating(false);
      return;
    }
    router.push(`/admin/${(data as Quiz).id}`);
  }

  async function deleteQuiz(id: string) {
    if (!confirm("למחוק את החידון? לא ניתן לבטל.")) return;
    const { error: delErr } = await supabase.from("quizzes").delete().eq("id", id);
    if (delErr) {
      setError("שגיאה במחיקה: " + delErr.message);
      return;
    }
    setQuizzes((prev) => (prev ?? []).filter((q) => q.id !== id));
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        ממשק יצירה
      </h1>

      <button
        onClick={createQuiz}
        disabled={creating}
        className="rounded-full bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {creating ? "יוצרת…" : "+ חידון חדש"}
      </button>

      {error && <p className="text-rose-600">{error}</p>}

      <div className="grid w-full max-w-2xl gap-3">
        {quizzes === null && (
          <p className="text-center text-zinc-500">טוען חידונים…</p>
        )}
        {quizzes !== null && quizzes.length === 0 && (
          <p className="text-center text-zinc-500">
            אין עדיין חידונים. לחצי "חידון חדש" כדי להתחיל.
          </p>
        )}
        {quizzes?.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4"
          >
            <Link
              href={`/admin/${q.id}`}
              className="flex-1 text-xl font-semibold hover:text-indigo-600"
            >
              {q.title}
            </Link>
            <button
              onClick={() => deleteQuiz(q.id)}
              className="text-sm text-rose-600 hover:text-rose-500"
              aria-label="מחיקה"
            >
              מחיקה
            </button>
          </div>
        ))}
      </div>

      <Link href="/" className="mt-4 text-indigo-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
