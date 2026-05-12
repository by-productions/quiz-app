import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
        ממשק יצירה
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        כאן תבני ותעצבי חידונים. (ייבנה בשלב 6)
      </p>
      <Link href="/" className="mt-4 text-indigo-600 hover:underline">
        חזרה לדף הבית
      </Link>
    </main>
  );
}
