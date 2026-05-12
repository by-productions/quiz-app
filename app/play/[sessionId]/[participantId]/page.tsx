"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GameSession, Question, AnswerOption } from "@/lib/types";

export default function PlaySessionPage() {
  const { sessionId, participantId } = useParams<{
    sessionId: string;
    participantId: string;
  }>();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<GameSession | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [options, setOptions] = useState<AnswerOption[]>([]);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load initial session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setError("המשחק לא נמצא");
        return;
      }
      setSession(data as GameSession);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  // Realtime: session updates
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`play-${sessionId}`)
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
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, supabase]);

  // When the current question changes: fetch it, its options, and any prior vote
  useEffect(() => {
    const qid = session?.current_question_id;
    if (!qid) {
      setQuestion(null);
      setOptions([]);
      setVotedOptionId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [questionRes, optionsRes, existingRes] = await Promise.all([
        supabase.from("questions").select("*").eq("id", qid).single(),
        supabase
          .from("answer_options")
          .select("*")
          .eq("question_id", qid)
          .order("position"),
        supabase
          .from("responses")
          .select("answer_data")
          .eq("session_id", sessionId)
          .eq("participant_id", participantId)
          .eq("question_id", qid)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setQuestion((questionRes.data as Question) ?? null);
      setOptions((optionsRes.data ?? []) as AnswerOption[]);
      const prior = (existingRes.data as { answer_data?: { option_id?: string } } | null)
        ?.answer_data?.option_id;
      setVotedOptionId(prior ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.current_question_id, sessionId, participantId, supabase]);

  async function vote(optionId: string) {
    if (votedOptionId || !session?.current_question_id) return;
    setVotedOptionId(optionId); // optimistic
    const { error: err } = await supabase.from("responses").insert({
      session_id: sessionId,
      participant_id: participantId,
      question_id: session.current_question_id,
      answer_data: { option_id: optionId },
    });
    if (err) {
      setVotedOptionId(null);
      setError("שגיאה בהצבעה: " + err.message);
    }
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-rose-600">{error}</p>
        <Link href="/play" className="text-rose-600 hover:underline">
          חזרה
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

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 bg-zinc-50 dark:bg-black">
      {session.state === "waiting" && (
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          ⏳ ממתינים שהמנחה תתחיל את המשחק…
        </p>
      )}

      {session.state === "question_active" && question && (
        <>
          <h2 className="text-2xl font-bold text-center">
            {question.question_text}
          </h2>
          <div className="grid w-full max-w-md gap-3">
            {options.map((opt) => {
              const isSelected = votedOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => vote(opt.id)}
                  disabled={!!votedOptionId}
                  className={`rounded-2xl border-2 px-6 py-4 text-lg font-semibold transition-colors ${
                    isSelected
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-950"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-rose-300"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
          {votedOptionId && (
            <p className="text-sm text-zinc-500">
              תשובתך נשלחה. ממתינים לאחרים…
            </p>
          )}
        </>
      )}

      {session.state === "showing_results" && (
        <p className="text-xl text-zinc-600 dark:text-zinc-400 text-center">
          📊 המנחה מציגה את התוצאות על המסך הגדול
        </p>
      )}

      {session.state === "ended" && (
        <>
          <p className="text-2xl font-bold">המשחק הסתיים 🎉</p>
          <Link href="/play" className="text-rose-600 hover:underline">
            הצטרפות למשחק חדש
          </Link>
        </>
      )}
    </main>
  );
}
