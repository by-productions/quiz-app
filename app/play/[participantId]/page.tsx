"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { QUESTION_SECONDS } from "@/lib/eventConfig";
import { useNow, remainingSeconds } from "@/lib/timer";
import type {
  AnswerOption,
  GameSession,
  Participant,
  Question,
} from "@/lib/types";

type FullQuestion = Question & { answer_options: AnswerOption[] };

const ANS_CLASS = ["a0", "a1", "a2", "a3"] as const;

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

export default function PlayerPage() {
  const { participantId } = useParams<{ participantId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState<Participant | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Boot
  useEffect(() => {
    if (!participantId) return;
    let cancelled = false;
    (async () => {
      const { data: p, error: pErr } = await supabase
        .from("participants")
        .select("*")
        .eq("id", participantId)
        .maybeSingle();
      if (cancelled) return;
      if (pErr || !p) {
        setError("המשתתף לא נמצא");
        return;
      }
      const participant = p as Participant;
      setMe(participant);

      const { data: s } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", participant.session_id)
        .maybeSingle();
      if (cancelled) return;
      if (!s) {
        setError("המשחק לא נמצא");
        return;
      }
      const sess = s as GameSession;
      setSession(sess);

      const { data: qs } = await supabase
        .from("questions")
        .select("*, answer_options(*)")
        .eq("quiz_id", sess.quiz_id)
        .order("position");
      if (cancelled) return;
      const arr = (qs ?? []) as unknown as FullQuestion[];
      arr.forEach((q) =>
        q.answer_options.sort((a, b) => a.position - b.position),
      );
      setQuestions(arr);

      const { data: prevResp } = await supabase
        .from("responses")
        .select("question_id, answer_data")
        .eq("participant_id", participant.id);
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const r of (prevResp ?? []) as Array<{
        question_id: string;
        answer_data: { option_id?: string };
      }>) {
        if (r.answer_data?.option_id)
          map.set(r.question_id, r.answer_data.option_id);
      }
      setMyAnswers(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId, supabase]);

  // Realtime
  useEffect(() => {
    if (!session || !me) return;
    const channel = supabase
      .channel(`event-player-${session.id}-${me.id}`)
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
          event: "UPDATE",
          schema: "public",
          table: "participants",
          filter: `id=eq.${me.id}`,
        },
        (payload: { new: Participant }) => setMe(payload.new),
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [session?.id, me?.id, supabase]);

  const currentQuestion = questions.find(
    (q) => q.id === session?.current_question_id,
  );
  const currentIndex = currentQuestion
    ? questions.findIndex((q) => q.id === currentQuestion.id)
    : -1;

  const showCountdown =
    session?.state === "question_active" &&
    !!session.question_started_at &&
    !!currentQuestion;
  const now = useNow(!!showCountdown);
  const remaining = showCountdown
    ? remainingSeconds(session!.question_started_at!, QUESTION_SECONDS, now)
    : 0;

  const myAnswer = currentQuestion
    ? (myAnswers.get(currentQuestion.id) ?? null)
    : null;

  async function submitAnswer(optionId: string) {
    if (!session || !me || !currentQuestion) return;
    if (myAnswer || submitting) return;
    if (session.state !== "question_active") return;
    setSubmitting(true);
    setMyAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentQuestion.id, optionId);
      return next;
    });
    const { error: insErr } = await supabase.from("responses").insert({
      session_id: session.id,
      participant_id: me.id,
      question_id: currentQuestion.id,
      answer_data: { option_id: optionId },
    });
    if (insErr) {
      setMyAnswers((prev) => {
        const next = new Map(prev);
        next.delete(currentQuestion.id);
        return next;
      });
      setError("שגיאה בשליחת התשובה");
    }
    setSubmitting(false);
  }

  if (error) {
    return (
      <>
        <EventBackground />
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="font-bold" style={{ color: "var(--gold)" }}>
            {error}
          </p>
          <Link
            href="/join"
            className="text-sm text-white/70 hover:opacity-80"
          >
            חזרה לעמוד ההצטרפות
          </Link>
        </main>
      </>
    );
  }

  if (!session || !me) {
    return (
      <>
        <EventBackground />
        <main className="relative z-10 flex min-h-screen items-center justify-center p-8 text-white/55">
          טוען…
        </main>
      </>
    );
  }

  const lastQuestionAnswered =
    questions.length > 0 &&
    myAnswers.has(questions[questions.length - 1].id);

  return (
    <>
      <EventBackground />
      <main className="relative z-10 flex min-h-screen flex-col">
        {/* TOPBAR */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          {/* RIGHT corner (RTL) — Andembry, full color on a white chip */}
          <Image
            src="/andembry-logo.png"
            alt="Andembry"
            width={160}
            height={34}
            priority
            className="h-9 w-auto rounded-xl bg-white px-2.5 py-1.5"
          />
          {/* LEFT corner — CSL + participant name */}
          <div className="flex items-center gap-2.5">
            <Image
              src="/csl-logo.png"
              alt="CSL"
              width={120}
              height={28}
              priority
              className="h-8 w-auto rounded-xl bg-white px-2.5 py-1.5"
            />
            <span className="viewtag teal">{me.nickname}</span>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
          <AnimatePresence mode="wait">
            {/* ---------- WAITING ---------- */}
            {session.state === "waiting" && (
              <motion.section
                key="waiting"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-6 text-center"
              >
                <div className="pulse-orb">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
                  </svg>
                </div>
                <h2
                  className="text-3xl font-extrabold"
                  style={{
                    color: "#fff",
                    fontFamily: "var(--font-heebo)",
                  }}
                >
                  נכנסת לחידון!
                </h2>
                <p className="text-base text-white/70">
                  ממתינים שהמנחה יתחיל…
                </p>
                <span
                  className="rounded-full px-5 py-2 text-base font-extrabold"
                  style={{
                    background: "var(--mint)",
                    color: "var(--teal-deep)",
                  }}
                >
                  {me.nickname}
                </span>
              </motion.section>
            )}

            {/* ---------- QUESTION ACTIVE — choose answer ---------- */}
            {session.state === "question_active" &&
              currentQuestion &&
              !myAnswer && (
                <motion.section
                  key={`q-${currentQuestion.id}-pick`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.4 }}
                  className="flex w-full max-w-md flex-col gap-4"
                >
                  <div className="flex items-center justify-between text-white/75">
                    <span
                      className="text-sm font-bold"
                      style={{ fontFamily: "var(--font-heebo)" }}
                    >
                      שאלה {currentIndex + 1} / {questions.length}
                    </span>
                    <motion.span
                      key={`t-${remaining}`}
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className="font-mono text-2xl font-extrabold tabular-nums"
                      style={{
                        color: remaining <= 5 ? "var(--red)" : "var(--gold)",
                      }}
                    >
                      {remaining}
                    </motion.span>
                  </div>

                  <div
                    className="q-text"
                    style={{ fontSize: "clamp(1.1rem, 4vw, 1.5rem)" }}
                  >
                    {currentQuestion.question_text}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {currentQuestion.answer_options.map((opt, idx) => (
                      <motion.button
                        key={opt.id}
                        onClick={() => submitAnswer(opt.id)}
                        disabled={submitting}
                        whileTap={{ scale: 0.94 }}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: idx * 0.06,
                          duration: 0.35,
                        }}
                        className={`ans-card tappable ${ANS_CLASS[idx]} flex aspect-square flex-col items-center justify-center gap-2 text-center disabled:opacity-60`}
                      >
                        <span className="shape h-9 w-9">
                          <OptionShape index={idx} />
                        </span>
                        <span
                          className="label text-base font-bold leading-tight"
                          style={{
                            textAlign: "center",
                            fontSize: "clamp(0.9rem, 3.5vw, 1.05rem)",
                          }}
                        >
                          {opt.text}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.section>
              )}

            {/* ---------- QUESTION ACTIVE — locked (answered) ---------- */}
            {session.state === "question_active" &&
              currentQuestion &&
              myAnswer && (
                <motion.section
                  key={`q-${currentQuestion.id}-locked`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{
                    type: "spring",
                    stiffness: 220,
                    damping: 20,
                  }}
                  className="flex flex-col items-center gap-6 text-center"
                >
                  <div className="pulse-orb gold">
                    <svg viewBox="0 0 24 24">
                      <path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.4-1.4z" />
                    </svg>
                  </div>
                  <h3
                    className="text-2xl font-extrabold text-white"
                    style={{ fontFamily: "var(--font-heebo)" }}
                  >
                    התשובה נקלטה!
                  </h3>
                  <p className="text-base text-white/70">
                    ממתינים לסיום הזמן…
                  </p>
                </motion.section>
              )}

            {/* ---------- SHOWING RESULTS — personal outcome ---------- */}
            {session.state === "showing_results" && currentQuestion && (
              <motion.section
                key={`r-${currentQuestion.id}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45 }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <AnswerOutcome
                  myAnswer={myAnswer}
                  options={currentQuestion.answer_options}
                />
                <p className="max-w-sm text-base font-semibold text-white/75">
                  הסתכלו על המסך הגדול לתוצאות ולתשובת המומחה
                </p>
              </motion.section>
            )}

            {/* ---------- ENDED ---------- */}
            {session.state === "ended" && (
              <motion.section
                key="ended"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <div
                  className="text-7xl"
                  style={{ animation: "beat 1.6s ease-in-out infinite" }}
                >
                  🎉
                </div>
                <h2
                  className="text-2xl font-extrabold text-white"
                  style={{ fontFamily: "var(--font-heebo)" }}
                >
                  {lastQuestionAnswered ? "סיימת את החידון!" : "תודה שהצטרפת!"}
                </h2>
                <div
                  className="rounded-2xl px-7 py-5"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <div
                    className="text-xs font-bold uppercase"
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.2em",
                    }}
                  >
                    הניקוד שלך
                  </div>
                  <div className="gradient-text mt-1 text-5xl font-extrabold tabular-nums">
                    {me.score ?? 0}
                  </div>
                </div>
                <p className="max-w-sm text-sm text-white/65">
                  הדירוג המלא מוצג על המסך הגדול.
                </p>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}

function AnswerOutcome({
  myAnswer,
  options,
}: {
  myAnswer: string | null;
  options: AnswerOption[];
}) {
  const correct = options.find((o) => o.is_correct);
  const correctId = correct?.id ?? null;
  const isRight = !!myAnswer && myAnswer === correctId;
  const didNotAnswer = !myAnswer;

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className="flex flex-col items-center gap-4"
    >
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full text-white"
        style={{
          background: didNotAnswer
            ? "linear-gradient(135deg,#94a3b8,#475569)"
            : isRight
              ? "linear-gradient(135deg,var(--teal),var(--teal-deep))"
              : "linear-gradient(135deg,#9aa6b2,#6b7785)",
          boxShadow: isRight
            ? "0 24px 50px -16px rgba(4,180,157,0.55)"
            : "0 24px 50px -16px rgba(100,116,139,0.45)",
        }}
      >
        {didNotAnswer ? (
          <span className="text-5xl">⏱</span>
        ) : isRight ? (
          <svg viewBox="0 0 24 24" className="h-14 w-14" fill="#fff">
            <path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.4-1.4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-14 w-14" fill="#fff">
            <path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
          </svg>
        )}
      </div>
      <h3
        className="text-2xl font-extrabold text-white"
        style={{ fontFamily: "var(--font-heebo)" }}
      >
        {didNotAnswer
          ? "לא הספקת לענות"
          : isRight
            ? "תשובה נכונה! 🎯"
            : "לא נכון הפעם"}
      </h3>
    </motion.div>
  );
}
