"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { generateJoinCode } from "@/lib/joinCode";
import { useNow, remainingSeconds } from "@/lib/timer";
import { ANDEMBRY_QUIZ_ID, QUESTION_SECONDS } from "@/lib/eventConfig";
import type {
  AnswerOption,
  GameSession,
  Participant,
  Question,
  SessionState,
} from "@/lib/types";

type FullQuestion = Question & { answer_options: AnswerOption[] };

const SESSION_STORAGE_KEY = "andembry-event-session";
const REVEAL_MS = 5000;

// SVGs that match the demo — paths for triangle / diamond / circle / square
function OptionShape({ index }: { index: number }) {
  if (index === 0)
    return (
      <svg viewBox="0 0 32 32">
        <path d="M16 3l13 26H3z" />
      </svg>
    );
  if (index === 1)
    return (
      <svg viewBox="0 0 32 32">
        <path d="M16 2l14 14-14 14L2 16z" />
      </svg>
    );
  if (index === 2)
    return (
      <svg viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" />
      </svg>
    );
  return (
    <svg viewBox="0 0 32 32">
      <rect x="3" y="3" width="26" height="26" rx="3" />
    </svg>
  );
}

const ANS_CLASS = ["a0", "a1", "a2", "a3"] as const;
const BAR_CLASS = ["b0", "b1", "b2", "b3"] as const;

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

  // ---- Load participants ----
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

  // ---- Realtime subscriptions ----
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

  /** First REVEAL_MS shows the cards without live counters. */
  const questionElapsedMs =
    session?.state === "question_active" && session.question_started_at
      ? now - new Date(session.question_started_at).getTime()
      : Infinity;
  const isRevealPhase =
    session?.state === "question_active" && questionElapsedMs < REVEAL_MS;

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

    const idx = questions.findIndex((q) => q.id === currentQuestion.id);
    const next = questions[idx + 1];
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
    if (typeof window !== "undefined") window.location.reload();
  }, []);

  // ---- Keyboard / presentation-remote advance ----
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const advanceKeys = new Set([
        " ",
        "Spacebar",
        "Enter",
        "ArrowRight",
        "PageDown",
      ]);
      if (!advanceKeys.has(e.key)) return;
      if (e.repeat) return;
      e.preventDefault();

      if (session.state === "waiting") {
        if (participants.length > 0) startFirst();
      } else if (session.state === "showing_results") {
        goNext();
      } else if (session.state === "ended") {
        startFresh();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, participants.length, startFirst, goNext, startFresh]);

  // ---------- RENDER ----------

  if (bootError) {
    return (
      <>
        <EventBackground />
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--gold)" }}>
            {bootError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="cta-red rounded-full px-7 py-3 font-bold"
          >
            נסה שוב
          </button>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <EventBackground />
        <main className="flex min-h-screen items-center justify-center p-8 text-white/55">
          טוען את האירוע…
        </main>
      </>
    );
  }

  const joinUrl = origin ? `${origin}/join?code=${session.join_code}` : "";
  const formattedCode = session.join_code.replace(/(\d{3})(\d{3})/, "$1 $2");

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
    <>
      <EventBackground />
      <main className="relative z-10 flex min-h-screen flex-col">
        {/* TOPBAR */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-10 sm:py-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <Image
              src="/csl-logo.png"
              alt="CSL"
              width={120}
              height={26}
              priority
              className="h-6 w-auto rounded-md bg-white px-2 py-1 sm:h-7"
            />
            <Image
              src="/andembry-logo.png"
              alt="Andembry"
              width={120}
              height={22}
              priority
              className="h-5 w-auto opacity-95 brightness-0 invert sm:h-6"
            />
          </div>
          <span className="viewtag">Host · מסך מנחה</span>
        </header>

        {/* STAGE */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-12 sm:px-10">
          <AnimatePresence mode="wait">
            {/* ---------- WAITING ---------- */}
            {session.state === "waiting" && (
              <motion.section
                key="waiting"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45 }}
                className="w-full max-w-6xl"
              >
                <div className="grid items-center gap-8 md:grid-cols-[1.1fr_.9fr] md:gap-10">
                  {/* LEFT — title + steps + pin */}
                  <div className="text-right">
                    <div className="eyebrow-mini">חידון HAE אינטראקטיבי</div>
                    <h1
                      className="hero-title mt-2"
                      dir="ltr"
                      style={{
                        textAlign: "right",
                        fontSize: "clamp(2.4rem, 6vw, 4.4rem)",
                      }}
                    >
                      Beyond <span className="g">the</span> Attack
                    </h1>
                    <p
                      className="mt-3 max-w-md"
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontSize: "clamp(1rem, 2vw, 1.2rem)",
                      }}
                    >
                      סרקו את הקוד עם הנייד, הצטרפו לחידון ובדקו את הידע שלכם
                      על HAE ועל <span dir="ltr">Andembry</span>.
                    </p>

                    <div className="mt-7 flex flex-col gap-3">
                      <div className="flex items-center gap-3 font-semibold text-white/85">
                        <span className="step-num">1</span>
                        פותחים את מצלמת הנייד
                      </div>
                      <div className="flex items-center gap-3 font-semibold text-white/85">
                        <span className="step-num s2">2</span>
                        סורקים את קוד ה-QR
                      </div>
                      <div className="flex items-center gap-3 font-semibold text-white/85">
                        <span className="step-num s3">3</span>
                        מזינים שם ומצטרפים
                      </div>
                    </div>

                    <div className="pin-box mt-7">
                      <span className="lbl">או הצטרפות עם קוד</span>
                      <span
                        className="pin"
                        style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}
                      >
                        {formattedCode}
                      </span>
                    </div>
                  </div>

                  {/* RIGHT — QR card with gradient rim */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="mx-auto"
                  >
                    <div className="qr-card">
                      <div className="qtitle">סרקו להצטרפות</div>
                      <div className="qsub" dir="ltr">
                        {origin && origin.replace(/^https?:\/\//, "")}/join
                      </div>
                      <div className="qr-wrap">
                        {joinUrl ? (
                          <QRCodeSVG
                            value={joinUrl}
                            size={220}
                            level="M"
                            marginSize={0}
                            bgColor="#ffffff"
                            fgColor="#173d6e"
                          />
                        ) : (
                          <div style={{ height: 220 }} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* PARTICIPANTS + START */}
                <div className="mt-10 text-center">
                  <div className="eyebrow-mini">חדר המתנה</div>
                  <p
                    className="mt-2 font-extrabold"
                    style={{
                      color: "var(--gold)",
                      fontSize: "clamp(1.05rem, 2.4vw, 1.4rem)",
                    }}
                  >
                    <span style={{ fontSize: "1.5em" }}>
                      {participants.length}
                    </span>{" "}
                    משתתפים מחוברים
                  </p>

                  <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
                    <AnimatePresence initial={false}>
                      {participants.map((p) => (
                        <motion.div
                          key={p.id}
                          layout
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 22,
                          }}
                          className="player-chip"
                        >
                          <span className="av">
                            {p.nickname.slice(0, 1).toUpperCase()}
                          </span>
                          {p.nickname}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="mt-8 flex flex-col items-center gap-2">
                    <button
                      onClick={startFirst}
                      disabled={
                        advancing ||
                        questions.length === 0 ||
                        participants.length === 0
                      }
                      className="next-btn disabled:opacity-40"
                    >
                      להתחלת החידון
                      <svg viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                    {participants.length > 0 && <KbdHint />}
                    {participants.length === 0 && (
                      <p className="text-xs text-white/40">
                        הכפתור יופעל אחרי שמשתתף ראשון מצטרף
                      </p>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {/* ---------- QUESTION ACTIVE ---------- */}
            {session.state === "question_active" && currentQuestion && (
              <motion.section
                key={`q-${currentQuestion.id}-active`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-5xl"
              >
                <div className="mb-5 flex items-center justify-between text-white">
                  <span
                    className="font-bold opacity-80"
                    style={{ fontFamily: "var(--font-heebo)" }}
                  >
                    שאלה {currentIndex + 1} מתוך {questions.length}
                  </span>
                  <CountdownRing
                    remaining={remainingSec}
                    total={QUESTION_SECONDS}
                  />
                </div>

                <div className="q-text">{currentQuestion.question_text}</div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const count = voteCounts[opt.id] ?? 0;
                    return (
                      <motion.div
                        key={opt.id}
                        initial={{ opacity: 0, y: 16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          delay: idx * 0.08,
                          duration: 0.4,
                          type: "spring",
                          stiffness: 180,
                          damping: 18,
                        }}
                        className={`ans-card ${ANS_CLASS[idx]}`}
                      >
                        <span className="shape">
                          <OptionShape index={idx} />
                        </span>
                        <span className="label">{opt.text}</span>
                        {!isRevealPhase && (
                          <motion.span
                            key={`cnt-${opt.id}-${count}`}
                            initial={{ scale: 0.7 }}
                            animate={{ scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 280,
                              damping: 16,
                            }}
                            className="cnt"
                          >
                            {count}
                          </motion.span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {!isRevealPhase && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="mt-6 flex items-center justify-between text-white/75"
                    style={{ fontFamily: "var(--font-heebo)" }}
                  >
                    <span className="text-sm font-bold">
                      ענו עד כה:{" "}
                      <span className="text-white">
                        {totalVotes}
                      </span>{" "}
                      / {participants.length}
                    </span>
                    <button
                      onClick={endQuestionNow}
                      disabled={advancing}
                      className="rounded-full border px-5 py-2 text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{
                        borderColor: "rgba(255,255,255,0.25)",
                        color: "#fff",
                      }}
                    >
                      סיים שאלה עכשיו
                    </button>
                  </motion.div>
                )}
              </motion.section>
            )}

            {/* ---------- SHOWING RESULTS ---------- */}
            {session.state === "showing_results" && currentQuestion && (
              <motion.section
                key={`q-${currentQuestion.id}-results`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45 }}
                className="w-full max-w-5xl"
              >
                <div className="mb-5 flex items-center justify-between text-white">
                  <span
                    className="font-bold opacity-80"
                    style={{ fontFamily: "var(--font-heebo)" }}
                  >
                    תוצאות שאלה {currentIndex + 1}
                  </span>
                </div>

                <div
                  className="q-text"
                  style={{ fontSize: "clamp(1.1rem, 2.6vw, 1.6rem)" }}
                >
                  {currentQuestion.question_text}
                </div>

                <div
                  className="mt-6 grid items-end gap-3 sm:gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                    height: 280,
                  }}
                >
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const count = voteCounts[opt.id] ?? 0;
                    const pct = (count / maxVote) * 100;
                    const isCorrect = opt.is_correct;
                    const dim = !isCorrect;
                    return (
                      <div
                        key={opt.id}
                        className={`barcol ${BAR_CLASS[idx]} ${isCorrect ? "correct" : ""} ${dim ? "dim" : ""}`}
                      >
                        <motion.div
                          className="bar"
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct, 6)}%` }}
                          transition={{
                            duration: 0.9,
                            type: "spring",
                            stiffness: 80,
                            damping: 16,
                          }}
                        >
                          {count}
                        </motion.div>
                        <div className="sh-box">
                          <OptionShape index={idx} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 sm:gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                  }}
                >
                  {currentQuestion.answer_options.map((opt) => (
                    <div
                      key={opt.id}
                      className="text-center text-xs font-bold leading-tight sm:text-sm"
                      style={{
                        color: opt.is_correct
                          ? "var(--gold)"
                          : "rgba(255,255,255,0.6)",
                        fontFamily: "var(--font-heebo)",
                      }}
                    >
                      {opt.text}
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col items-center gap-2 text-center">
                  <button
                    onClick={goNext}
                    disabled={advancing}
                    className="next-btn"
                  >
                    {advancing
                      ? "טוען…"
                      : isLastQuestion
                        ? "לתוצאות הסופיות"
                        : "השאלה הבאה"}
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <KbdHint />
                </div>
              </motion.section>
            )}

            {/* ---------- ENDED ---------- */}
            {session.state === "ended" && (
              <motion.section
                key="ended"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45 }}
                className="w-full max-w-3xl text-center"
              >
                <div
                  className="mb-3 text-6xl"
                  style={{ animation: "beat 1.6s ease-in-out infinite" }}
                >
                  🏆
                </div>
                <h1
                  className="hero-title"
                  dir="ltr"
                  style={{ fontSize: "clamp(2.2rem, 6vw, 3.6rem)" }}
                >
                  Beyond the <span className="g">Attack</span>
                </h1>
                <p className="mt-2 text-white/80">
                  כל הכבוד למשתתפים! הנה המובילים:
                </p>

                {(() => {
                  const ranked = [...participants].sort(
                    (a, b) => (b.score ?? 0) - (a.score ?? 0),
                  );
                  const podium = ranked.slice(0, 3);
                  const rest = ranked.slice(3);
                  // Display silver-gold-bronze in visual order: 2nd, 1st, 3rd
                  const visualOrder = [1, 0, 2]
                    .map((rank) =>
                      podium[rank] ? { p: podium[rank], rank } : null,
                    )
                    .filter(
                      (
                        v,
                      ): v is { p: Participant; rank: number } => v !== null,
                    );

                  return (
                    <>
                      <div className="mt-8 flex items-end justify-center gap-4">
                        {visualOrder.map(({ p, rank }) => {
                          const cls = `p${rank + 1}` as
                            | "p1"
                            | "p2"
                            | "p3";
                          return (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, y: 60 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.6,
                                delay: (2 - rank) * 0.25,
                                ease: "easeOut",
                              }}
                              className={`pod ${cls}`}
                            >
                              <div className="medal">{rank + 1}</div>
                              <div className="pname">{p.nickname}</div>
                              <div className="block">{p.score ?? 0}</div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {rest.length > 0 && (
                        <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2 text-right">
                          {rest.map((p, i) => (
                            <motion.div
                              key={p.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: 0.7 + i * 0.05,
                              }}
                              className="lb-row"
                            >
                              <span className="lb-rank">{i + 4}</span>
                              <span className="lb-name">{p.nickname}</span>
                              <span className="lb-score">
                                {p.score ?? 0}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="mt-10 flex flex-col items-center gap-2">
                  <button onClick={startFresh} className="next-btn">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 5V1L7 6l5 5V7a6 6 0 11-6 6H4a8 8 0 108-8z" />
                    </svg>
                    אתגר חדש
                  </button>
                  <KbdHint />
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

function EventBackground() {
  return (
    <div className="event-bg" aria-hidden>
      <svg className="s1" viewBox="0 0 1000 1000" fill="none">
        <path
          d="M-100 250 Q 300 100 600 280 T 1100 240"
          stroke="#04b49d"
          strokeWidth="50"
          strokeLinecap="round"
          opacity="0.16"
        />
        <path
          d="M-100 340 Q 300 190 600 370 T 1100 330"
          stroke="#fec84e"
          strokeWidth="44"
          strokeLinecap="round"
          opacity="0.14"
        />
      </svg>
      <svg className="s2" viewBox="0 0 1000 1000" fill="none">
        <path
          d="M-100 700 Q 300 560 600 740 T 1100 690"
          stroke="#04b49d"
          strokeWidth="56"
          strokeLinecap="round"
          opacity="0.12"
        />
      </svg>
    </div>
  );
}

function KbdHint() {
  return (
    <div
      className="flex items-center gap-2 text-xs text-white/50"
      style={{
        fontFamily: "var(--font-heebo)",
        letterSpacing: "0.05em",
      }}
    >
      <span>גם עם</span>
      <kbd
        className="rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-bold text-white"
        style={{
          borderColor: "rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
        }}
      >
        Space
      </kbd>
      <span>או</span>
      <kbd
        className="rounded-md border px-2 py-0.5 font-mono text-[0.7rem] font-bold text-white"
        style={{
          borderColor: "rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
        }}
      >
        →
      </kbd>
      <span>· קליקר מצגות</span>
    </div>
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
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const urgent = remaining <= 5;
  return (
    <div className={`timer-ring ${urgent ? "urgent" : ""}`}>
      <svg
        viewBox="0 0 80 80"
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgba(23,61,110,0.12)"
          strokeWidth="6"
        />
        <motion.circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={urgent ? "var(--red)" : "var(--teal)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </svg>
      <span className="relative">{remaining}</span>
    </div>
  );
}
