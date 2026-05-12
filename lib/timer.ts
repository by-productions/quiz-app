"use client";

import { useEffect, useState } from "react";

/** Re-renders every 200ms while `active` so a countdown stays smooth. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function formatSeconds(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function remainingSeconds(
  startedAtIso: string | null | undefined,
  timeLimitSec: number | null | undefined,
  now: number,
): number {
  if (!startedAtIso || !timeLimitSec) return 0;
  const startedAt = new Date(startedAtIso).getTime();
  if (Number.isNaN(startedAt)) return 0;
  return Math.max(
    0,
    Math.ceil((startedAt + timeLimitSec * 1000 - now) / 1000),
  );
}
