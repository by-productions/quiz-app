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
  DesignSettings,
} from "@/lib/types";
import { getOptionStyle, OptionShape } from "@/lib/optionStyle";
import { designStyle } from "@/lib/design";

type FullQuestion = Question & { answer_options: AnswerOption[] };

type ResponseRow = {
  answer_data: { option_id?: string; text?: string };
  nickname: string;
};

function aggregateWords(responses: ResponseRow[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const text = r.answer_data.text?.trim().toLowerCase();
    if (!text) continue;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function WordCloudView({ entries }: { entries: Array<[string, number]> }) {
  if (entries.length === 0) {
    return (
      <div className="glass rounded-3xl px-10 py-12 text-center">
        <p className="text-white/50 text-lg">ממתינים למילים…</p>
      </div>
    );
  }
  const max = entries[0][1];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 py-8 px-4 max-w-5xl">
      {entries.map(([word, count]) => {
        const ratio = count / max;
        const fontSize = 1.2 + ratio * 4.5; // 1.2rem → 5.7rem
        const isTop = ratio > 0.66;
        return (
          <span
            key={word}
            className={`font-extrabold leading-none whitespace-nowrap ${
              isTop ? "gradient-text" : "text-white"
            }`}
            style={{
              fontSize: `${fontSize}rem`,
              opacity: isTop ? 1 : 0.45 + ratio * 0.5,
            }}
            title={`${word} — ${count}`}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export default function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [responseTick, setResponseTick] = useState(0);
  const [design, setDesign] = useState<DesignSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const { data: quizData } = await supabase
        .from("quizzes")
        .select("design_settings")
        .eq("id", (sessionData as GameSession).quiz_id)
        .single();
      if (!cancelled) {
        setDesign(
          ((quizData as { design_settings?: DesignSettings } | null)
            ?.design_settings) ?? null,
        );
      }

      const { data: questionsData } = await supabase
        .from("questions")
        .select("*, answer_options(*)")
        .eq("quiz_id", (sessionData as GameSession).quiz_id)
        .order("position");
      if (cancelled) return;
      const qs = (questionsData ?? []) as unknown as FullQuestion[];
      qs.forEach((q) =>
        q.answer_options.sort((a, b) => a.position - b.position),
      );
      setQuestions(qs);

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
        () => setResponseTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    const qid = session?.current_question_id;
    if (!qid) {
      setResponses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("responses")
        .select("answer_data, participants(nickname)")
        .eq("session_id", sessionId)
        .eq("question_id", qid);
      if (cancelled) return;
      const rows = (
        (data ?? []) as Array<{
          answer_data: { option_id?: string; text?: string };
          participants: { nickname: string } | null;
        }>
      ).map((r) => ({
        answer_data: r.answer_data,
        nickname: r.participants?.nickname ?? "אנונימי",
      }));
      setResponses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.current_question_id, responseTick, sessionId, supabase]);

  const currentQuestion = questions.find(
    (q) => q.id === session?.current_question_id,
  );

  const responseCounts: Record<string, number> = {};
  for (const r of responses) {
    if (r.answer_data.option_id) {
      responseCounts[r.answer_data.option_id] =
        (responseCounts[r.answer_data.option_id] ?? 0) + 1;
    }
  }

  const freeResponses = responses
    .filter((r) => typeof r.answer_data.text === "string")
    .map((r) => ({ text: r.answer_data.text as string, nickname: r.nickname }));

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

  async function nextQuestion() {
    if (!currentQuestion) return;
    const idx = questions.findIndex((q) => q.id === currentQuestion.id);
    const next = questions[idx + 1];
    if (next) {
      await supabase
        .from("game_sessions")
        .update({
          state: "question_active",
          current_question_id: next.id,
        })
        .eq("id", sessionId);
    } else {
      await endGame();
    }
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
        <p className="text-rose-400">{error}</p>
        <Link href="/host" className="text-white/60 hover:text-white">
          חזרה לרשימת החידונים
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

  const isLastQuestion = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id) ===
      questions.length - 1
    : false;

  const totalQIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id) + 1
    : 0;

  return (
    <main
      style={designStyle(design)}
      className="flex flex-1 flex-col items-center gap-10 p-6 sm:p-10"
    >
      {session.state === "waiting" && (
        <div className="flex flex-col items-center gap-8 max-w-5xl w-full">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            הצטרפות
          </p>
          <p
            className="font-mono font-extrabold tracking-[0.18em] gradient-text"
            style={{ fontSize: "clamp(4rem, 18vw, 12rem)", lineHeight: 1 }}
          >
            {session.join_code}
          </p>
          <p className="text-white/60 text-sm sm:text-base">
            פתחו <span className="font-mono text-white">/play</span> והקלידו את
            הקוד
          </p>

          <div className="glass rounded-3xl p-6 w-full max-w-md">
            <h3 className="text-xs uppercase tracking-wider text-white/40 mb-3">
              משתתפים ({participants.length})
            </h3>
            {participants.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-4">
                ממתינים למצטרפים…
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white"
                  >
                    {p.nickname}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={startFirstQuestion}
            disabled={questions.length === 0 || participants.length === 0}
            className="gradient-bg brand-glow rounded-full px-10 py-4 text-lg font-bold text-white hover:scale-105 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            התחילי שאלה ראשונה
          </button>
          {participants.length === 0 && (
            <p className="text-xs text-white/40">
              הכפתור יופעל אחרי שהמשתתף הראשון יצטרף
            </p>
          )}
        </div>
      )}

      {(session.state === "question_active" ||
        session.state === "showing_results") &&
        currentQuestion && (
          <div className="flex flex-col items-center gap-8 w-full max-w-6xl">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/40">
              <span>
                שאלה {totalQIndex} / {questions.length}
              </span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>
                {session.state === "question_active" ? "פעיל" : "תוצאות"}
              </span>
            </div>

            <h2
              className="text-center font-bold text-white leading-tight"
              style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.5rem)" }}
            >
              {currentQuestion.question_text}
            </h2>

            {currentQuestion.type === "multiple_choice" && (
              <div className="grid w-full gap-4 sm:grid-cols-2">
                {currentQuestion.answer_options.map((opt, idx) => {
                  const style = getOptionStyle(idx);
                  const count = responseCounts[opt.id] ?? 0;
                  const totalVotes = Object.values(responseCounts).reduce(
                    (a, b) => a + b,
                    0,
                  );
                  const pct =
                    totalVotes > 0
                      ? Math.round((count / totalVotes) * 100)
                      : 0;
                  const isResults = session.state === "showing_results";
                  const isCorrect = opt.is_correct;
                  return (
                    <div
                      key={opt.id}
                      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.gradient} p-6 sm:p-7 ${
                        isResults && !isCorrect ? "opacity-50" : ""
                      } ${
                        isResults && isCorrect
                          ? "ring-4 ring-white/80 ring-offset-4 ring-offset-transparent"
                          : ""
                      }`}
                      style={{
                        boxShadow: `0 12px 40px -8px ${style.hex}66`,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 text-white/95">
                          <OptionShape
                            shape={style.shape}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="flex-1 text-xl sm:text-2xl font-bold text-white drop-shadow">
                          {opt.text || `אפשרות ${idx + 1}`}
                        </div>
                        <div className="text-3xl sm:text-4xl font-extrabold text-white tabular-nums drop-shadow">
                          {count}
                        </div>
                      </div>
                      {isResults && (
                        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full bg-white/95"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {isResults && isCorrect && (
                        <div className="absolute top-3 left-3 rounded-full bg-white text-emerald-700 px-2.5 py-0.5 text-xs font-bold">
                          תשובה נכונה ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === "free_response" &&
              session.state === "question_active" && (
                <div className="glass-strong rounded-3xl px-10 py-8 text-center">
                  <p className="text-xs uppercase tracking-wider text-white/50">
                    תגובות שהתקבלו
                  </p>
                  <p
                    className="mt-2 font-extrabold gradient-text tabular-nums"
                    style={{ fontSize: "clamp(3.5rem, 10vw, 7rem)", lineHeight: 1 }}
                  >
                    {freeResponses.length}
                  </p>
                </div>
              )}

            {currentQuestion.type === "free_response" &&
              session.state === "showing_results" && (
                <div className="w-full max-w-3xl glass rounded-3xl p-5 max-h-[60vh] overflow-y-auto">
                  {freeResponses.length === 0 ? (
                    <p className="text-white/50 text-center py-6">
                      לא התקבלו תגובות
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {freeResponses.map((r, i) => (
                        <li
                          key={i}
                          className="rounded-2xl bg-white/5 px-4 py-3 border border-white/5"
                        >
                          <span className="text-xs uppercase tracking-wider text-white/40">
                            {r.nickname}
                          </span>
                          <div className="mt-1 text-lg text-white">
                            {r.text}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

            {currentQuestion.type === "word_cloud" && (
              <WordCloudView entries={aggregateWords(responses)} />
            )}

            {session.state === "question_active" && (
              <button
                onClick={showResults}
                className="gradient-bg brand-glow rounded-full px-10 py-4 text-lg font-bold text-white hover:scale-105 transition-transform"
              >
                סיימי שאלה והצג תוצאות
              </button>
            )}
            {session.state === "showing_results" && (
              <button
                onClick={nextQuestion}
                className="gradient-bg brand-glow rounded-full px-10 py-4 text-lg font-bold text-white hover:scale-105 transition-transform"
              >
                {isLastQuestion ? "סיימי משחק" : "שאלה הבאה →"}
              </button>
            )}
          </div>
        )}

      {session.state === "ended" && (
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-5xl sm:text-6xl font-bold gradient-text">
            המשחק הסתיים
          </h2>
          <p className="text-white/60">תודה לכל המשתתפים 🎉</p>
          <Link
            href="/host"
            className="glass glass-hover rounded-full px-8 py-3 text-white"
          >
            התחלת משחק חדש
          </Link>
        </div>
      )}
    </main>
  );
}
