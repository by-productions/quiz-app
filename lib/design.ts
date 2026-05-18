import type { CSSProperties } from "react";
import type { DesignSettings } from "./types";

export const DEFAULT_PRIMARY = "#8b5cf6";
export const DEFAULT_SECONDARY = "#ec4899";

/**
 * Returns an inline style with the brand CSS variables set, so any
 * `gradient-text`, `gradient-bg`, `brand-glow` etc. inside this element
 * uses the quiz's chosen colors instead of the global defaults.
 */
export function designStyle(
  design: DesignSettings | null | undefined,
): CSSProperties {
  const primary = design?.primary ?? DEFAULT_PRIMARY;
  const secondary = design?.secondary ?? DEFAULT_SECONDARY;
  return {
    ["--accent-from" as string]: primary,
    ["--accent-to" as string]: secondary,
  } as CSSProperties;
}

