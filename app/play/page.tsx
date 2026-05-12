"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PlayJoinPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState("");
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
      setError("בחרי כינוי");
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

    router.push(
      `/play/${(session as { id: string }).id}/${(participant as { id: string }).id}`,
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text">
          הצטרפות למשחק
        </h1>
      </header>

      <form
        onSubmit={join}
        className="glass-strong rounded-3xl p-6 sm:p-8 flex flex-col gap-5 w-full max-w-sm"
      >
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-white/50">
            קוד משחק
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            maxLength={6}
            className="input-surface rounded-2xl px-5 py-4 text-4xl font-mono tracking-[0.3em] text-center"
            placeholder="000000"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider text-white/50">
            כינוי
          </span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="input-surface rounded-2xl px-5 py-3 text-lg"
            placeholder="השם שלך"
          />
        </label>
        {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={joining}
          className="gradient-bg brand-glow rounded-full px-6 py-4 font-bold text-white text-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
        >
          {joining ? "מצטרפת…" : "הצטרפי →"}
        </button>
      </form>

      <Link href="/" className="text-sm text-white/50 hover:text-white">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
