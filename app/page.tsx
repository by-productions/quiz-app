import Link from "next/link";

const routes = [
  {
    href: "/admin",
    title: "יצירה",
    subtitle: "בנייה ועיצוב של חידונים",
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    href: "/host",
    title: "הנחיה",
    subtitle: "מסך גדול — שליטה במשחק",
    accent: "from-emerald-400 to-teal-600",
  },
  {
    href: "/play",
    title: "השתתפות",
    subtitle: "כניסה עם קוד",
    accent: "from-rose-500 to-pink-600",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-14 p-8">
      <header className="text-center">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight gradient-text leading-tight">
          חידון אינטראקטיבי
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-white/60">
          חוויית חידון בזמן אמת לכנסים ואירועים
        </p>
      </header>

      <div className="grid w-full max-w-4xl gap-5 sm:grid-cols-3">
        {routes.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group glass glass-hover rounded-3xl p-7 transition-transform hover:-translate-y-1"
          >
            <div
              className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${r.accent}`}
            />
            <div className="mt-5 text-3xl font-bold text-white">{r.title}</div>
            <div className="mt-2 text-sm text-white/55">{r.subtitle}</div>
            <div className="mt-6 text-xs text-white/40 group-hover:text-white/70 transition-colors">
              כניסה ←
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
