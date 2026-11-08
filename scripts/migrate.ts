// Explicitly run against a NEW, isolated Neon database only. Never an existing product database.
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
async function main() {
  if (
    process.env.APP_MODE === "local" ||
    !process.env.DATABASE_URL ||
    process.env.CONFIRM_NEW_REVIEW_DATABASE !== "yes"
  )
    throw new Error(
      "Set a separate database and CONFIRM_NEW_REVIEW_DATABASE=yes.",
    );
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema='public'",
    );
    const allowed = [
      "auth_user",
      "auth_session",
      "auth_account",
      "auth_verification",
      "business",
      "membership",
      "platform_admin",
      "location",
      "guest_session",
      "generation",
      "ai_daily_budget",
      "audit_event",
      "review_app_meta",
      "business_logo",
    ];
    if (tables.rows.some((r) => !allowed.includes(r.table_name)))
      throw new Error("Refusing database containing unrelated tables.");
    if (
      tables.rows.length &&
      !tables.rows.some((r) => r.table_name === "review_app_meta")
    )
      throw new Error(
        "Existing database is not marked as this independent app.",
      );
    await pool.query("begin");
    for (const file of (await readdir("migrations"))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort()) {
      await pool.query(await readFile("migrations/" + file, "utf8"));
    }
    await pool.query("commit");
    console.log("Independent review schema applied.");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Migration stopped. Confirm this is a new, isolated review database.",
  );
  process.exit(1);
});
