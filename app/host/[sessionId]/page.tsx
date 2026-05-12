"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  GameSession,
  Question,
  AnswerOption,
  Participant,
} from "@/lib/types";

type FullQuestion = Question & { answer_options: AnswerOption[] };

export default function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  // Initial load: session + questions + participants
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data: sessionData, error: sessionErr } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (cancelled) return;
      if (sessionErr || !sessionData) {
        setError("המשחק לא נמצא");
        return;
      }
      setSession(sessionData as GameSession);

      const { data: questionsData } = await supabase
        .from("questions")
        .select("*, answer_options(*)")
        .eq("quiz_id", (sessionData as GameSession).quiz_id)
        .order("position");
      if (cancelled) return;
      setQuestions((questionsData ?? []) as unknown as FullQuestion[]);

      const { data: partsData } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId)
        .order("joined_at");
      if (cancelled) return;
      setParticipants((partsData ?? []) as Participant[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  // Realtime: session updates, new participants, new responses
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`host-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload: { new: GameSession }) => setSession(payload.new),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: { new: Participant }) =>
          setParticipants((prev) => [...prev, payload.new]),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "responses",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: { new: { answer_data?: { option_id?: string } } }) => {
          const optId = payload.new.answer_data?.option_id;
          if (optId) {
            setResponseCounts((prev) => ({
              ...prev,
              [optId]: (prev[optId] ?? 0) + 1,
            }));
          }
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, supabase]);

  // Refresh response counts whenever the current question changes
  useEffect(() => {
    const qid = session?.current_question_id;
    if (!qid) {
      setResponseCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("responses")
        .select("answer_data")
        .eq("session_id", sessionId)
        .eq("question_id", qid);
      if (cancelled) return;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const optId = (r as { answer_data?: { option_id?: string } })
          .answer_data?.option_id;
        if (optId) counts[optId] = (counts[optId] ?? 0) + 1;
      }
      setResponseCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.current_question_id, sessionId, supabase]);

  async function startFirstQuestion() {
    const first = questions[0];
    if (!first) return;
    await supabase
      .from("game_sessions")
      .update({ state: "question_active", current_question_id: first.id })
      .eq("id", sessionId);
  }

  async function showResults() {
    await supabase
      .from("game_sessions")
      .update({ state: "showing_results" })
      .eq("id", sessionId);
  }

  async function endGame() {
    await supabase
      .from("game_sessions")
      .update({ state: "ended" })
      .eq("id", sessionId);
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-rose-600">{error}</p>
        <Link href="/host" className="text-emerald-600 hover:underline">
          חזרה לרשימת החידונים
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-8 text-zinc-500">
        טוען…
      </main>
    );
  }

  const currentQuestion = questions.find(
    (q) => q.id === session.current_question_id,
  );

  return (
    <main className="flex flex-1 flex-col items-center gap-8 p-8 bg-zinc-50 dark:bg-black">
      {session.state === "waiting" && (
        <>
          <p className="text-center text-zinc-500 text-sm">
            פתחו את <span className="font-mono">/play</span> והקלידו את הקוד
          </p>
          <p className="font-mono text-7xl sm:text-8xl font-bold tracking-widest text-emerald-600">
            {session.join_code}
          </p>

          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
            <h3 className="text-sm font-semibold text-zinc-500 mb-2">
              משתתפים ({participants.length})
            </h3>
            {participants.length === 0 ? (
              <p className="text-zinc-500 text-sm">
                עדיין אין משתתפים. שתפי את הקוד.
              </p>
            ) : (
              <ul className="space-y-1">
                {participants.map((p) => (
                  <li key={p.id} className="text-zinc-800 dark:text-zinc-200">
                    {p.nickname}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={startFirstQuestion}
            disabled={questions.length === 0 || participants.length === 0}
            className="rounded-full bg-emerald-600 px-8 py-3 text-lg font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            התחילי שאלה ראשונה
          </button>
          {participants.length === 0 && (
            <p className="text-xs text-zinc-500">
              (הכפתור יופעל אחרי שהמשתתף הראשון יצטרף)
            </p>
          )}
        </>
      )}

      {session.state === "question_active" && currentQuestion && (
        <>
          <h2 className="text-3xl font-bold text-center">
            {currentQuestion.question_text}
          </h2>
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {currentQuestion.answer_options.map((opt) => (
              <div
                key={opt.id}
                className="rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4"
              >
                <div className="text-lg">{opt.text}</div>
                <div className="text-3xl font-bold mt-2 text-emerald-600">
                  {responseCounts[opt.id] ?? 0}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={showResults}
            className="rounded-full bg-amber-600 px-8 py-3 text-lg font-semibold text-white hover:bg-amber-500"
          >
            סיימי שאלה והצג תוצאות
          </button>
        </>
      )}

      {session.state === "showing_results" && currentQuestion && (
        <>
          <h2 className="text-2xl font-bold text-center">
            תוצאות: {currentQuestion.question_text}
          </h2>
          <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {currentQuestion.answer_options.map((opt) => (
              <div
                key={opt.id}
                className={`rounded-2xl border-2 p-4 ${
                  opt.is_correct
                    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-500"
                    : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="text-lg">
                  {opt.text} {opt.is_correct && "✓"}
                </div>
                <div className="text-3xl font-bold mt-2">
                  {responseCounts[opt.id] ?? 0}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={endGame}
            className="rounded-full bg-rose-600 px-8 py-3 text-lg font-semibold text-white hover:bg-rose-500"
          >
            סיימי משחק
          </button>
        </>
      )}

      {session.state === "ended" && (
        <>
          <h2 className="text-3xl font-bold">המשחק הסתיים 🎉</h2>
          <Link href="/host" className="text-emerald-600 hover:underline">
            התחלת משחק חדש
          </Link>
        </>
      )}
    </main>
  );
}
