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
    id: "default",
    name: "ברירת מחדל",
    description: "סגול וורוד",
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
