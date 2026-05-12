"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadQuizImage, deleteQuizImage } from "@/lib/uploadImage";

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Label for the "add" button when there's no image yet. */
  label?: string;
  /** Tailwind class for the preview height (e.g. "h-24" or "h-32"). */
  previewClass?: string;
};

export function ImageUpload({
  value,
  onChange,
  label = "+ הוספת תמונה",
  previewClass = "max-h-28",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadQuizImage(file, supabase);
      onChange(url);
    } catch (err) {
      setError((err as Error).message || "העלאה נכשלה");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemove() {
    if (!value) return;
    const previous = value;
    onChange(null);
    // Best-effort cleanup so we don't accumulate orphan files
    deleteQuizImage(previous, supabase).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-1">
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={`rounded-xl border border-white/10 object-cover ${previewClass}`}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 left-1 h-6 w-6 rounded-full bg-rose-600/95 text-white text-base leading-none flex items-center justify-center shadow"
            aria-label="הסרת תמונה"
            title="הסרה"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="self-start text-sm text-white/60 hover:text-white disabled:opacity-50"
        >
          {uploading ? "מעלה…" : label}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && <p className="text-rose-400 text-xs">{error}</p>}
    </div>
  );
}
