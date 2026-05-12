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
        router.push(`/host/${(data as { id: string }).id}`);
        return;
      }
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
    <main className="flex flex-1 flex-col items-center gap-10 p-8">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text">
          ממשק הנחיה
        </h1>
        <p className="mt-3 text-white/60">בחרי חידון להתחלת משחק חדש</p>
      </header>

      <div className="grid w-full max-w-2xl gap-3">
        {quizzes === null && (
          <p className="text-center text-white/50">טוען…</p>
        )}
        {quizzes !== null && quizzes.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-white/60">
            עדיין אין חידונים.{" "}
            <Link href="/admin" className="text-white underline hover:no-underline">
              ליצירת חידון
            </Link>
          </div>
        )}
        {quizzes?.map((q) => (
          <button
            key={q.id}
            disabled={starting}
            onClick={() => startGame(q.id)}
            className="glass glass-hover rounded-2xl px-6 py-5 text-right disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="text-xl font-semibold text-white">{q.title}</div>
            <div className="mt-1 text-sm text-white/50">
              לחצי להתחלת משחק חדש ←
            </div>
          </button>
        ))}
      </div>

      {error && <p className="text-rose-400">{error}</p>}

      <Link href="/" className="mt-2 text-sm text-white/50 hover:text-white">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
