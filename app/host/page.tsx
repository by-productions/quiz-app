"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateJoinCode } from "@/lib/joinCode";
import type { Quiz } from "@/lib/types";

export default function HostIndexPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [starting, setStarting] = useState(false);
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

  async function startGame(quizId: string) {
    setStarting(true);
    setError(null);
    for (let attempt = 0; attempt < 5; attempt++) {
      const join_code = generateJoinCode();
      const { data, error } = await supabase
        .from("game_sessions")
        .insert({ quiz_id: quizId, join_code, state: "waiting" })
        .select()
        .single();
      if (!error && data) {
        router.push(`/host/${data.id}`);
        return;
      }
      // 23505 = unique_violation on join_code; retry with a new code
      if (error?.code !== "23505") {
        setError("שגיאה ביצירת המשחק: " + (error?.message ?? "לא ידוע"));
        setStarting(false);
        return;
      }
    }
    setError("לא הצלחתי לייצר קוד הצטרפות פנוי. נסי שוב.");
    setStarting(false);
  }

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        ממשק מנחה
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        בחרי חידון להתחלת משחק חדש
      </p>

      <div className="grid w-full max-w-2xl gap-3">
        {quizzes === null && (
          <p className="text-center text-zinc-500">טוען חידונים…</p>
        )}
        {quizzes !== null && quizzes.length === 0 && (
          <p className="text-center text-zinc-500">
            אין עדיין חידונים. ניצור אחד דרך /admin (ייבנה בשלב 6).
          </p>
        )}
        {quizzes?.map((q) => (
          <button
            key={q.id}
            disabled={starting}
            onClick={() => startGame(q.id)}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-4 text-right hover:border-emerald-500 disabled:opacity-50"
          >
            <div className="text-xl font-semibold">{q.title}</div>
            <div className="mt-1 text-sm text-zinc-500">לחצי להתחלת משחק חדש</div>
          </button>
        ))}
      </div>

      {error && <p className="text-rose-600">{error}</p>}

      <Link href="/" className="mt-4 text-emerald-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
