"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
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
import { useNow, formatSeconds, remainingSeconds } from "@/lib/timer";
import { Backdrop, LogoChip } from "@/lib/Backdrop";

type FullQuestion = Question & { answer_options: AnswerOption[] };

type ResponseRow = {
  participant_id: string;
  answer_data: { option_id?: string; text?: string; rating?: number };
  nickname: string;
  avatar_url: string | null;
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
  const [origin, setOrigin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

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
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload: { new: Participant }) =>
          setParticipants((prev) =>
            prev.map((p) => (p.id === payload.new.id ? payload.new : p)),
          ),
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
        .select(
          "participant_id, answer_data, participants(nickname, avatar_url)",
        )
        .eq("session_id", sessionId)
        .eq("question_id", qid);
      if (cancelled) return;
      const rows = (
        (data ?? []) as Array<{
          participant_id: string;
          answer_data: ResponseRow["answer_data"];
          participants: { nickname: string; avatar_url: string | null } | null;
        }>
      ).map((r) => ({
        participant_id: r.participant_id,
        answer_data: r.answer_data,
        nickname: r.participants?.nickname ?? "אנונימי",
        avatar_url: r.participants?.avatar_url ?? null,
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
      .update({
        state: "question_active",
        current_question_id: first.id,
        question_started_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  async function showResults() {
    if (session?.state !== "question_active") return;
    if (!currentQuestion) return;

    // Score MC / true_false: +100 per correct response
    if (
      currentQuestion.type === "multiple_choice" ||
      currentQuestion.type === "true_false"
    ) {
      const correctOpt = currentQuestion.answer_options.find(
        (o) => o.is_correct,
      );
      if (correctOpt) {
        const correctParticipantIds = responses
          .filter((r) => r.answer_data.option_id === correctOpt.id)
          .map((r) => r.participant_id);
        for (const pid of correctParticipantIds) {
          const p = participants.find((pp) => pp.id === pid);
          if (!p) continue;
          await supabase
            .from("participants")
            .update({ score: (p.score ?? 0) + 100 })
            .eq("id", pid);
        }
      }
    }

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
          question_started_at: new Date().toISOString(),
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

  const effectiveTimeLimit =
    currentQuestion?.time_limit ?? design?.default_time_limit ?? null;

  const showCountdown =
    session?.state === "question_active" &&
    effectiveTimeLimit != null &&
    effectiveTimeLimit > 0 &&
    session.question_started_at != null &&
    currentQuestion?.type !== "slide";

  const now = useNow(!!showCountdown);
  const remainingSec = showCountdown
    ? remainingSeconds(
        session.question_started_at,
        effectiveTimeLimit,
        now,
      )
    : 0;

  // Auto-advance to results when timer reaches zero
  useEffect(() => {
    if (!showCountdown) return;
    if (remainingSec > 0) return;
    showResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCountdown, remainingSec]);

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
      <Backdrop design={design} />
      <LogoChip design={design} />
      {session.state === "waiting" && (
        <div className="flex flex-col items-center gap-8 max-w-5xl w-full">
          <p className="text-sm uppercase tracking-[0.2em] text-white/40">
            הצטרפות
          </p>

          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="font-mono font-extrabold tracking-[0.18em] gradient-text"
              style={{ fontSize: "clamp(3.5rem, 14vw, 9rem)", lineHeight: 1 }}
            >
              {session.join_code}
            </motion.p>

            {origin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white p-3 sm:p-4 rounded-2xl shadow-2xl"
              >
                <QRCodeSVG
                  value={`${origin}/play?code=${session.join_code}`}
                  size={180}
                  level="M"
                  marginSize={0}
                />
              </motion.div>
            )}
          </div>

          <p className="text-white/60 text-sm sm:text-base text-center">
            סרקו את ה-QR או היכנסו ל-
            <span className="font-mono text-white">/play</span> והקלידו את הקוד
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
                <AnimatePresence initial={false}>
                  {participants.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.25 }}
                      className="flex items-center gap-2 rounded-full bg-white/10 pl-3 pr-1 py-1 text-sm text-white"
                    >
                      {p.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                          {p.nickname.slice(0, 1)}
                        </span>
                      )}
                      {p.nickname}
                    </motion.li>
                  ))}
                </AnimatePresence>
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

            {showCountdown && (
              <div
                className={`font-mono font-extrabold tabular-nums tracking-wider ${
                  remainingSec <= 5 ? "text-rose-400" : "gradient-text"
                }`}
                style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)", lineHeight: 1 }}
              >
                {formatSeconds(remainingSec)}
              </div>
            )}

            {currentQuestion.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentQuestion.image_url}
                alt=""
                className="rounded-3xl max-h-[40vh] w-auto object-contain shadow-xl"
              />
            )}

            <motion.h2
              key={currentQuestion.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center font-bold text-white leading-tight"
              style={{ fontSize: "clamp(1.75rem, 4.5vw, 3.5rem)" }}
            >
              {currentQuestion.question_text}
            </motion.h2>

            {currentQuestion.type === "multiple_choice" && (() => {
              const isResults = session.state === "showing_results";
              const totalParticipants = Math.max(participants.length, 1);
              const anyCorrectMarked = currentQuestion.answer_options.some(
                (o) => o.is_correct,
              );
              return (
                <div
                  className="grid w-full max-w-4xl gap-3 sm:gap-5 items-end"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, minmax(0, 1fr))`,
                    height: "clamp(280px, 45vh, 460px)",
                  }}
                >
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const style = getOptionStyle(idx);
                    const count = responseCounts[opt.id] ?? 0;
                    const pct = Math.min(
                      100,
                      (count / totalParticipants) * 100,
                    );
                    const isCorrect = opt.is_correct;
                    const dim = isResults && anyCorrectMarked && !isCorrect;
                    return (
                      <div
                        key={opt.id}
                        className="flex flex-col items-center justify-end h-full"
                      >
                        {isResults && isCorrect && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.7 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.3 }}
                            className="mb-2 rounded-full bg-white text-emerald-700 px-3 py-0.5 text-xs font-bold whitespace-nowrap"
                          >
                            ✓ תשובה נכונה
                          </motion.div>
                        )}

                        <motion.div
                          key={`count-${count}`}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.25 }}
                          className={`text-2xl sm:text-3xl font-extrabold text-white tabular-nums mb-2 drop-shadow ${
                            dim ? "opacity-40" : ""
                          }`}
                        >
                          {count}
                        </motion.div>

                        <div className="w-full flex-1 flex items-end min-h-[40px]">
                          <motion.div
                            className={`w-full rounded-t-2xl bg-gradient-to-t ${style.gradient}`}
                            initial={{ height: 0 }}
                            animate={{ height: `${pct}%` }}
                            transition={{
                              duration: 0.6,
                              ease: "easeOut",
                              type: "spring",
                              stiffness: 80,
                              damping: 14,
                            }}
                            style={{
                              boxShadow: `0 -10px 30px -10px ${style.hex}88`,
                              opacity: dim ? 0.35 : 1,
                              outline:
                                isResults && isCorrect
                                  ? "3px solid rgba(255,255,255,0.9)"
                                  : "none",
                              outlineOffset: isResults && isCorrect ? "2px" : 0,
                            }}
                          />
                        </div>

                        <div
                          className={`mt-3 flex flex-col items-center gap-1.5 ${
                            dim ? "opacity-50" : ""
                          }`}
                        >
                          <div className="h-7 w-7 sm:h-9 sm:w-9 text-white/95">
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
                              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="text-xs sm:text-sm font-semibold text-white text-center leading-tight line-clamp-2 max-w-full px-1">
                            {opt.text ||
                              (opt.image_url ? "" : `אפשרות ${idx + 1}`)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

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
                      {responses
                        .filter(
                          (r) => typeof r.answer_data.text === "string",
                        )
                        .map((r, i) => (
                          <li
                            key={i}
                            className="flex gap-3 items-start rounded-2xl bg-white/5 px-4 py-3 border border-white/5"
                          >
                            {r.avatar_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={r.avatar_url}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                {r.nickname.slice(0, 1)}
                              </span>
                            )}
                            <div className="flex-1">
                              <div className="text-xs uppercase tracking-wider text-white/40">
                                {r.nickname}
                              </div>
                              <div className="mt-0.5 text-lg text-white">
                                {r.answer_data.text}
                              </div>
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

            {currentQuestion.type === "true_false" && (
              <div className="grid w-full max-w-3xl grid-cols-2 gap-4">
                {currentQuestion.answer_options.map((opt) => {
                  const isTrue = opt.text === "נכון";
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
                  const correct = opt.is_correct;
                  const gradient = isTrue
                    ? "from-emerald-500 to-teal-600"
                    : "from-rose-500 to-red-600";
                  const hex = isTrue ? "#10b981" : "#e11d48";
                  return (
                    <div
                      key={opt.id}
                      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-8 ${
                        isResults && !correct ? "opacity-50" : ""
                      } ${
                        isResults && correct
                          ? "ring-4 ring-white/80 ring-offset-4 ring-offset-transparent"
                          : ""
                      }`}
                      style={{ boxShadow: `0 12px 40px -8px ${hex}66` }}
                    >
                      <div className="flex items-center justify-center text-6xl sm:text-7xl mb-3 text-white">
                        {isTrue ? "✓" : "✗"}
                      </div>
                      <div className="text-center text-2xl sm:text-3xl font-bold text-white">
                        {opt.text}
                      </div>
                      <div className="mt-4 text-center text-4xl sm:text-5xl font-extrabold text-white tabular-nums">
                        {count}
                      </div>
                      {isResults && (
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                          <div
                            className="h-full bg-white/95"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === "rating" && (() => {
              const ratings = responses
                .map((r) => (r.answer_data as { rating?: number }).rating)
                .filter((n): n is number => typeof n === "number");
              const total = ratings.length;
              const avg =
                total > 0
                  ? ratings.reduce((a, b) => a + b, 0) / total
                  : 0;
              const distribution = [1, 2, 3, 4, 5].map((score) => ({
                score,
                count: ratings.filter((r) => r === score).length,
              }));
              const max = Math.max(1, ...distribution.map((d) => d.count));
              if (session.state === "question_active") {
                return (
                  <div className="glass-strong rounded-3xl px-10 py-8 text-center">
                    <p className="text-xs uppercase tracking-wider text-white/50">
                      דירוגים שהתקבלו
                    </p>
                    <p
                      className="mt-2 font-extrabold gradient-text tabular-nums"
                      style={{
                        fontSize: "clamp(3.5rem, 10vw, 7rem)",
                        lineHeight: 1,
                      }}
                    >
                      {total}
                    </p>
                  </div>
                );
              }
              return (
                <div className="w-full max-w-2xl glass rounded-3xl p-6 flex flex-col gap-4">
                  <div className="flex items-baseline justify-center gap-3">
                    <span
                      className="font-extrabold gradient-text tabular-nums"
                      style={{
                        fontSize: "clamp(2.5rem, 8vw, 5rem)",
                        lineHeight: 1,
                      }}
                    >
                      {avg.toFixed(1)}
                    </span>
                    <span className="text-white/50">/ 5</span>
                    <span className="text-white/40 text-sm">
                      ({total} דירוגים)
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {distribution.map((d) => (
                      <div
                        key={d.score}
                        className="flex items-center gap-3"
                      >
                        <span className="w-6 text-center text-white/70 font-bold">
                          {d.score}
                        </span>
                        <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full gradient-bg"
                            style={{ width: `${(d.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-left text-white/60 text-sm tabular-nums">
                          {d.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {currentQuestion.type === "slide" && (
              <div className="text-center text-white/50 text-sm">
                שקופית מידע
              </div>
            )}

            {session.state === "question_active" &&
              currentQuestion.type === "slide" && (
                <button
                  onClick={nextQuestion}
                  className="gradient-bg brand-glow rounded-full px-10 py-4 text-lg font-bold text-white hover:scale-105 transition-transform"
                >
                  {isLastQuestion ? "סיימי משחק" : "המשך →"}
                </button>
              )}
            {session.state === "question_active" &&
              currentQuestion.type !== "slide" && (
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
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
          <h2 className="text-4xl sm:text-5xl font-bold gradient-text text-center">
            🏆 סיום משחק
          </h2>

          {(() => {
            const ranked = [...participants].sort(
              (a, b) => (b.score ?? 0) - (a.score ?? 0),
            );
            const podium = ranked.slice(0, 3);
            const rest = ranked.slice(3);
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <>
                {podium.length > 0 && (
                  <div className="grid w-full gap-3 sm:grid-cols-3">
                    {podium.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.5,
                          delay: (2 - i) * 0.35,
                          ease: "easeOut",
                        }}
                        className={`glass-strong rounded-3xl p-5 text-center flex flex-col items-center gap-2 ${
                          i === 0 ? "sm:-mt-4 brand-glow" : ""
                        }`}
                      >
                        <div className="text-3xl">{medals[i]}</div>
                        {p.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.avatar_url}
                            alt=""
                            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-white/30"
                          />
                        ) : (
                          <span className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white/15 flex items-center justify-center text-2xl font-bold text-white">
                            {p.nickname.slice(0, 1)}
                          </span>
                        )}
                        <div className="font-semibold text-white">
                          {p.nickname}
                        </div>
                        <div className="font-extrabold gradient-text text-3xl tabular-nums">
                          {p.score ?? 0}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {rest.length > 0 && (
                  <div className="w-full glass rounded-3xl p-4">
                    <ul className="space-y-1.5">
                      {rest.map((p, i) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 px-2 py-1.5"
                        >
                          <span className="w-6 text-center text-white/40 text-sm tabular-nums">
                            {i + 4}
                          </span>
                          {p.avatar_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.avatar_url}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                              {p.nickname.slice(0, 1)}
                            </span>
                          )}
                          <span className="flex-1 text-white">
                            {p.nickname}
                          </span>
                          <span className="text-white/80 font-bold tabular-nums">
                            {p.score ?? 0}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}

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
