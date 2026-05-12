import Link from "next/link";

const routes = [
  {
    href: "/admin",
    title: "יצירה",
    subtitle: "בנייה ועיצוב של חידונים",
    accent: "bg-indigo-600 hover:bg-indigo-500",
  },
  {
    href: "/host",
    title: "מנחה",
    subtitle: "מסך גדול — שליטה בקצב המשחק",
    accent: "bg-emerald-600 hover:bg-emerald-500",
  },
  {
    href: "/play",
    title: "השתתפות",
    subtitle: "כניסה למשחק עם קוד",
    accent: "bg-rose-600 hover:bg-rose-500",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 p-8 bg-zinc-50 dark:bg-black">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          חידון אינטראקטיבי
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          בחרי את הממשק שאליו את רוצה להיכנס
        </p>
      </header>

      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {routes.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className={`${r.accent} flex flex-col items-center justify-center rounded-2xl p-8 text-white shadow-lg transition-colors`}
          >
            <span className="text-2xl font-semibold">{r.title}</span>
            <span className="mt-2 text-sm opacity-90">{r.subtitle}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
