"use client";

import type { DesignSettings } from "@/lib/types";

/**
 * A fixed-position background layer that replaces the page gradient
 * with the quiz's custom background image (darkened for readability).
 * Renders nothing if no background image is set.
 */
export function Backdrop({
  design,
}: {
  design: DesignSettings | null | undefined;
}) {
  if (!design?.background_image_url) return null;
  return (
    <div
      className="fixed inset-0 -z-10"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.65)), url("${design.background_image_url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    />
  );
}

/**
 * Small logo chip placed in the top corner of host + player views.
 */
export function LogoChip({
  design,
}: {
  design: DesignSettings | null | undefined;
}) {
  if (!design?.logo_url) return null;
  return (
    <div className="fixed top-4 right-4 z-20 glass rounded-2xl p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={design.logo_url}
        alt=""
        className="h-10 w-auto max-w-[120px] object-contain"
      />
    </div>
  );
}
