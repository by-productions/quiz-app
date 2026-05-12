"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  GameSession,
  Question,
  AnswerOption,
  DesignSettings,
} from "@/lib/types";
import { getOptionStyle, OptionShape } from "@/lib/optionStyle";
import { designStyle } from "@/lib/design";

type MyResponse =
  | { option_id?: string; text?: string; rating?: number }
  | null;

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
  const [design, setDesign] = useState<DesignSettings | null>(null);
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

      const { data: quizData } = await supabase
        .from("quizzes")
        .select("design_settings")
        .eq("id", (data as GameSession).quiz_id)
        .single();
      if (cancelled) return;
      setDesign(
        ((quizData as { design_settings?: DesignSettings } | null)
          ?.design_settings) ?? null,
      );
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
        (existingRes.data as { answer_data?: MyResponse } | null)
          ?.answer_data ?? null;
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

  async function submitRating(rating: number) {
    if (myResponse || !session?.current_question_id) return;
    setMyResponse({ rating });
    const { error: err } = await supabase.from("responses").insert({
      session_id: sessionId,
      participant_id: participantId,
      question_id: session.current_question_id,
      answer_data: { rating },
    });
    if (err) {
      setMyResponse(null);
      setError("שגיאה בדירוג: " + err.message);
    }
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-rose-400">{error}</p>
        <Link href="/play" className="text-white/60 hover:text-white">
          חזרה
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-white/50">
        טוען…
      </main>
    );
  }

  return (
    <main
      style={designStyle(design)}
      className="flex flex-1 flex-col items-center justify-center gap-6 p-5"
    >
      {session.state === "waiting" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full gradient-bg opacity-40 animate-ping" />
            <div className="absolute inset-3 rounded-full gradient-bg" />
          </div>
          <p className="text-xl font-semibold text-white">
            ממתינים שהמנחה תתחיל
          </p>
          <p className="text-sm text-white/50">המסך יקפוץ אוטומטית</p>
        </div>
      )}

      {session.state === "question_active" && question && (
        <div className="flex flex-col items-center gap-6 w-full max-w-md">
          {question.image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={question.image_url}
              alt=""
              className="rounded-2xl max-h-48 w-auto object-contain"
            />
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white leading-tight">
            {question.question_text}
          </h2>

          {question.type === "multiple_choice" && (
            <div className="grid w-full gap-3 grid-cols-1 sm:grid-cols-2">
              {options.map((opt, idx) => {
                const style = getOptionStyle(idx);
                const isSelected = myResponse?.option_id === opt.id;
                const disabled = !!myResponse;
                return (
                  <button
                    key={opt.id}
                    onClick={() => voteMC(opt.id)}
                    disabled={disabled}
                    className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} px-5 py-6 text-right transition-all ${
                      isSelected
                        ? "ring-4 ring-white scale-[1.02]"
                        : disabled
                        ? "opacity-40"
                        : "active:scale-95"
                    }`}
                    style={{
                      boxShadow: isSelected
                        ? `0 10px 40px -5px ${style.hex}aa`
                        : `0 6px 20px -8px ${style.hex}66`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 text-white/95">
                        <OptionShape
                          shape={style.shape}
                          className="h-full w-full"
                        />
                      </div>
                      {opt.image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={opt.image_url}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 text-lg font-bold text-white drop-shadow">
                        {opt.text ||
                          (opt.image_url ? "" : `אפשרות ${idx + 1}`)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "true_false" && (
            <div className="grid w-full grid-cols-2 gap-3">
              {options.map((opt) => {
                const isTrue = opt.text === "נכון";
                const isSelected = myResponse?.option_id === opt.id;
                const disabled = !!myResponse;
                const gradient = isTrue
                  ? "from-emerald-500 to-teal-600"
                  : "from-rose-500 to-red-600";
                const hex = isTrue ? "#10b981" : "#e11d48";
                return (
                  <button
                    key={opt.id}
                    onClick={() => voteMC(opt.id)}
                    disabled={disabled}
                    className={`overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} px-4 py-8 transition-all ${
                      isSelected
                        ? "ring-4 ring-white scale-[1.03]"
                        : disabled
                        ? "opacity-40"
                        : "active:scale-95"
                    }`}
                    style={{
                      boxShadow: isSelected
                        ? `0 10px 40px -5px ${hex}aa`
                        : `0 6px 20px -8px ${hex}66`,
                    }}
                  >
                    <div className="text-5xl text-center mb-1 text-white">
                      {isTrue ? "✓" : "✗"}
                    </div>
                    <div className="text-center text-lg font-bold text-white">
                      {opt.text}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {question.type === "rating" && (
            <div className="w-full flex flex-col items-center gap-4">
              {myResponse?.rating ? (
                <div className="glass-strong rounded-3xl px-8 py-6 text-center">
                  <div className="text-xs uppercase tracking-wider text-white/50 mb-2">
                    הדירוג שלך
                  </div>
                  <div
                    className="font-extrabold gradient-text tabular-nums"
                    style={{ fontSize: "5rem", lineHeight: 1 }}
                  >
                    {myResponse.rating}
                  </div>
                  <div className="text-white/50 text-sm">מתוך 5</div>
                </div>
              ) : (
                <div className="flex gap-3 justify-center flex-wrap">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      onClick={() => submitRating(score)}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl gradient-bg brand-glow flex items-center justify-center text-3xl sm:text-4xl font-extrabold text-white hover:scale-110 transition-transform"
                    >
                      {score}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {question.type === "slide" && (
            <p className="text-sm text-white/60 text-center">
              ⏳ ממתינים שהמנחה תמשיך…
            </p>
          )}

          {(question.type === "free_response" ||
            question.type === "word_cloud") && (
            <>
              {myResponse?.text ? (
                <div className="glass-strong w-full rounded-3xl px-5 py-4">
                  <div className="text-xs uppercase tracking-wider text-white/50 mb-1">
                    {question.type === "word_cloud"
                      ? "המילה שלך"
                      : "התגובה שלך"}
                  </div>
                  <div className="text-lg text-white">{myResponse.text}</div>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  {question.type === "word_cloud" ? (
                    <input
                      type="text"
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="מילה אחת…"
                      maxLength={40}
                      autoFocus
                      className="input-surface rounded-2xl px-5 py-4 text-2xl text-center"
                    />
                  ) : (
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="כתבי את התגובה שלך…"
                      rows={4}
                      className="input-surface rounded-2xl px-5 py-4 text-lg resize-none"
                    />
                  )}
                  <button
                    onClick={submitFreeText}
                    disabled={submitting || !freeText.trim()}
                    className="gradient-bg brand-glow rounded-full px-6 py-4 font-bold text-white text-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {submitting
                      ? "שולחת…"
                      : question.type === "word_cloud"
                      ? "שלחי"
                      : "שלחי תגובה"}
                  </button>
                </div>
              )}
            </>
          )}

          {myResponse && (
            <p className="text-sm text-white/50 text-center">
              ✓ תשובתך נשלחה. ממתינים לאחרים…
            </p>
          )}
        </div>
      )}

      {session.state === "showing_results" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">📊</div>
          <p className="text-xl font-semibold text-white">
            המנחה מציגה את התוצאות
          </p>
          <p className="text-sm text-white/50">המסך הגדול ↑</p>
        </div>
      )}

      {session.state === "ended" && (
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="text-4xl font-bold gradient-text">המשחק הסתיים</h2>
          <p className="text-2xl">🎉</p>
          <Link
            href="/play"
            className="glass glass-hover rounded-full px-8 py-3 text-white"
          >
            הצטרפות למשחק חדש
          </Link>
        </div>
      )}
    </main>
  );
}
