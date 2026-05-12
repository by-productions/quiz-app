"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ok" | "error";

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [info, setInfo] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .then(({ count, error }) => {
        if (error) {
          setStatus("error");
          setInfo(error.message);
        } else {
          setStatus("ok");
          setInfo(`${count ?? 0} חידונים בדאטהבייס`);
        }
      });
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        ממשק יצירה
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        כאן תבני ותעצבי חידונים. (ייבנה בשלב 6)
      </p>

      <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm">
        Supabase:{" "}
        {status === "checking" && <span className="text-zinc-500">בודק חיבור…</span>}
        {status === "ok" && (
          <span className="text-emerald-600">✓ מחובר — {info}</span>
        )}
        {status === "error" && (
          <span className="text-rose-600">✗ שגיאה: {info}</span>
        )}
      </div>

      <Link href="/" className="mt-4 text-indigo-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
