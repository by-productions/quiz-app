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

    if (session.state === "ended") {
      setError("המשחק כבר הסתיים");
      setJoining(false);
      return;
    }

    const { data: participant, error: partErr } = await supabase
      .from("participants")
      .insert({ session_id: session.id, nickname: trimmedNick })
      .select()
      .single();

    if (partErr || !participant) {
      setError("שגיאה בהצטרפות: " + (partErr?.message ?? "לא ידוע"));
      setJoining(false);
      return;
    }

    router.push(`/play/${session.id}/${participant.id}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold">הצטרפות למשחק</h1>
      <form onSubmit={join} className="flex flex-col gap-4 w-full max-w-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">קוד משחק (6 ספרות)</span>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-2xl font-mono tracking-widest text-center"
            placeholder="000000"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-500">כינוי</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3"
            placeholder="השם שלך"
          />
        </label>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={joining}
          className="rounded-full bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
        >
          {joining ? "מצטרפת…" : "הצטרפי"}
        </button>
      </form>
      <Link href="/" className="mt-4 text-rose-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
