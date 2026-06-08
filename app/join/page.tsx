"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";

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

export default function JoinPage() {
  return (
    <>
      <EventBackground />
      <Suspense
        fallback={
          <main className="relative z-10 flex min-h-screen items-center justify-center p-8 text-white/55">
            טוען…
          </main>
        }
      >
        <JoinForm />
      </Suspense>
    </>
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
      setError("צריך להזין שם");
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
    <main className="relative z-10 flex min-h-screen flex-col">
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
        {/* LEFT corner — CSL */}
        <Image
          src="/csl-logo.png"
          alt="CSL"
          width={130}
          height={30}
          priority
          className="h-8 w-auto rounded-xl bg-white px-2.5 py-1.5"
        />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-10">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div
            className="eyebrow-mini"
            style={{ fontSize: "clamp(1rem, 4.5vw, 1.3rem)", letterSpacing: "0.18em" }}
          >
            חידון HAE אינטראקטיבי
          </div>
          <h1
            className="hero-title mt-2"
            style={{ fontSize: "clamp(1.9rem, 8vw, 3rem)" }}
          >
            אירוע ההשקה של <span className="g">Andembry</span>
          </h1>
          <p className="mt-3 text-white/75">
            {hasPrefilledCode ? (
              <>
                ✓ קוד נטען אוטומטית — הוסף/י כינוי
              </>
            ) : (
              <>הזינו את קוד המשחק כדי להצטרף</>
            )}
          </p>
        </motion.header>

        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={join}
          className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white/5 p-6 backdrop-blur-md"
          style={{ border: "1px solid rgba(255,255,255,0.14)" }}
        >
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            maxLength={6}
            className="pinput font-mono"
            style={{ letterSpacing: "0.25em" }}
            placeholder="קוד משחק"
            autoFocus={!hasPrefilledCode}
          />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="pinput"
            placeholder="הכינוי שלך"
            autoFocus={hasPrefilledCode}
          />
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-sm font-bold"
              style={{ color: "var(--gold)" }}
            >
              {error}
            </motion.p>
          )}
          <button
            type="submit"
            disabled={joining}
            className="pbtn mt-2"
          >
            {joining ? "מצטרף/ת…" : "הצטרפות לחידון"}
          </button>
        </motion.form>

        <Link
          href="/"
          className="text-sm text-white/55 transition-colors hover:text-white/80"
        >
          חזרה למסך המארח
        </Link>
      </div>
    </main>
  );
}
