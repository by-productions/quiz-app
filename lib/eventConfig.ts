/**
 * Single-event constants for the "Beyond the Attack" launch quiz.
 * The quiz UUID matches the SQL seed in supabase/migrations/0007_seed_andembry_quiz.sql.
 */

export const ANDEMBRY_QUIZ_ID = "beac6589-bea0-4e0d-9000-000000000001";

/** Total time, in seconds, that players have to answer each question. */
export const QUESTION_SECONDS = 30;

/** Branded Andembry colors for each of the 4 answer slots. */
export const OPTION_PALETTE = [
  { name: "teal",  bg: "#04b49d", hex: "#04b49d", deep: "#00917f", shape: "circle"   as const },
  { name: "navy",  bg: "#173d6e", hex: "#173d6e", deep: "#0f2c52", shape: "square"   as const },
  { name: "gold",  bg: "#f0b020", hex: "#f0b020", deep: "#c98e0e", shape: "triangle" as const },
  { name: "red",   bg: "#ee2329", hex: "#ee2329", deep: "#c81419", shape: "diamond"  as const },
] as const;

export type OptionPaletteEntry = (typeof OPTION_PALETTE)[number];

export function optionPalette(index: number): OptionPaletteEntry {
  return OPTION_PALETTE[index % OPTION_PALETTE.length];
}
