"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { GameSession, Question, AnswerOption } from "@/lib/types";

type MyResponse = { option_id?: string; text?: string } | null;

export default function PlaySessionPage() {
  const { sessionId, participantId } = useParams<{
    sessionId: string;
    participantId: string;
  }>();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<GameSession | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [options, setOptions] = useState<AnswerOption[]>([]);
  const [myResponse, setMyResponse] = useState<MyResponse>(null);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const qid = session?.current_question_id;
    if (!qid) {
      setQuestion(null);
      setOptions([]);
      setMyResponse(null);
      setFreeText("");
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
      const prior =
        (existingRes.data as { answer_data?: MyResponse } | null)?.answer_data ??
        null;
      setMyResponse(prior);
      setFreeText("");
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.current_question_id, sessionId, participantId, supabase]);

  async function voteMC(optionId: string) {
    if (myResponse || !session?.current_question_id) return;
    setMyResponse({ option_id: optionId });
    const { error: err } = await supabase.from("responses").insert({
      session_id: sessionId,
      participant_id: participantId,
      question_id: session.current_question_id,
      answer_data: { option_id: optionId },
    });
    if (err) {
      setMyResponse(null);
      setError("שגיאה בהצבעה: " + err.message);
    }
  }

  async function submitFreeText() {
    const text = freeText.trim();
    if (!text || myResponse || !session?.current_question_id) return;
    setSubmitting(true);
    setMyResponse({ text });
    const { error: err } = await supabase.from("responses").insert({
      session_id: sessionId,
      participant_id: participantId,
      question_id: session.current_question_id,
      answer_data: { text },
    });
    if (err) {
      setMyResponse(null);
      setError("שגיאה בשליחה: " + err.message);
    }
    setSubmitting(false);
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

          {question.type === "multiple_choice" && (
            <div className="grid w-full max-w-md gap-3">
              {options.map((opt) => {
                const isSelected = myResponse?.option_id === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => voteMC(opt.id)}
                    disabled={!!myResponse}
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
          )}

          {question.type === "free_response" && (
            <>
              {myResponse?.text ? (
                <div className="w-full max-w-md rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950 px-4 py-3">
                  <div className="text-xs text-zinc-500 mb-1">התגובה שלך:</div>
                  <div className="text-lg">{myResponse.text}</div>
                </div>
              ) : (
                <div className="w-full max-w-md flex flex-col gap-3">
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    placeholder="כתבי את התגובה שלך…"
                    rows={4}
                    className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 focus:border-rose-500 focus:outline-none resize-none"
                  />
                  <button
                    onClick={submitFreeText}
                    disabled={submitting || !freeText.trim()}
                    className="rounded-full bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {submitting ? "שולחת…" : "שלחי"}
                  </button>
                </div>
              )}
            </>
          )}

          {myResponse && (
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
