import type { CSSProperties } from "react";
import type { DesignSettings } from "./types";

/** Andembry teal — primary accent across the Beyond-the-Attack brand. */
export const DEFAULT_PRIMARY = "#04b49d";
/** Andembry navy — secondary accent that pairs with teal for gradients. */
export const DEFAULT_SECONDARY = "#173d6e";

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
