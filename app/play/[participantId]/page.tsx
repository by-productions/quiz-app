"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { QUESTION_SECONDS, optionPalette } from "@/lib/eventConfig";
import { useNow, remainingSeconds } from "@/lib/timer";
import type {
  AnswerOption,
  GameSession,
  Participant,
  Question,
} from "@/lib/types";

type FullQuestion = Question & { answer_options: AnswerOption[] };

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

export default function PlayerPage() {
  const { participantId } = useParams<{ participantId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [me, setMe] = useState<Participant | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<Map<string, string>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Boot ----
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
        if (r.answer_data?.option_id) map.set(r.question_id, r.answer_data.option_id);
      }
      setMyAnswers(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId, supabase]);

  // ---- Realtime — session + my participant updates ----
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
    ? myAnswers.get(currentQuestion.id) ?? null
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
      // Rollback optimistic state if the insert failed
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
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p style={{ color: "var(--red)" }} className="font-bold">
          {error}
        </p>
        <Link
          href="/join"
          className="text-sm hover:opacity-70"
          style={{ color: "var(--foreground-muted)" }}
        >
          חזרה לעמוד ההצטרפות
        </Link>
      </main>
    );
  }

  if (!session || !me) {
    return (
      <main
        className="flex flex-1 items-center justify-center p-8"
        style={{ color: "var(--foreground-faint)" }}
      >
        טוען…
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      {/* Top — name + score */}
      <header className="flex items-center justify-between px-5 py-4">
        <Image
          src="/csl-logo.png"
          alt="CSL"
          width={120}
          height={30}
          priority
          className="h-7 w-auto"
        />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div
              className="text-xs font-bold uppercase"
              style={{
                color: "var(--foreground-muted)",
                letterSpacing: "0.18em",
              }}
            >
              שלום
            </div>
            <div
              className="text-base font-extrabold"
              style={{ color: "var(--navy)", fontFamily: "var(--font-heebo)" }}
            >
              {me.nickname}
            </div>
          </div>
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white"
            style={{
              background: "linear-gradient(135deg,var(--teal),var(--navy))",
            }}
          >
            {me.nickname.slice(0, 1)}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10">
        <AnimatePresence mode="wait">
          {/* ---------- WAITING ---------- */}
          {session.state === "waiting" && (
            <motion.section
              key="waiting"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-7 text-center"
            >
              <div className="relative h-24 w-24">
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg,var(--teal),var(--navy))",
                    opacity: 0.3,
                  }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
                <span
                  className="absolute inset-3 rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg,var(--teal),var(--navy))",
                  }}
                />
              </div>
              <div>
                <h2
                  className="section-title text-3xl sm:text-4xl"
                  style={{ fontFamily: "var(--font-heebo)" }}
                >
                  כל הכבוד, <span className="accent">הצטרפת!</span>
                </h2>
                <p
                  className="mt-3 text-base"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  ממתינים שהמנחה יתחיל את החידון…
                </p>
              </div>
            </motion.section>
          )}

          {/* ---------- QUESTION ACTIVE ---------- */}
          {session.state === "question_active" && currentQuestion && (
            <motion.section
              key={`q-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45 }}
              className="flex w-full max-w-md flex-col items-center gap-6"
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className="text-xs font-bold uppercase"
                  style={{
                    color: "var(--foreground-muted)",
                    letterSpacing: "0.25em",
                    fontFamily: "var(--font-heebo)",
                  }}
                >
                  שאלה {currentIndex + 1} / {questions.length}
                </span>
                <motion.span
                  key={`t-${remaining}`}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.18 }}
                  className="font-mono text-3xl font-extrabold tabular-nums"
                  style={{
                    color: remaining <= 5 ? "var(--red)" : "var(--teal-deep)",
                  }}
                >
                  {remaining}
                </motion.span>
              </div>

              <h2
                className="text-center text-2xl font-bold leading-tight sm:text-3xl"
                style={{
                  color: "var(--navy)",
                  fontFamily: "var(--font-heebo)",
                }}
              >
                {currentQuestion.question_text}
              </h2>

              {myAnswer ? (
                <SubmittedConfirm />
              ) : (
                <div className="grid w-full grid-cols-2 gap-3">
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const palette = optionPalette(idx);
                    return (
                      <motion.button
                        key={opt.id}
                        onClick={() => submitAnswer(opt.id)}
                        disabled={submitting}
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ y: -2 }}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06, duration: 0.35 }}
                        className="relative flex aspect-square flex-col items-center justify-between rounded-3xl p-4 text-white shadow-xl active:shadow-md disabled:opacity-60"
                        style={{
                          background: `linear-gradient(140deg, ${palette.hex} 0%, ${palette.deep} 100%)`,
                          boxShadow: `0 18px 40px -12px ${palette.hex}88`,
                        }}
                      >
                        <div className="h-9 w-9 self-start opacity-80">
                          <OptionShape
                            kind={palette.shape}
                            className="h-full w-full"
                          />
                        </div>
                        <div
                          className="text-center text-base font-bold leading-tight sm:text-lg"
                          style={{ fontFamily: "var(--font-heebo)" }}
                        >
                          {opt.text}
                        </div>
                        <div
                          className="self-end text-xs font-bold uppercase opacity-70"
                          style={{ letterSpacing: "0.18em" }}
                        >
                          {idx + 1}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {/* ---------- SHOWING RESULTS ---------- */}
          {session.state === "showing_results" && currentQuestion && (
            <motion.section
              key={`r-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45 }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <AnswerOutcome
                myAnswer={myAnswer}
                options={currentQuestion.answer_options}
              />
              <p
                className="max-w-sm text-base"
                style={{ color: "var(--foreground-muted)" }}
              >
                הסתכלו על המסך הגדול לתוצאות ולשיחה ↑
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
              className="flex flex-col items-center gap-6 text-center"
            >
              <div className="text-7xl">🏁</div>
              <h2
                className="section-title text-3xl"
                style={{ fontFamily: "var(--font-heebo)" }}
              >
                סיימנו · <span className="accent">תודה!</span>
              </h2>
              <div className="glass-strong rounded-3xl px-10 py-7">
                <div
                  className="text-xs font-bold uppercase"
                  style={{
                    color: "var(--foreground-muted)",
                    letterSpacing: "0.25em",
                    fontFamily: "var(--font-heebo)",
                  }}
                >
                  הניקוד שלך
                </div>
                <div className="gradient-text mt-2 text-6xl font-extrabold tabular-nums">
                  {me.score ?? 0}
                </div>
              </div>
              <p
                className="max-w-sm text-base"
                style={{ color: "var(--foreground-muted)" }}
              >
                הדירוג המלא מוצג על המסך הגדול.
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function SubmittedConfirm() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="flex w-full flex-col items-center gap-5 py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex h-28 w-28 items-center justify-center rounded-full text-white"
        style={{
          background: "linear-gradient(135deg,var(--teal),var(--teal-deep))",
          boxShadow: "0 24px 50px -16px rgba(4,180,157,0.55)",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-14 w-14"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </motion.div>
      <div>
        <p
          className="text-2xl font-extrabold"
          style={{ color: "var(--navy)", fontFamily: "var(--font-heebo)" }}
        >
          התשובה התקבלה!
        </p>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--foreground-muted)" }}
        >
          ממתינים לסיום הזמן…
        </p>
      </div>
    </motion.div>
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
        className="flex h-32 w-32 items-center justify-center rounded-full text-white text-6xl"
        style={{
          background: didNotAnswer
            ? "linear-gradient(135deg,#94a3b8,#475569)"
            : isRight
              ? "linear-gradient(135deg,var(--teal),var(--teal-deep))"
              : "linear-gradient(135deg,var(--red),#c81419)",
          boxShadow: isRight
            ? "0 30px 60px -16px rgba(4,180,157,0.6)"
            : didNotAnswer
              ? "0 30px 60px -16px rgba(100,116,139,0.45)"
              : "0 30px 60px -16px rgba(238,35,41,0.5)",
        }}
      >
        {didNotAnswer ? "⏱" : isRight ? "✓" : "✗"}
      </div>
      <div>
        <p
          className="text-3xl font-extrabold"
          style={{ color: "var(--navy)", fontFamily: "var(--font-heebo)" }}
        >
          {didNotAnswer
            ? "לא הספקת לענות"
            : isRight
              ? "צדקת!"
              : "טעית הפעם"}
        </p>
        {correct && (
          <p
            className="mt-2 text-base"
            style={{ color: "var(--foreground-muted)" }}
          >
            התשובה הנכונה: <span style={{ color: "var(--teal-deep)", fontWeight: 700 }}>{correct.text}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
