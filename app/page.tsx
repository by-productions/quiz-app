"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import EventBackground from "@/lib/EventBackground";
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
  if (index === 3)
    return (
      <svg viewBox="0 0 32 32">
        <rect x="3" y="3" width="26" height="26" rx="3" />
      </svg>
    );
  if (index === 4)
    return (
      <svg viewBox="0 0 32 32">
        <path d="M16 3l13 9.4-5 15.6H8l-5-15.6z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 32 32">
      <path d="M16 3 L28 9.5 L28 22.5 L16 29 L4 22.5 L4 9.5 Z" />
    </svg>
  );
}

const ANS_CLASS = ["a0", "a1", "a2", "a3", "a4", "a5"] as const;
const BAR_CLASS = ["b0", "b1", "b2", "b3", "b4", "b5"] as const;

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
  // Host can pop the join QR over any screen so latecomers can still scan in.
  const [showJoin, setShowJoin] = useState(false);

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
    // Re-pull on state change too, so the results bars (and the scores derived
    // from them) reflect the authoritative DB count when results are shown,
    // not just whatever realtime INSERT events happened to arrive.
  }, [session?.current_question_id, session?.state, session?.id, supabase]);

  // Safety net: if the host tab is backgrounded/loses its socket, re-pull the
  // participant list when it regains focus so the live count can't drift.
  useEffect(() => {
    if (!session) return;
    const sid = session.id;
    const onWake = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sid)
        .order("joined_at");
      if (data) setParticipants(data as Participant[]);
    };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [session?.id, supabase]);

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

  // Two-step question flow: "preview" shows the question (host + phones) with no
  // timer/voting; "votingOpen" (set by the host) starts the timer and lets
  // phones answer.
  const votingOpen =
    session?.state === "question_active" && !!session.question_started_at;

  const autoAdvancing = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (session.state !== "question_active") {
      autoAdvancing.current = false;
      return;
    }
    // Preview phase (question shown, voting not opened yet) — never auto-advance.
    if (!session.question_started_at) return;
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

  // Synchronous re-entrancy lock for every host state transition. `advancing`
  // is React state and updates asynchronously, so two presentation-clicker
  // events firing in the same render frame could both pass an `if (advancing)`
  // check and double-advance (skipping a question + double-scoring). A ref
  // flips synchronously, so the second call bails immediately. try/finally
  // guarantees the lock is always released — a stuck lock would freeze the host.
  const transitionLock = useRef(false);
  const runExclusive = useCallback(async (fn: () => Promise<void>) => {
    if (transitionLock.current) return;
    transitionLock.current = true;
    setAdvancing(true);
    try {
      await fn();
    } finally {
      setAdvancing(false);
      transitionLock.current = false;
    }
  }, []);

  // Authoritative, idempotent scoring: each participant's score is recomputed
  // from scratch as (# of their correct answers) × 100, read straight from the
  // DB. Because it's absolute (not incremental) it's safe to run any number of
  // times — so the host can step backward and forward through questions without
  // ever double-counting. Run once when the quiz ends.
  const recomputeScores = useCallback(async () => {
    if (!session) return;
    const correctByQuestion = new Map<string, string>();
    for (const q of questions) {
      const c = q.answer_options.find((o) => o.is_correct);
      if (c) correctByQuestion.set(q.id, c.id);
    }
    const { data: rows } = await supabase
      .from("responses")
      .select("participant_id, question_id, answer_data")
      .eq("session_id", session.id);
    const scoreByParticipant = new Map<string, number>();
    for (const r of (rows ?? []) as Array<{
      participant_id: string;
      question_id: string;
      answer_data: { option_id?: string };
    }>) {
      const correctId = correctByQuestion.get(r.question_id);
      if (correctId && r.answer_data?.option_id === correctId) {
        scoreByParticipant.set(
          r.participant_id,
          (scoreByParticipant.get(r.participant_id) ?? 0) + 100,
        );
      }
    }
    // Write each scorer's absolute total straight from the responses, so even a
    // participant the host never saw join still gets the right score. Anyone
    // with no correct answers keeps the column default of 0.
    await Promise.all(
      Array.from(scoreByParticipant.entries()).map(([pid, score]) =>
        supabase.from("participants").update({ score }).eq("id", pid),
      ),
    );
  }, [session, questions, supabase]);

  const startFirst = useCallback(
    () =>
      runExclusive(async () => {
        if (!session) return;
        const first = questions[0];
        if (!first) return;
        await supabase
          .from("game_sessions")
          .update({
            state: "question_active" as SessionState,
            current_question_id: first.id,
            question_started_at: new Date().toISOString(),
          })
          .eq("id", session.id);
      }),
    [runExclusive, questions, session, supabase],
  );

  const endQuestionNow = useCallback(
    () =>
      runExclusive(async () => {
        if (!session) return;
        await supabase
          .from("game_sessions")
          .update({ state: "showing_results" as SessionState })
          .eq("id", session.id);
      }),
    [runExclusive, session, supabase],
  );

  const goNext = useCallback(
    () =>
      runExclusive(async () => {
        if (!session || !currentQuestion) return;
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
          // Last question — compute final scores from the DB, then end.
          await recomputeScores();
          await supabase
            .from("game_sessions")
            .update({ state: "ended" as SessionState })
            .eq("id", session.id);
        }
      }),
    [runExclusive, currentQuestion, questions, session, supabase, recomputeScores],
  );

  // Step one transition backward — the mirror image of the forward flow, so a
  // host who advanced too fast (or wants to revisit a question) can recover from
  // any screen. Scoring is recomputed from the DB only at the end, so moving
  // back and forth never corrupts the leaderboard.
  const goBack = useCallback(
    () =>
      runExclusive(async () => {
        if (!session) return;
        if (session.state === "question_active") {
          // Back to the previous question's results, or the lobby.
          const idx = questions.findIndex(
            (q) => q.id === session.current_question_id,
          );
          const prev = idx > 0 ? questions[idx - 1] : null;
          if (prev) {
            await supabase
              .from("game_sessions")
              .update({
                state: "showing_results" as SessionState,
                current_question_id: prev.id,
                question_started_at: null,
              })
              .eq("id", session.id);
          } else {
            await supabase
              .from("game_sessions")
              .update({
                state: "waiting" as SessionState,
                current_question_id: null,
                question_started_at: null,
              })
              .eq("id", session.id);
          }
        } else if (session.state === "showing_results") {
          // Results → re-open this question's voting.
          await supabase
            .from("game_sessions")
            .update({
              state: "question_active" as SessionState,
              question_started_at: new Date().toISOString(),
            })
            .eq("id", session.id);
        } else if (session.state === "ended") {
          // Ended → back to the last question's results.
          const last = questions[questions.length - 1];
          if (last) {
            await supabase
              .from("game_sessions")
              .update({
                state: "showing_results" as SessionState,
                current_question_id: last.id,
                question_started_at: null,
              })
              .eq("id", session.id);
          }
        }
      }),
    [runExclusive, session, questions, supabase],
  );

  // End the whole quiz immediately — compute final scores and jump to the
  // leaderboard. Recoverable: "back" from the ended screen returns to the last
  // question's results.
  const endQuiz = useCallback(
    () =>
      runExclusive(async () => {
        if (!session) return;
        await recomputeScores();
        await supabase
          .from("game_sessions")
          .update({ state: "ended" as SessionState })
          .eq("id", session.id);
      }),
    [runExclusive, session, supabase, recomputeScores],
  );

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
      // Clicker "previous" / left arrow steps the event backward.
      const backKeys = new Set(["ArrowLeft", "PageUp"]);
      if (e.repeat) return;
      // While the join-QR overlay is up, any nav/Escape key just closes it —
      // never advances the quiz behind it.
      if (showJoin) {
        if (
          e.key === "Escape" ||
          advanceKeys.has(e.key) ||
          backKeys.has(e.key)
        ) {
          e.preventDefault();
          setShowJoin(false);
        }
        return;
      }
      if (backKeys.has(e.key)) {
        e.preventDefault();
        goBack();
        return;
      }
      if (!advanceKeys.has(e.key)) return;
      e.preventDefault();

      if (session.state === "waiting") {
        if (participants.length > 0) startFirst();
      } else if (session.state === "question_active") {
        endQuestionNow();
      } else if (session.state === "showing_results") {
        goNext();
      } else if (session.state === "ended") {
        startFresh();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    session,
    participants.length,
    showJoin,
    startFirst,
    endQuestionNow,
    goNext,
    goBack,
    startFresh,
  ]);

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
      <main className="host-stage relative z-10 flex h-screen flex-col overflow-hidden">
        {/* TOPBAR — forum wordmark */}
        <header className="flex items-center justify-between px-8 py-4 sm:px-14">
          <div
            className="eyebrow-mini"
            style={{
              fontSize: "clamp(0.85rem, 1.3vw, 1.15rem)",
              letterSpacing: "0.16em",
            }}
          >
            פורום דרום גינקואונקולוגי
          </div>
        </header>

        {/* STAGE */}
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4 sm:px-8 sm:pb-6">
          <AnimatePresence mode="wait">
            {/* ---------- WAITING ---------- */}
            {session.state === "waiting" && (
              <motion.section
                key="waiting"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.45 }}
                className="w-full max-w-[1500px]"
              >
                <div className="grid items-center gap-6 md:grid-cols-[1.1fr_.9fr] md:gap-8">
                  {/* LEFT — title + steps + pin */}
                  <div className="text-right">
                    <div
                      className="eyebrow-mini"
                      style={{
                        fontSize: "clamp(1.05rem, 1.9vw, 1.5rem)",
                        letterSpacing: "0.2em",
                      }}
                    >
                      סקר אינטראקטיבי
                    </div>
                    <h1
                      className="hero-title mt-2"
                      style={{
                        textAlign: "right",
                        fontSize: "clamp(2rem, 4.4vw, 3.9rem)",
                      }}
                    >
                      פורום דרום <span className="g">גינקואונקולוגי</span>
                    </h1>
                    <div
                      className="host-credit mt-2"
                      style={{ fontSize: "clamp(1.05rem, 1.7vw, 1.5rem)" }}
                    >
                      יום ב&apos; 20/7/26{" "}
                      <span className="role">· 18:30–21:30 · נס ציונה</span>
                    </div>
                    <p
                      className="mt-2 max-w-xl"
                      style={{
                        color: "rgba(255,255,255,0.85)",
                        fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)",
                        lineHeight: 1.45,
                      }}
                    >
                      סרקו את הקוד עם הנייד והצטרפו — לפני כל הרצאה תעלה שאלה
                      ונראה יחד את התפלגות התשובות.
                    </p>

                    <div className="mt-4 flex flex-col gap-2">
                      <div
                        className="flex items-center gap-3 font-semibold text-white/90"
                        style={{ fontSize: "clamp(1rem, 1.5vw, 1.45rem)" }}
                      >
                        <span className="step-num">1</span>
                        פותחים את מצלמת הנייד
                      </div>
                      <div
                        className="flex items-center gap-3 font-semibold text-white/90"
                        style={{ fontSize: "clamp(1rem, 1.5vw, 1.45rem)" }}
                      >
                        <span className="step-num s2">2</span>
                        סורקים את קוד ה-QR
                      </div>
                      <div
                        className="flex items-center gap-3 font-semibold text-white/90"
                        style={{ fontSize: "clamp(1rem, 1.5vw, 1.45rem)" }}
                      >
                        <span className="step-num s3">3</span>
                        מזינים שם ומצטרפים
                      </div>
                    </div>

                    <div className="pin-box mt-3" style={{ padding: "14px 22px" }}>
                      <span className="lbl">או הצטרפות עם קוד</span>
                      <span
                        className="pin"
                        style={{ fontSize: "clamp(2.4rem, 5.4vw, 4rem)" }}
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
                    <div className="qr-card" style={{ padding: 24 }}>
                      <div
                        className="qtitle"
                        style={{ fontSize: "1.2rem", marginBottom: 4 }}
                      >
                        סרקו להצטרפות
                      </div>
                      <div
                        className="qsub"
                        dir="ltr"
                        style={{ fontSize: "0.92rem", marginBottom: 14 }}
                      >
                        {origin && origin.replace(/^https?:\/\//, "")}/join
                      </div>
                      <div
                        className="qr-wrap"
                        style={{ width: "min(340px, 62vw)", padding: 12 }}
                      >
                        {joinUrl ? (
                          <QRCodeSVG
                            value={joinUrl}
                            size={320}
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

                {/* PARTICIPANTS + START — compact */}
                <div className="mt-3 flex flex-col items-center gap-2 text-center">
                  <p
                    className="font-extrabold"
                    style={{
                      color: "var(--gold)",
                      fontSize: "clamp(1.1rem, 1.7vw, 1.6rem)",
                    }}
                  >
                    <span style={{ fontSize: "1.5em" }}>
                      {participants.length}
                    </span>{" "}
                    משתתפים מחוברים
                  </p>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={startFirst}
                      disabled={
                        advancing ||
                        questions.length === 0 ||
                        participants.length === 0
                      }
                      className="next-btn disabled:opacity-40"
                      style={{
                        padding: "clamp(12px,1.3vw,18px) clamp(30px,3vw,46px)",
                        fontSize: "clamp(1.05rem,1.6vw,1.5rem)",
                      }}
                    >
                      להתחלת הסקר
                      <svg viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </button>
                  </div>
                  {participants.length === 0 && (
                    <p className="text-xs text-white/45">
                      הכפתור יופעל אחרי שמשתתף ראשון מצטרף
                    </p>
                  )}
                </div>

                <SponsorBand className="mx-auto mt-4 max-w-4xl" />
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
                className="w-full max-w-[1500px]"
              >
                <div className="mb-4 flex items-center justify-between text-white">
                  <span
                    className="font-bold opacity-85"
                    style={{
                      fontFamily: "var(--font-heebo)",
                      fontSize: "clamp(1.1rem, 2vw, 1.7rem)",
                    }}
                  >
                    שאלה {currentIndex + 1} מתוך {questions.length}
                  </span>
                  <CountdownRing
                    remaining={remainingSec}
                    total={QUESTION_SECONDS}
                  />
                </div>

                <div className="q-text">{currentQuestion.question_text}</div>

                {/* Live vote bars — grow in real time while voting is open */}
                <div
                  className="mt-5 grid items-end gap-3 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                    height: "min(40vh, 320px)",
                  }}
                >
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const count = voteCounts[opt.id] ?? 0;
                    const pct = (count / maxVote) * 100;
                    return (
                      <div key={opt.id} className={`barcol ${BAR_CLASS[idx]}`}>
                        <motion.div
                          className="bar"
                          animate={{
                            height: votingOpen ? `${Math.max(pct, 6)}%` : "6%",
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 90,
                            damping: 16,
                          }}
                        >
                          {votingOpen ? count : ""}
                        </motion.div>
                        <div className="sh-box">
                          <OptionShape index={idx} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="mt-4 grid gap-3 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                  }}
                >
                  {currentQuestion.answer_options.map((opt) => (
                    <div
                      key={opt.id}
                      className="text-center font-bold leading-tight"
                      style={{
                        color: "rgba(255,255,255,0.82)",
                        fontFamily: "var(--font-heebo)",
                        fontSize: "clamp(1rem, 1.5vw, 1.5rem)",
                      }}
                    >
                      {opt.text}
                    </div>
                  ))}
                </div>

                {votingOpen && !isRevealPhase && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="mt-4 flex items-center justify-between text-white/75"
                    style={{ fontFamily: "var(--font-heebo)" }}
                  >
                    <span
                      className="font-bold"
                      style={{ fontSize: "clamp(1.05rem, 1.7vw, 1.5rem)" }}
                    >
                      ענו עד כה:{" "}
                      <span className="text-white">{totalVotes}</span> /{" "}
                      {participants.length}
                    </span>
                    <button
                      onClick={endQuestionNow}
                      disabled={advancing}
                      className="rounded-full border px-6 py-2.5 font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{
                        borderColor: "rgba(255,255,255,0.25)",
                        color: "#fff",
                        fontSize: "clamp(0.95rem, 1.4vw, 1.3rem)",
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
                className="w-full max-w-[1500px]"
              >
                <div className="mb-4 flex items-center justify-between text-white">
                  <span
                    className="font-bold opacity-85"
                    style={{
                      fontFamily: "var(--font-heebo)",
                      fontSize: "clamp(1.1rem, 2vw, 1.7rem)",
                    }}
                  >
                    תוצאות שאלה {currentIndex + 1}
                  </span>
                </div>

                <div
                  className="q-text"
                  style={{ fontSize: "clamp(1.5rem, 2.9vw, 2.5rem)" }}
                >
                  {currentQuestion.question_text}
                </div>

                <div
                  className="mt-5 grid items-end gap-3 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                    height: "min(44vh, 360px)",
                  }}
                >
                  {currentQuestion.answer_options.map((opt, idx) => {
                    const count = voteCounts[opt.id] ?? 0;
                    const pct =
                      totalVotes > 0
                        ? Math.round((count / totalVotes) * 100)
                        : 0;
                    const barH = maxVote > 0 ? (count / maxVote) * 100 : 0;
                    return (
                      <div key={opt.id} className={`barcol ${BAR_CLASS[idx]}`}>
                        <motion.div
                          className="bar"
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(barH, 8)}%` }}
                          transition={{
                            duration: 0.8,
                            type: "spring",
                            stiffness: 80,
                            damping: 16,
                          }}
                        >
                          {pct}%
                        </motion.div>
                        <div className="sh-box">
                          <OptionShape index={idx} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  className="mt-4 grid gap-3 sm:gap-5"
                  style={{
                    gridTemplateColumns: `repeat(${currentQuestion.answer_options.length}, 1fr)`,
                  }}
                >
                  {currentQuestion.answer_options.map((opt) => (
                    <div
                      key={opt.id}
                      className="text-center font-bold leading-tight"
                      style={{
                        color: "rgba(255,255,255,0.82)",
                        fontFamily: "var(--font-heebo)",
                        fontSize: "clamp(1rem, 1.6vw, 1.6rem)",
                      }}
                    >
                      {opt.text}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col items-center gap-2 text-center">
                  <button
                    onClick={goNext}
                    disabled={advancing}
                    className="next-btn"
                    style={{ padding: "12px 30px", fontSize: "1.05rem" }}
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
                className="w-full max-w-5xl text-center"
              >
                <div
                  className="mb-4 text-6xl"
                  style={{ animation: "beat 1.6s ease-in-out infinite" }}
                >
                  ✨
                </div>
                <h1
                  className="hero-title"
                  style={{ fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)" }}
                >
                  תודה <span className="g">שהשתתפתם!</span>
                </h1>
                <p
                  className="mt-3 font-bold text-white/85"
                  style={{ fontSize: "clamp(1.2rem, 2.4vw, 1.9rem)" }}
                >
                  פורום דרום גינקואונקולוגי
                </p>

                <SponsorBand className="mx-auto mt-10 max-w-4xl" />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Host controls — tucked into the bottom-right corner, revealed on hover */}
        <div className="host-dock" aria-label="פקדי מנחה">
          <div className="flex items-center gap-2">
            {session.state !== "waiting" && (
              <button
                onClick={goBack}
                disabled={advancing}
                className="host-mini-btn disabled:opacity-40"
                title="חזרה אחורה (גם עם ← בקליקר)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                אחורה
              </button>
            )}
            <button
              onClick={() => setShowJoin(true)}
              className="host-mini-btn"
              title="הצגת קוד QR להצטרפות"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm0 4h3v4h-2v-2h-1v-2zm-5-4h2v3h-2v-3zm0 5h2v3h-2v-3z" />
              </svg>
              קוד הצטרפות
            </button>
            {session.state !== "waiting" && session.state !== "ended" && (
              <button
                onClick={endQuiz}
                disabled={advancing}
                className="host-mini-btn danger disabled:opacity-40"
                title="סיום הסקר"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                סיים סקר
              </button>
            )}
            {session.state === "ended" && (
              <button
                onClick={startFresh}
                className="next-btn"
                style={{ fontSize: "1rem", padding: "10px 22px" }}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M12 5V1L7 6l5 5V7a6 6 0 11-6 6H4a8 8 0 108-8z" />
                </svg>
                אתגר חדש
              </button>
            )}
          </div>
          <KbdHint />
        </div>

        {/* Join-QR overlay — poppable from any screen for latecomers */}
        <AnimatePresence>
          {showJoin && (
            <motion.div
              key="join-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setShowJoin(false)}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6"
              style={{ background: "rgba(7,20,40,0.82)", backdropFilter: "blur(6px)" }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 16 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="qr-card"
                style={{ padding: 28 }}
              >
                <div className="qtitle" style={{ fontSize: "1.5rem", marginBottom: 4 }}>
                  סרקו להצטרפות
                </div>
                <div
                  className="qsub"
                  dir="ltr"
                  style={{ fontSize: "1rem", marginBottom: 16 }}
                >
                  {origin && origin.replace(/^https?:\/\//, "")}/join
                </div>
                <div className="qr-wrap" style={{ width: "min(420px, 70vw)", padding: 14 }}>
                  {joinUrl ? (
                    <QRCodeSVG
                      value={joinUrl}
                      size={400}
                      level="M"
                      marginSize={0}
                      bgColor="#ffffff"
                      fgColor="#173d6e"
                    />
                  ) : (
                    <div style={{ height: 260 }} />
                  )}
                </div>
                <div className="join-pin mt-4">
                  <span className="lbl">או הצטרפות עם קוד</span>
                  <span
                    className="pin"
                    style={{ fontSize: "clamp(2.4rem, 6vw, 3.4rem)" }}
                  >
                    {formattedCode}
                  </span>
                </div>
              </motion.div>
              <button
                onClick={() => setShowJoin(false)}
                className="next-btn"
                style={{ fontSize: "1.1rem", padding: "12px 32px" }}
              >
                סגירה
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}

const SPONSORS = [
  { src: "/sponsors/gsk.png", alt: "GSK", w: 1280, h: 720 },
  { src: "/sponsors/msd.png", alt: "MSD", w: 1280, h: 508 },
  { src: "/sponsors/eisai.png", alt: "Eisai", w: 1200, h: 720 },
  { src: "/sponsors/medison.jpg", alt: "Medison", w: 1280, h: 447 },
  { src: "/sponsors/astrazeneca.jpg", alt: "AstraZeneca", w: 750, h: 511 },
];

function SponsorBand({ className = "" }: { className?: string }) {
  return (
    <div className={`sponsor-band ${className}`}>
      {SPONSORS.map((s) => (
        <Image key={s.alt} src={s.src} alt={s.alt} width={s.w} height={s.h} />
      ))}
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
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const urgent = remaining <= 5;
  return (
    <div className={`timer-ring ${urgent ? "urgent" : ""}`}>
      <svg
        viewBox="0 0 88 88"
        className="absolute inset-0 h-full w-full"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="rgba(23,61,110,0.12)"
          strokeWidth="6"
        />
        <motion.circle
          cx="44"
          cy="44"
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
