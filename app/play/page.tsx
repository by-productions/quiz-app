import Link from "next/link";

export default function PlayPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        ממשק משתתף
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        כאן משתתפים יצטרפו עם קוד ויצביעו. (ייבנה בשלב 3)
      </p>
      <Link href="/" className="mt-4 text-rose-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
