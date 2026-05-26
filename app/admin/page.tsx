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
    <main className="flex flex-1 flex-col items-center gap-10 p-8 pt-24">
      <header className="text-center">
        <span className="eyebrow">ניהול תוכן</span>
        <h1 className="section-title mt-4 text-4xl sm:text-5xl">
          ממשק <span className="accent">יצירה</span>
        </h1>
        <p className="mt-3" style={{ color: "var(--foreground-muted)" }}>
          החידונים שלי
        </p>
      </header>

      <button
        onClick={createQuiz}
        disabled={creating}
        className="cta-red rounded-full px-8 py-3.5 text-base font-extrabold disabled:opacity-50"
        style={{ fontFamily: "var(--font-heebo)" }}
      >
        {creating ? "יוצרת…" : "+ חידון חדש"}
      </button>

      {error && <p style={{ color: "var(--red)" }}>{error}</p>}

      <div className="grid w-full max-w-2xl gap-3">
        {quizzes === null && (
          <p className="text-center" style={{ color: "var(--foreground-faint)" }}>
            טוען…
          </p>
        )}
        {quizzes !== null && quizzes.length === 0 && (
          <p
            className="glass rounded-2xl p-8 text-center"
            style={{ color: "var(--foreground-muted)" }}
          >
            עדיין אין חידונים. לחצי &quot;חידון חדש&quot; כדי להתחיל.
          </p>
        )}
        {quizzes?.map((q) => (
          <div
            key={q.id}
            className="glass glass-hover flex items-center justify-between gap-3 rounded-2xl px-6 py-4"
          >
            <Link
              href={`/admin/${q.id}`}
              className="flex-1 text-xl font-bold"
              style={{ color: "var(--navy)", fontFamily: "var(--font-heebo)" }}
            >
              {q.title}
            </Link>
            <button
              onClick={() => deleteQuiz(q.id)}
              className="text-sm font-bold transition-colors hover:opacity-70"
              style={{ color: "var(--red)" }}
              aria-label="מחיקה"
            >
              מחיקה
            </button>
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="mt-2 text-sm transition-colors hover:opacity-70"
        style={{ color: "var(--foreground-muted)" }}
      >
        חזרה לדף הבית
      </Link>
    </main>
  );
}
