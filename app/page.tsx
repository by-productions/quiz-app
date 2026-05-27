"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { generateJoinCode } from "@/lib/joinCode";
import { useNow, remainingSeconds } from "@/lib/timer";
import { ANDEMBRY_QUIZ_ID, QUESTION_SECONDS, optionPalette } from "@/lib/eventConfig";
import type {
  AnswerOption,
  GameSession,
  Participant,
  Question,
  SessionState,
} from "@/lib/types";

type FullQuestion = Question & { answer_options: AnswerOption[] };

const SESSION_STORAGE_KEY = "andembry-event-session";

function OptionShape({
  kind,
  className,
}: {
  kind: "triangle" | "diamond" | "circle" | "square";
  className?: string;
}) {
  const props = {
    viewBox: "0 0 100 100",
    fill: "currentColor",
    "aria-hidden": true,
    className,
  } as const;
  if (kind === "triangle")
    return (
      <svg {...props}>
        <polygon points="50,15 92,85 8,85" />
      </svg>
    );
  if (kind === "diamond")
    return (
      <svg {...props}>
        <polygon points="50,8 92,50 50,92 8,50" />
      </svg>
    );
  if (kind === "circle")
    return (
      <svg {...props}>
        <circle cx="50" cy="50" r="38" />
      </svg>
    );
  return (
    <svg {...props}>
      <rect x="15" y="15" width="70" height="70" rx="10" />
    </svg>
  );
}

