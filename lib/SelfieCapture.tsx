"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatarBlob } from "@/lib/uploadImage";

type Mode = "idle" | "streaming" | "captured";

type Props = {
  currentAvatarUrl: string | null;
  onSaved: (url: string) => void;
};

export function SelfieCapture({ currentAvatarUrl, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(s);
      // Wait a tick for the video element to mount
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      });
      setMode("streaming");
    } catch (e) {
      const err = e as Error;
      if (err.name === "NotAllowedError") {
        setError("הגישה למצלמה נדחתה. אפשרי בהגדרות הדפדפן.");
      } else if (err.name === "NotFoundError") {
        setError("לא נמצאה מצלמה.");
      } else if (err.name === "NotSupportedError") {
        setError("המצלמה דורשת חיבור מאובטח (HTTPS).");
      } else {
        setError("שגיאת מצלמה: " + err.message);
      }
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  function cancelStream() {
    stopCamera();
    setMode("idle");
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    if (size === 0) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror horizontally for natural selfie effect
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, -sx, -sy);
    ctx.restore();
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
        setMode("captured");
      },
      "image/jpeg",
      0.85,
    );
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  }

  async function save() {
    if (!capturedBlob) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadAvatarBlob(capturedBlob, supabase);
      onSaved(url);
      // Reset to idle so the parent's "current avatar" UI takes over
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCapturedBlob(null);
      setPreviewUrl(null);
      setMode("idle");
    } catch (e) {
      setError("העלאה נכשלה: " + (e as Error).message);
    }
    setBusy(false);
  }

  if (mode === "idle") {
    return (
      <div className="flex flex-col items-center gap-3">
        {currentAvatarUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={currentAvatarUrl}
            alt=""
            className="h-24 w-24 rounded-full object-cover border-2 border-white/20"
          />
        )}
        <button
          type="button"
          onClick={startCamera}
          className="glass glass-hover rounded-full px-5 py-2 text-sm text-white"
        >
          {currentAvatarUrl ? "📷 החליפי תמונה" : "📷 צלמי סלפי (אופציונלי)"}
        </button>
        {error && <p className="text-rose-400 text-xs text-center">{error}</p>}
      </div>
    );
  }

  if (mode === "streaming") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative rounded-3xl overflow-hidden border-2 border-white/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-64 h-64 object-cover -scale-x-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={capture}
            className="gradient-bg brand-glow rounded-full px-6 py-2.5 font-bold text-white"
          >
            📸 צלמי
          </button>
          <button
            type="button"
            onClick={cancelStream}
            className="glass glass-hover rounded-full px-5 py-2.5 text-sm text-white"
          >
            ביטול
          </button>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // mode === "captured"
  return (
    <div className="flex flex-col items-center gap-3">
      {previewUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={previewUrl}
          alt=""
          className="w-64 h-64 rounded-3xl object-cover border-2 border-white/20"
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="gradient-bg brand-glow rounded-full px-6 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {busy ? "שומרת…" : "✓ שמרי"}
        </button>
        <button
          type="button"
          onClick={retake}
          disabled={busy}
          className="glass glass-hover rounded-full px-5 py-2.5 text-sm text-white disabled:opacity-50"
        >
          ↻ צלמי שוב
        </button>
      </div>
      {error && <p className="text-rose-400 text-xs text-center">{error}</p>}
    </div>
  );
}
