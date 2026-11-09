// Explicitly apply to a new Fieldnote database or an existing verified Fieldnote database.
// Never run against DA AI Chatbot or an unrelated database.
import { Pool } from "pg";
import { readFile, readdir } from "node:fs/promises";
async function main() {
  if (process.env.APP_MODE === "local" || !process.env.DATABASE_URL)
    throw new Error("An isolated Fieldnote DATABASE_URL is required.");
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
      "guest_rate_counter",
      "business_daily_budget",
    ];
    if (tables.rows.some((r) => !allowed.includes(r.table_name)))
      throw new Error("Refusing database containing unrelated tables.");
    const existing = tables.rows.length > 0;
    if (existing) {
      if (!tables.rows.some((r) => r.table_name === "review_app_meta"))
        throw new Error("Existing database is not marked as Fieldnote.");
      const marker = await pool.query(
        "select 1 from review_app_meta where id='independent-review-mvp-v1'",
      );
      if (marker.rowCount !== 1)
        throw new Error("Existing database has no verified Fieldnote marker.");
      if (process.env.CONFIRM_EXISTING_FIELDNOTE_MIGRATION !== "yes")
        throw new Error("Set CONFIRM_EXISTING_FIELDNOTE_MIGRATION=yes.");
    } else if (process.env.CONFIRM_NEW_REVIEW_DATABASE !== "yes") {
      throw new Error("Set CONFIRM_NEW_REVIEW_DATABASE=yes.");
    }
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
    "Migration stopped. Verify the separate Fieldnote database and explicit migration approval.",
  );
  process.exit(1);
});
