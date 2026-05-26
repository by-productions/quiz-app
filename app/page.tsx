import Link from "next/link";
import Image from "next/image";

const routes = [
  {
    href: "/play",
    title: "השתתפות",
    subtitle: "כניסה עם קוד מהמסך",
    accent: "from-[var(--teal)] to-[var(--teal-deep)]",
    initials: "P",
  },
  {
    href: "/host",
    title: "הנחיה",
    subtitle: "מסך גדול — שליטה במשחק",
    accent: "from-[var(--navy)] to-[var(--navy-deep)]",
    initials: "H",
  },
  {
    href: "/admin",
    title: "יצירה",
    subtitle: "בנייה ועיצוב של חידונים",
    accent: "from-[var(--gold-deep)] to-[var(--red)]",
    initials: "A",
  },
];

export default function Home() {
  return (
    <>
      {/* ============ NAV ============ */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/csl-logo.png"
            alt="CSL"
            width={120}
            height={30}
            priority
            className="h-7 w-auto sm:h-8"
          />
          <span className="hidden sm:block h-6 w-px bg-gradient-to-b from-[var(--grey)] to-transparent" />
          <Image
            src="/andembry-logo.png"
            alt="Andembry"
            width={120}
            height={24}
            priority
            className="hidden sm:block h-5 w-auto opacity-95"
          />
        </div>
        <Link
          href="/play"
          className="cta-red whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold sm:px-6 sm:py-3 sm:text-base"
          style={{ fontFamily: "var(--font-heebo)" }}
        >
          הצטרפות למשחק
        </Link>
      </nav>

      {/* ============ HERO ============ */}
      <header className="relative flex min-h-screen flex-col items-center justify-center px-5 pb-20 pt-32 text-center sm:pt-36">
        <div
          className="rise-1 mb-6 inline-flex items-center gap-4 text-xs font-bold uppercase sm:text-sm"
          style={{
            letterSpacing: "0.42em",
            color: "var(--teal-deep)",
            fontFamily: "var(--font-heebo)",
          }}
        >
          <span className="inline-block h-0.5 w-10 rounded-full bg-[var(--teal)]" />
          חידון אינטראקטיבי · CSL
          <span className="inline-block h-0.5 w-10 rounded-full bg-[var(--teal)]" />
        </div>

        <h1
          className="hero-title rise-3"
          dir="ltr"
          style={{
            fontSize: "clamp(2.8rem, 8.5vw, 5.8rem)",
            margin: "0.3rem 0 0.5rem",
          }}
        >
          Beyond <span className="amp">the</span> Attack
        </h1>

        <p
          className="rise-4 mx-auto mt-5 max-w-2xl text-lg font-medium sm:text-xl"
          style={{ color: "var(--ink)", fontFamily: "var(--font-heebo)" }}
        >
          חידון מומחים על אנגיואדמה תורשתית (HAE) ועל
          {" "}
          <span dir="ltr" className="inline-block">
            garadacimab (Andembry)
          </span>
        </p>

        <div className="rise-5 mt-9 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          <span className="meta-pill text-base sm:text-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 sm:h-6 sm:w-6"
              style={{ color: "var(--teal)" }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            55 שאלות · 2 חלקים
          </span>
          <span className="meta-pill text-base sm:text-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 sm:h-6 sm:w-6"
              style={{ color: "var(--gold-deep)" }}
            >
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
            ידע קליני + שיפוט מומחים
          </span>
          <span className="meta-pill text-base sm:text-lg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5 sm:h-6 sm:w-6"
              style={{ color: "var(--navy)" }}
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            מסך גדול + טלפון
          </span>
        </div>

        <div className="rise-6 mt-10 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center">
          <Link
            href="/play"
            className="cta-red rounded-full px-10 py-4 text-lg font-extrabold"
            style={{ fontFamily: "var(--font-heebo)" }}
          >
            הצטרפות עם קוד
          </Link>
          <Link
            href="/host"
            className="rounded-full border-2 px-9 py-4 text-base font-bold transition-all hover:-translate-y-0.5"
            style={{
              borderColor: "rgba(23,61,110,0.22)",
              color: "var(--navy)",
              fontFamily: "var(--font-heebo)",
            }}
          >
            פתיחת מסך הנחיה ←
          </Link>
        </div>

        {/* scroll hint */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs"
          style={{
            color: "var(--navy)",
            letterSpacing: "0.2em",
            fontFamily: "var(--font-heebo)",
            opacity: 0,
            animation: "fadeIn 1s 1.4s forwards",
          }}
        >
          <span className="relative inline-block h-9 w-6 rounded-2xl border-2" style={{ borderColor: "var(--navy)" }}>
            <span
              className="absolute left-1/2 top-1.5 h-1.5 w-1 -translate-x-1/2 rounded"
              style={{
                background: "var(--navy)",
                animation: "wheel 1.6s infinite",
              }}
            />
          </span>
          גלילה
        </div>
      </header>

      {/* ============ ROLE PICKER ============ */}
      <section className="px-5 pb-24 sm:pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <span className="eyebrow">בחירת תפקיד</span>
            <h2
              className="section-title mt-4"
              style={{ fontSize: "clamp(1.8rem, 4.5vw, 2.8rem)" }}
            >
              מה תפקידך <span className="accent">בערב הזה?</span>
            </h2>
            <p
              className="mx-auto mt-3 max-w-xl text-base sm:text-lg"
              style={{ color: "var(--foreground-muted)" }}
            >
              בחר את הממשק המתאים לך — משתתפים נכנסים עם קוד, מנחה פותח את המסך הגדול.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {routes.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="group glass glass-hover rounded-3xl p-7 text-right hover:-translate-y-1"
              >
                <div
                  className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${r.accent}`}
                />
                <div
                  className="mt-5 text-3xl font-extrabold"
                  style={{ color: "var(--navy)", fontFamily: "var(--font-heebo)" }}
                >
                  {r.title}
                </div>
                <div
                  className="mt-2 text-sm"
                  style={{ color: "var(--foreground-muted)" }}
                >
                  {r.subtitle}
                </div>
                <div
                  className="mt-6 text-xs font-bold transition-colors group-hover:opacity-100"
                  style={{ color: "var(--teal-deep)", opacity: 0.7, letterSpacing: "0.15em" }}
                >
                  כניסה ←
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer
        className="relative mt-auto overflow-hidden pb-8 pt-12"
        style={{ background: "var(--navy-deep)", color: "#fff" }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            background: "linear-gradient(90deg, var(--teal), var(--gold), var(--red))",
          }}
        />
        <div className="mx-auto max-w-5xl px-5">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="flex flex-wrap items-center gap-6">
              <Image
                src="/csl-logo.png"
                alt="CSL"
                width={120}
                height={34}
                className="h-9 w-auto rounded-md bg-white px-3 py-1.5"
              />
              <Image
                src="/andembry-logo.png"
                alt="Andembry"
                width={120}
                height={30}
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
            <div
              className="text-sm leading-7"
              style={{ fontFamily: "var(--font-heebo)" }}
            >
              <span style={{ color: "var(--gold)", fontWeight: 700 }}>
                Beyond the Attack
              </span>
              <br />
              חידון אינטראקטיבי על <span dir="ltr">Andembry® (garadacimab)</span>
              <br />
              <span style={{ opacity: 0.7 }}>מאת B.Y Productions</span>
            </div>
          </div>
          <div
            className="mt-10 flex flex-wrap justify-between gap-2 border-t pt-5 text-xs"
            style={{
              borderColor: "rgba(255,255,255,0.12)",
              opacity: 0.7,
            }}
          >
            <span>© 2026 CSL · כל הזכויות שמורות</span>
            <span>מיועד לאנשי מקצוע בתחום הבריאות בלבד</span>
          </div>
        </div>
      </footer>
    </>
  );
}
