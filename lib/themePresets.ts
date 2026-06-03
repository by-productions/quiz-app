import type { DesignSettings } from "./types";

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  /** Subset of DesignSettings to apply (does NOT touch logo / bg / timer). */
  settings: Pick<DesignSettings, "primary" | "secondary">;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "andembry",
    name: "Andembry",
    description: "טורקיז וכחול נייבי",
    settings: { primary: "#04b49d", secondary: "#173d6e" },
  },
  {
    id: "csl",
    name: "CSL",
    description: "אדום מותגי",
    settings: { primary: "#e4002b", secondary: "#ff4d6d" },
  },
  {
    id: "csl-gold",
    name: "CSL זהב",
    description: "נייבי וזהב",
    settings: { primary: "#173d6e", secondary: "#f0b020" },
  },
  {
    id: "violet-pink",
    name: "סגול וורוד",
    description: "ברירת מחדל ישנה",
    settings: { primary: "#8b5cf6", secondary: "#ec4899" },
  },
  {
    id: "corporate",
    name: "קורפורייט",
    description: "כחול וטורקיז",
    settings: { primary: "#1e40af", secondary: "#0891b2" },
  },
  {
    id: "energy",
    name: "אנרגיה",
    description: "כתום ואדום",
    settings: { primary: "#ea580c", secondary: "#dc2626" },
  },
  {
    id: "fresh",
    name: "טבעי",
    description: "ירוק וטורקיז",
    settings: { primary: "#16a34a", secondary: "#0d9488" },
  },
  {
    id: "premium",
    name: "פרימיום",
    description: "סגול עמוק וזהב",
    settings: { primary: "#6d28d9", secondary: "#ca8a04" },
  },
  {
    id: "midnight",
    name: "מידנייט",
    description: "כחול עמוק וכסף",
    settings: { primary: "#1e3a8a", secondary: "#94a3b8" },
  },
];
