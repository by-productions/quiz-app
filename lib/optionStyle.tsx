export type ShapeName = "triangle" | "diamond" | "circle" | "square";

export type OptionStyle = {
  shape: ShapeName;
  /** Tailwind gradient classes for `bg-gradient-to-br` */
  gradient: string;
  /** Solid hex (used for shadows / glows) */
  hex: string;
};

export const OPTION_STYLES: readonly OptionStyle[] = [
  { shape: "triangle", gradient: "from-rose-500 to-red-600",     hex: "#e11d48" },
  { shape: "diamond",  gradient: "from-sky-500 to-blue-600",     hex: "#0ea5e9" },
  { shape: "circle",   gradient: "from-amber-400 to-orange-500", hex: "#f59e0b" },
  { shape: "square",   gradient: "from-emerald-400 to-teal-600", hex: "#10b981" },
] as const;

export function getOptionStyle(index: number): OptionStyle {
  return OPTION_STYLES[index % OPTION_STYLES.length];
}

export function OptionShape({
  shape,
  className,
}: {
  shape: ShapeName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 100 100",
    fill: "currentColor",
    "aria-hidden": true,
    className,
  } as const;
  switch (shape) {
    case "triangle":
      return (
        <svg {...common}>
          <polygon points="50,15 92,85 8,85" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <polygon points="50,8 92,50 50,92 8,50" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="38" />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="15" y="15" width="70" height="70" rx="10" />
        </svg>
      );
  }
}
