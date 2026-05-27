"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex flex-1 items-center justify-center p-8"
          style={{ color: "var(--foreground-faint)" }}
        >
          טוען…
        </main>
      }
    >
      <JoinForm />
    </Suspense>
  );
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const initialCode = (params?.get("code") ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = code.trim();
    const trimmedNick = nickname.trim();

    if (trimmedCode.length !== 6 || !/^\d+$/.test(trimmedCode)) {
      setError("הקוד חייב להיות 6 ספרות");
      return;
    }
    if (trimmedNick.length === 0) {
      setError("צריך/ה להזין שם");
      return;
    }

    setJoining(true);

    const { data: session, error: sessionErr } = await supabase
      .from("game_sessions")
      .select("id, state")
      .eq("join_code", trimmedCode)
      .maybeSingle();

    if (sessionErr || !session) {
      setError("לא נמצא משחק עם הקוד הזה");
      setJoining(false);
      return;
    }
    if ((session as { state: string }).state === "ended") {
      setError("המשחק כבר הסתיים");
      setJoining(false);
      return;
    }

    const { data: participant, error: partErr } = await supabase
      .from("participants")
      .insert({
        session_id: (session as { id: string }).id,
        nickname: trimmedNick,
      })
      .select()
      .single();

    if (partErr || !participant) {
      setError("שגיאה בהצטרפות: " + (partErr?.message ?? "לא ידוע"));
      setJoining(false);
      return;
    }

    router.push(`/play/${(participant as { id: string }).id}`);
  }

  const hasPrefilledCode = initialCode.length === 6;

  return (
    <main className="relative flex min-h-screen flex-1 flex-col">
      {/* Logo nav */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/csl-logo.png"
            alt="CSL"
            width={120}
            height={30}
            priority
            className="h-7 w-auto sm:h-8"
          />
          <span className="hidden h-6 w-px bg-gradient-to-b from-[var(--grey)] to-transparent sm:inline-block" />
          <Image
            src="/andembry-logo.png"
            alt="Andembry"
            width={120}
            height={24}
            priority
            className="hidden h-5 w-auto opacity-95 sm:block"
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 px-5 pb-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="eyebrow">הצטרפות לחידון</span>
          <h1
            className="hero-title mt-4"
            dir="ltr"
            style={{ fontSize: "clamp(2.2rem, 8vw, 3.6rem)" }}
          >
            Beyond <span className="amp">the</span> Attack
          </h1>
          {hasPrefilledCode && (
            <p
              className="mt-3 text-sm font-bold"
              style={{ color: "var(--teal-deep)" }}
            >
              ✓ קוד נטען מהקישור — רק תני שם
            </p>
          )}
        </motion.header>

        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={join}
          className="glass-strong flex w-full max-w-sm flex-col gap-5 rounded-3xl p-6 sm:p-8"
        >
          <label className="flex flex-col gap-2">
            <span
              className="text-xs font-bold uppercase"
              style={{
                color: "var(--foreground-muted)",
                letterSpacing: "0.22em",
              }}
            >
              קוד משחק
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              className="input-surface rounded-2xl px-5 py-4 text-center font-mono text-4xl font-extrabold"
              style={{ letterSpacing: "0.32em" }}
              placeholder="000000"
              autoFocus={!hasPrefilledCode}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span
              className="text-xs font-bold uppercase"
              style={{
                color: "var(--foreground-muted)",
                letterSpacing: "0.22em",
              }}
            >
              השם שלך
            </span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              className="input-surface rounded-2xl px-5 py-3 text-lg"
              placeholder="לדוגמה: ד״ר רותי"
              autoFocus={hasPrefilledCode}
            />
          </label>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-bold"
              style={{ color: "var(--red)" }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={joining}
            className="cta-red rounded-full px-6 py-4 text-lg font-extrabold disabled:opacity-50"
            style={{ fontFamily: "var(--font-heebo)" }}
          >
            {joining ? "מצטרפת…" : "הצטרפות ←"}
          </button>
        </motion.form>

        <Link
          href="/"
          className="text-sm transition-colors hover:opacity-70"
          style={{ color: "var(--foreground-muted)" }}
        >
          חזרה למסך המארח
        </Link>
      </div>
    </main>
  );
}
