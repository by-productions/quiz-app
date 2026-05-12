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
    const { error: delErr } = await supabase
      .from("quizzes")
      .delete()
      .eq("id", id);
    if (delErr) {
      setError("שגיאה במחיקה: " + delErr.message);
      return;
    }
    setQuizzes((prev) => (prev ?? []).filter((q) => q.id !== id));
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-10 p-8">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text">
          ממשק יצירה
        </h1>
        <p className="mt-3 text-white/60">החידונים שלי</p>
      </header>

      <button
        onClick={createQuiz}
        disabled={creating}
        className="gradient-bg brand-glow rounded-full px-7 py-3 font-bold text-white hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
      >
        {creating ? "יוצרת…" : "+ חידון חדש"}
      </button>

      {error && <p className="text-rose-400">{error}</p>}

      <div className="grid w-full max-w-2xl gap-3">
        {quizzes === null && (
          <p className="text-center text-white/50">טוען…</p>
        )}
        {quizzes !== null && quizzes.length === 0 && (
          <p className="text-center text-white/50 glass rounded-2xl p-8">
            עדיין אין חידונים. לחצי "חידון חדש" כדי להתחיל.
          </p>
        )}
        {quizzes?.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between gap-3 glass glass-hover rounded-2xl px-6 py-4"
          >
            <Link
              href={`/admin/${q.id}`}
              className="flex-1 text-xl font-semibold text-white"
            >
              {q.title}
            </Link>
            <button
              onClick={() => deleteQuiz(q.id)}
              className="text-sm text-rose-300 hover:text-rose-200"
              aria-label="מחיקה"
            >
              מחיקה
            </button>
          </div>
        ))}
      </div>

      <Link href="/" className="mt-2 text-sm text-white/50 hover:text-white">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
