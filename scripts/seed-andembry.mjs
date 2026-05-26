#!/usr/bin/env node
// Seeds a "Beyond the Attack" quiz with 55 HAE / garadacimab questions.
//
// Usage:
//   node scripts/seed-andembry.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
// (or any of the standard env-file locations). Relies on the "open access"
// RLS policies established in migration 0001 to insert as anon.
//
// If you already ran this script and want a fresh copy of the quiz, just run
// it again — it creates a NEW quiz each time. Delete unwanted duplicates via
// the /admin UI.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { ANDEMBRY_QUESTIONS } from "./andembry-questions.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ---------- minimal .env.local loader ----------
function loadEnvFile(name) {
  try {
    const raw = readFileSync(resolve(projectRoot, name), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    return true;
  } catch {
    return false;
  }
}

// Standard Next.js precedence
loadEnvFile(".env.local");
loadEnvFile(".env.development.local");
loadEnvFile(".env.development");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "❌ Missing Supabase credentials.\n" +
      "   Expected NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)\n" +
      "   in .env.local at the project root.",
  );
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const QUIZ_TITLE = "Beyond the Attack — HAE & garadacimab";

// Andembry brand defaults (teal + navy + 30s default timer).
const DESIGN_SETTINGS = {
  primary: "#04b49d",
  secondary: "#173d6e",
  default_time_limit: 30,
};

async function main() {
  console.log(`📥 Seeding "${QUIZ_TITLE}" with ${ANDEMBRY_QUESTIONS.length} questions…`);

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      title: QUIZ_TITLE,
      design_settings: DESIGN_SETTINGS,
    })
    .select()
    .single();

  if (quizErr || !quiz) {
    console.error("❌ Failed to create quiz:", quizErr?.message ?? quizErr);
    process.exit(1);
  }

  console.log(`   ✓ Quiz created  (id: ${quiz.id})`);

  let qIndex = 0;
  for (const item of ANDEMBRY_QUESTIONS) {
    const { data: question, error: qErr } = await supabase
      .from("questions")
      .insert({
        quiz_id: quiz.id,
        question_text: item.q,
        type: "multiple_choice",
        position: qIndex,
      })
      .select()
      .single();

    if (qErr || !question) {
      console.error(
        `❌ Failed to insert question #${qIndex + 1}:`,
        qErr?.message ?? qErr,
      );
      process.exit(1);
    }

    const optionRows = item.options.map((text, i) => ({
      question_id: question.id,
      text,
      is_correct: i === item.correct,
      position: i,
    }));

    const { error: optErr } = await supabase
      .from("answer_options")
      .insert(optionRows);

    if (optErr) {
      console.error(
        `❌ Failed to insert options for question #${qIndex + 1}:`,
        optErr.message,
      );
      process.exit(1);
    }

    qIndex++;
    process.stdout.write(`   · question ${qIndex}/${ANDEMBRY_QUESTIONS.length}\r`);
  }

  console.log(
    `\n✅ Done. ${ANDEMBRY_QUESTIONS.length} questions seeded into "${quiz.title}".`,
  );
  console.log(`   Open /admin and you should see it at the top of the list.`);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