export default function EventHostPage() {
  const supabase = useMemo(() => createClient(), []);

  const [bootError, setBootError] = useState<string | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<
    Array<{ participant_id: string; question_id: string; option_id: string }>
  >([]);
  const [origin, setOrigin] = useState("");
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // ---- Boot: find or create the host's session for this quiz ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(SESSION_STORAGE_KEY)
            : null;

        if (stored) {
          const { data } = await supabase
            .from("game_sessions")
            .select("*")
            .eq("id", stored)
            .maybeSingle();
          const sess = data as GameSession | null;
          if (sess && sess.state !== "ended") {
            if (!cancelled) setSession(sess);
            return;
          }
        }

        // Create a fresh session — retry on rare join_code collision
        for (let i = 0; i < 5; i++) {
          const code = generateJoinCode();
          const { data, error } = await supabase
            .from("game_sessions")
            .insert({
              quiz_id: ANDEMBRY_QUIZ_ID,
              join_code: code,
              state: "waiting",
            })
            .select()
            .single();
          if (!error && data) {
            const sess = data as GameSession;
            if (!cancelled) {
              localStorage.setItem(SESSION_STORAGE_KEY, sess.id);
              setSession(sess);
            }
            return;
          }
          if (error?.code !== "23505") {
            throw error ?? new Error("unknown insert error");
          }
        }
        throw new Error("לא הצלחנו לייצר קוד הצטרפות פנוי");
      } catch (e) {
        if (!cancelled)
          setBootError(
            e instanceof Error ? e.message : "שגיאה בהתחלת האירוע",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // ---- Load questions once we have a session ----
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("questions")
        .select("*, answer_options(*)")
        .eq("quiz_id", session.quiz_id)
        .order("position");
      if (cancelled) return;
      const qs = (data ?? []) as unknown as FullQuestion[];
      qs.forEach((q) =>
        q.answer_options.sort((a, b) => a.position - b.position),
      );
      setQuestions(qs);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  // ---- Load existing participants + subscribe to live updates ----
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", session.id)
        .order("joined_at");
      if (!cancelled) setParticipants((data ?? []) as Participant[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`event-host-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload: { new: GameSession }) => setSession(payload.new),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${session.id}`,
        },
        (payload: { new: Participant }) =>
          setParticipants((prev) =>
            prev.some((p) => p.id === payload.new.id)
              ? prev
              : [...prev, payload.new],
          ),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${session.id}`,
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
          filter: `session_id=eq.${session.id}`,
        },
        (payload: {
          new: {
            participant_id: string;
            question_id: string;
            answer_data: { option_id?: string };
          };
        }) => {
          if (!payload.new.answer_data?.option_id) return;
          setResponses((prev) =>
            prev.some(
              (r) =>
                r.participant_id === payload.new.participant_id &&
                r.question_id === payload.new.question_id,
            )
              ? prev
              : [
                  ...prev,
                  {
                    participant_id: payload.new.participant_id,
                    question_id: payload.new.question_id,
                    option_id: payload.new.answer_data.option_id!,
                  },
                ],
          );
        },
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [session?.id, supabase]);

  // ---- Refetch responses on question change ----
  useEffect(() => {
    if (!session?.current_question_id) {
      setResponses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("responses")
        .select("participant_id, question_id, answer_data")
        .eq("session_id", session.id)
        .eq("question_id", session.current_question_id);
      if (cancelled) return;
      const rows = (
        (data ?? []) as Array<{
          participant_id: string;
          question_id: string;
          answer_data: { option_id?: string };
        }>
      )
        .filter((r) => !!r.answer_data?.option_id)
        .map((r) => ({
          participant_id: r.participant_id,
          question_id: r.question_id,
          option_id: r.answer_data.option_id!,
        }));
      setResponses(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.current_question_id, session?.id, supabase]);

  const currentQuestion = questions.find(
    (q) => q.id === session?.current_question_id,
  );
  const currentIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id)
    : -1;
  const isLastQuestion =
    currentIndex >= 0 && currentIndex === questions.length - 1;

  const showCountdown =
    session?.state === "question_active" &&
    !!session.question_started_at &&
    !!currentQuestion;

  const now = useNow(!!showCountdown);
  const remainingSec = showCountdown
    ? remainingSeconds(session!.question_started_at!, QUESTION_SECONDS, now)
    : 0;

  // Auto-advance to results when timer hits 0
  const autoAdvancing = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (session.state !== "question_active") {
      autoAdvancing.current = false;
      return;
    }
    if (remainingSec > 0) return;
    if (autoAdvancing.current) return;
    autoAdvancing.current = true;
    (async () => {
      await supabase
        .from("game_sessions")
        .update({ state: "showing_results" as SessionState })
        .eq("id", session.id);
    })();
  }, [remainingSec, session, supabase]);

  const startFirst = useCallback(async () => {
    if (!session || advancing) return;
    const first = questions[0];
    if (!first) return;
    setAdvancing(true);
    await supabase
      .from("game_sessions")
      .update({
        state: "question_active" as SessionState,
        current_question_id: first.id,
        question_started_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    setAdvancing(false);
  }, [advancing, questions, session, supabase]);

  const endQuestionNow = useCallback(async () => {
    if (!session || advancing) return;
    setAdvancing(true);
    await supabase
      .from("game_sessions")
      .update({ state: "showing_results" as SessionState })
      .eq("id", session.id);
    setAdvancing(false);
  }, [advancing, session, supabase]);

  const goNext = useCallback(async () => {
    if (!session || !currentQuestion || advancing) return;
    setAdvancing(true);
    const idx = questions.findIndex((q) => q.id === currentQuestion.id);
    const next = questions[idx + 1];

    // Score this question first: +100 to each participant who picked the correct option
    const correct = currentQuestion.answer_options.find((o) => o.is_correct);
    if (correct) {
      const correctIds = responses
        .filter(
          (r) =>
            r.question_id === currentQuestion.id && r.option_id === correct.id,
        )
        .map((r) => r.participant_id);
      await Promise.all(
        correctIds.map((pid) => {
          const p = participants.find((pp) => pp.id === pid);
          if (!p) return null;
          return supabase
            .from("participants")
            .update({ score: (p.score ?? 0) + 100 })
            .eq("id", pid);
        }),
      );
    }

    if (next) {
      await supabase
        .from("game_sessions")
        .update({
          state: "question_active" as SessionState,
          current_question_id: next.id,
          question_started_at: new Date().toISOString(),
        })
        .eq("id", session.id);
    } else {
      await supabase
        .from("game_sessions")
        .update({ state: "ended" as SessionState })
        .eq("id", session.id);
    }
    setAdvancing(false);
  }, [
    advancing,
    currentQuestion,
    participants,
    questions,
    responses,
    session,
    supabase,
  ]);

  const startFresh = useCallback(async () => {
    if (typeof window !== "undefined")
      localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setResponses([]);
    setParticipants([]);
    // The boot effect runs again because session is now null.
    // We force a remount of the page by reloading.
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  // ---------- RENDER ----------

  if (bootError) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p
          className="text-lg font-bold"
          style={{ color: "var(--red)" }}
        >
          {bootError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="cta-red rounded-full px-7 py-3 font-bold"
          style={{ fontFamily: "var(--font-heebo)" }}
        >
          נסה שוב
        </button>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        className="flex flex-1 items-center justify-center p-8"
        style={{ color: "var(--foreground-faint)" }}
      >
        טוען את האירוע…
      </main>
    );
  }

  const joinUrl = origin
    ? `${origin}/join?code=${session.join_code}`
    : "";

  // Tally votes for current question
  const voteCounts: Record<string, number> = {};
  if (currentQuestion) {
    for (const opt of currentQuestion.answer_options) voteCounts[opt.id] = 0;
    for (const r of responses) {
      if (r.question_id === currentQuestion.id) {
        voteCounts[r.option_id] = (voteCounts[r.option_id] ?? 0) + 1;
      }
    }
  }
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const maxVote = Math.max(1, ...Object.values(voteCounts));

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      {/* Top nav with logos */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-10 sm:py-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/csl-logo.png"
            alt="CSL"
            width={120}
            height={30}
            priority
            className="h-7 w-auto sm:h-9"
          />
          <span className="hidden h-7 w-px bg-gradient-to-b from-[var(--grey)] to-transparent sm:inline-block" />
          <Image
            src="/andembry-logo.png"
            alt="Andembry"
            width={120}
            height={24}
            priority
            className="hidden h-5 w-auto opacity-95 sm:block sm:h-7"
          />
        </div>
        <div
          className="text-xs font-bold uppercase sm:text-sm"
          style={{
            letterSpacing: "0.3em",
            color: "var(--teal-deep)",
            fontFamily: "var(--font-heebo)",
          }}
        >
          Beyond the Attack
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-12 sm:px-10">
        <AnimatePresence mode="wait">
          {/* ---------- WAITING — show QR + code ---------- */}
          {session.state === "waiting" && (
            <motion.section
              key="waiting"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45 }}
              className="flex w-full max-w-6xl flex-col items-center gap-10"
            >
              <div className="text-center">
                <span className="eyebrow">הצטרפו לחידון</span>
                <h1
                  className="hero-title mt-4"
                  dir="ltr"
                  style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)" }}
                >
                  Beyond <span className="amp">the</span> Attack
                </h1>
                <p
                  className="mx-auto mt-3 max-w-xl text-base sm:text-lg"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  סרקו את ה-QR או הקלידו את הקוד בטלפון שלכם.
                </p>
              </div>

              <div className="flex w-full flex-col items-center gap-8 md:flex-row md:justify-center md:gap-14">
                {/* Big code */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center"
                >
                  <div
                    className="text-xs font-bold uppercase"
                    style={{
                      letterSpacing: "0.3em",
                      color: "var(--foreground-muted)",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    קוד הצטרפות
                  </div>
                  <p
                    className="gradient-text mt-3 font-mono font-extrabold tabular-nums"
                    style={{
                      fontSize: "clamp(4.5rem, 14vw, 9.5rem)",
                      lineHeight: 1,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {session.join_code}
                  </p>
                  <div
                    className="mt-4 text-sm"
                    style={{
                      color: "var(--foreground-muted)",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    {origin && (
                      <>
                        או נכנסים ל-
                        <span
                          dir="ltr"
                          className="font-mono font-bold"
                          style={{ color: "var(--navy)" }}
                        >
                          {origin.replace(/^https?:\/\//, "")}/join
                        </span>
                      </>
                    )}
                  </div>
                </motion.div>

                {/* QR */}
                {joinUrl && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.86 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45, delay: 0.12 }}
                    className="rounded-3xl bg-white p-5 shadow-[0_30px_70px_-30px_rgba(15,44,82,0.6)]"
                  >
                    <QRCodeSVG
                      value={joinUrl}
                      size={220}
                      level="M"
                      marginSize={0}
                      bgColor="#ffffff"
                      fgColor="#173d6e"
                    />
                  </motion.div>
                )}
              </div>

              {/* Participants */}
              <div className="w-full max-w-3xl">
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className="text-xs font-bold uppercase"
                    style={{
                      letterSpacing: "0.3em",
                      color: "var(--foreground-muted)",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    מצטרפים
                  </span>
                  <motion.span
                    key={`count-${participants.length}`}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-2xl font-extrabold tabular-nums"
                    style={{
                      color: "var(--teal-deep)",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    {participants.length}
                  </motion.span>
                </div>
                <div className="glass rounded-3xl p-5 min-h-24">
                  {participants.length === 0 ? (
                    <p
                      className="py-6 text-center"
                      style={{ color: "var(--foreground-faint)" }}
                    >
                      ממתינים למצטרפים…
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      <AnimatePresence initial={false}>
                        {participants.map((p) => (
                          <motion.li
                            key={p.id}
                            layout
                            initial={{ opacity: 0, scale: 0.5, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{
                              type: "spring",
                              stiffness: 320,
                              damping: 22,
                            }}
                            className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold"
                            style={{
                              background: "rgba(4,180,157,0.12)",
                              color: "var(--teal-deep)",
                              fontFamily: "var(--font-heebo)",
                            }}
                          >
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg,var(--teal),var(--navy))",
                              }}
                            >
                              {p.nickname.slice(0, 1)}
                            </span>
                            {p.nickname}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>
              </div>

              <button
                onClick={startFirst}
                disabled={
                  advancing || questions.length === 0 || participants.length === 0
                }
                className="cta-red rounded-full px-12 py-5 text-xl font-extrabold disabled:cursor-not-allowed disabled:opacity-40"
                style={{ fontFamily: "var(--font-heebo)" }}
              >
                {advancing ? "מתחיל…" : "התחלת החידון"}
              </button>
              {participants.length === 0 && (
                <p
                  className="-mt-6 text-xs"
                  style={{ color: "var(--foreground-faint)" }}
                >
                  הכפתור יופעל אחרי שמשתתף ראשון מצטרף
                </p>
              )}
            </motion.section>
          )}

          {/* ---------- QUESTION ACTIVE / SHOWING RESULTS ---------- */}
          {(session.state === "question_active" ||
            session.state === "showing_results") &&
            currentQuestion && (
              <motion.section
                key={`q-${currentQuestion.id}-${session.state}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.4 }}
                className="flex w-full max-w-6xl flex-col items-center gap-8"
              >
                {/* Header strip */}
                <div className="flex w-full items-center justify-between">
                  <span
                    className="text-xs font-bold uppercase"
                    style={{
                      letterSpacing: "0.3em",
                      color: "var(--foreground-muted)",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    שאלה {currentIndex + 1} / {questions.length}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold uppercase"
                    style={{
                      background:
                        session.state === "question_active"
                          ? "rgba(4,180,157,0.15)"
                          : "rgba(254,200,78,0.2)",
                      color:
                        session.state === "question_active"
                          ? "var(--teal-deep)"
                          : "var(--gold-deep)",
                      letterSpacing: "0.2em",
                      fontFamily: "var(--font-heebo)",
                    }}
                  >
                    {session.state === "question_active" ? "פעיל" : "תוצאות"}
                  </span>
                </div>

                {/* Question text */}
                <h2
                  className="text-center font-bold leading-tight"
                  style={{
                    color: "var(--navy)",
                    fontFamily: "var(--font-heebo)",
                    fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
                  }}
                >
                  {currentQuestion.question_text}
                </h2>

                {/* Timer / vote count */}
                {session.state === "question_active" && (
                  <div className="flex items-center gap-8">
                    <CountdownRing
                      remaining={remainingSec}
                      total={QUESTION_SECONDS}
                    />
                    <div className="flex flex-col items-start">
                      <span
                        className="text-xs font-bold uppercase"
                        style={{
                          letterSpacing: "0.25em",
                          color: "var(--foreground-muted)",
                          fontFamily: "var(--font-heebo)",
                        }}
                      >
                        ענו
                      </span>
                      <motion.span
                        key={`tv-${totalVotes}`}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 18,
                        }}
                        className="font-mono text-5xl font-extrabold tabular-nums"
                        style={{
                          color: "var(--navy)",
                          fontFamily: "var(--font-heebo)",
                        }}
                      >
                        {totalVotes}
                        <span
                          className="text-2xl"
                          style={{ color: "var(--foreground-muted)" }}
                        >
                          {" "}
                          / {participants.length}
                        </span>
                      </motion.span>
                    </div>
                  </div>
                )}

                {/* Bars */}
                <div
                  className="grid w-full max-w-5xl gap-4 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, minmax(0, 1fr))`,
                  }}
                >
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const palette = optionPalette(idx);
                    const count = voteCounts[opt.id] ?? 0;
                    const isResults = session.state === "showing_results";
                    const isCorrect = opt.is_correct;
                    const dim = isResults && !isCorrect;
                    // Bar height % of the tallest bar (so the tallest fills its box)
                    const heightPct = isResults
                      ? (count / maxVote) * 100
                      : Math.min(100, (count / Math.max(1, participants.length)) * 100);

                    return (
                      <div
                        key={opt.id}
                        className="flex h-[280px] flex-col items-center justify-end sm:h-[360px]"
                      >
                        {isResults && isCorrect && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.7 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className="mb-2 rounded-full px-3 py-0.5 text-xs font-extrabold uppercase"
                            style={{
                              background: "var(--gold)",
                              color: "var(--navy-deep)",
                              letterSpacing: "0.15em",
                              fontFamily: "var(--font-heebo)",
                            }}
                          >
                            ✓ תשובה נכונה
                          </motion.div>
                        )}
                        <motion.span
                          key={`cnt-${opt.id}-${count}`}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.25 }}
                          className="mb-2 font-mono text-3xl font-extrabold tabular-nums sm:text-4xl"
                          style={{
                            color: "var(--navy)",
                            opacity: dim ? 0.4 : 1,
                          }}
                        >
                          {count}
                        </motion.span>

                        <div className="flex w-full flex-1 items-end">
                          <motion.div
                            className="w-full rounded-t-2xl"
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPct}%` }}
                            transition={{
                              duration: 0.7,
                              type: "spring",
                              stiffness: 100,
                              damping: 16,
                            }}
                            style={{
                              background: `linear-gradient(180deg, ${palette.hex} 0%, ${palette.deep} 100%)`,
                              boxShadow: `0 -16px 36px -10px ${palette.hex}55`,
                              opacity: dim ? 0.32 : 1,
                              outline:
                                isResults && isCorrect
                                  ? `4px solid var(--gold)`
                                  : "none",
                              outlineOffset: isResults && isCorrect ? "3px" : 0,
                            }}
                          />
                        </div>

                        <div
                          className="mt-3 flex flex-col items-center gap-2"
                          style={{ opacity: dim ? 0.5 : 1 }}
                        >
                          <div
                            className="h-8 w-8 sm:h-10 sm:w-10"
                            style={{ color: palette.hex }}
                          >
                            <OptionShape
                              kind={palette.shape}
                              className="h-full w-full"
                            />
                          </div>
                          <div
                            className="text-center text-sm font-bold leading-tight sm:text-base"
                            style={{
                              color: "var(--navy)",
                              fontFamily: "var(--font-heebo)",
                            }}
                          >
                            {opt.text}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                  {session.state === "question_active" && (
                    <button
                      onClick={endQuestionNow}
                      disabled={advancing}
                      className="rounded-full border-2 px-7 py-3 text-base font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{
                        borderColor: "rgba(23,61,110,0.22)",
                        color: "var(--navy)",
                        fontFamily: "var(--font-heebo)",
                      }}
                    >
                      סיים שאלה עכשיו
                    </button>
                  )}
                  {session.state === "showing_results" && (
                    <button
                      onClick={goNext}
                      disabled={advancing}
                      className="cta-red rounded-full px-10 py-4 text-lg font-extrabold disabled:opacity-50"
                      style={{ fontFamily: "var(--font-heebo)" }}
                    >
                      {advancing
                        ? "טוען…"
                        : isLastQuestion
                          ? "סיום החידון"
                          : "השאלה הבאה ←"}
                    </button>
                  )}
                </div>
              </motion.section>
            )}

          {/* ---------- ENDED — leaderboard ---------- */}
          {session.state === "ended" && (
            <motion.section
              key="ended"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.4 }}
              className="flex w-full max-w-4xl flex-col items-center gap-8"
            >
              <div className="text-center">
                <span className="eyebrow">סוף המסע</span>
                <h2
                  className="section-title mt-4"
                  style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)" }}
                >
                  תודה <span className="accent">לכולכם</span>
                </h2>
              </div>

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
                      <div className="grid w-full gap-4 sm:grid-cols-3">
                        {podium.map((p, i) => (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: (2 - i) * 0.3,
                              duration: 0.55,
                              ease: "easeOut",
                            }}
                            className="glass-strong flex flex-col items-center gap-3 rounded-3xl p-6 text-center"
                            style={{
                              transform: i === 0 ? "translateY(-12px)" : "none",
                              boxShadow:
                                i === 0
                                  ? "0 30px 60px -20px rgba(4,180,157,0.45)"
                                  : undefined,
                            }}
                          >
                            <div className="text-4xl">{medals[i]}</div>
                            <span
                              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-extrabold text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg,var(--teal),var(--navy))",
                              }}
                            >
                              {p.nickname.slice(0, 1)}
                            </span>
                            <div
                              className="text-lg font-bold"
                              style={{
                                color: "var(--navy)",
                                fontFamily: "var(--font-heebo)",
                              }}
                            >
                              {p.nickname}
                            </div>
                            <div className="gradient-text text-3xl font-extrabold tabular-nums">
                              {p.score ?? 0}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {rest.length > 0 && (
                      <ul className="w-full divide-y rounded-3xl glass overflow-hidden">
                        {rest.map((p, i) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 px-5 py-3"
                          >
                            <span
                              className="w-6 text-center text-sm tabular-nums"
                              style={{ color: "var(--foreground-faint)" }}
                            >
                              {i + 4}
                            </span>
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white"
                              style={{
                                background:
                                  "linear-gradient(135deg,var(--teal),var(--navy))",
                              }}
                            >
                              {p.nickname.slice(0, 1)}
                            </span>
                            <span
                              className="flex-1 font-bold"
                              style={{
                                color: "var(--navy)",
                                fontFamily: "var(--font-heebo)",
                              }}
                            >
                              {p.nickname}
                            </span>
                            <span
                              className="text-lg font-extrabold tabular-nums"
                              style={{ color: "var(--teal-deep)" }}
                            >
                              {p.score ?? 0}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                );
              })()}

              <button
                onClick={startFresh}
                className="cta-red rounded-full px-10 py-4 text-lg font-extrabold"
                style={{ fontFamily: "var(--font-heebo)" }}
              >
                סיבוב חדש
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function CountdownRing({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const pct = Math.max(0, Math.min(1, remaining / total));
  const radius = 60;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;
  const urgent = remaining <= 5;
  const ringColor = urgent ? "var(--red)" : "var(--teal)";
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 140 140" className="absolute inset-0">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(23,61,110,0.1)"
          strokeWidth="10"
        />
        <motion.circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.3, ease: "linear" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "70px 70px" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center font-mono text-5xl font-extrabold tabular-nums"
        style={{
          color: urgent ? "var(--red)" : "var(--navy)",
          fontFamily: "var(--font-heebo)",
        }}
      >
        {remaining}
      </div>
    </div>
  );
}
