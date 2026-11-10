import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pilotProblems, databaseConnectionUrl, expectedDatabaseMarker } from "./pilot";
import * as schema from "./schema";
export type DB = PgliteDatabase<typeof schema>;
const state = globalThis as unknown as {
  reviewDb?: Promise<DB>;
  reviewClose?: () => Promise<void>;
};
async function createDatabase(): Promise<DB> {
  const connectionString = databaseConnectionUrl(process.env);
  if (connectionString) {
    if (pilotProblems(process.env).length)
      throw new Error(
        "Pilot configuration is incomplete. Run npm run pilot:check.",
      );
    const pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
    try {
      const marker = await pool.query(
        "select id from review_app_meta where id='independent-review-mvp-v1'",
      );
      if (marker.rowCount !== 1) throw new Error();
      if (process.env.HOSTING_PROVIDER === "netlify") {
        const expected = expectedDatabaseMarker(process.env);
        const code = process.env.APP_MODE === "production"
          ? "HD_REVIEW_DATABASE_MISMATCH"
          : "NETLIFY_TRIAL_DATABASE_MISMATCH";
        if (!expected) throw Object.assign(new Error(), { code });
        const matched = await pool.query(
          "select 1 from review_app_meta where id = $1",
          [expected],
        );
        if (matched.rowCount !== 1) throw Object.assign(new Error(), { code });
      }
      await pool.query("select business_id from business_logo limit 0");
      await pool.query("select questionnaire from business limit 0");
      // Fail startup clearly if the additive social-destinations migration was missed.
      await pool.query("select facebook_review_url, instagram_handle from location limit 0");
    } catch (cause) {
      await pool.end();
      throw new Error(
        "Database is not an initialized independent review app. Apply its migrations explicitly first.",
        { cause },
      );
    }
    state.reviewClose = () => pool.end();
    return pgDrizzle(pool, { schema }) as unknown as DB;
  }
  if (process.env.APP_MODE !== "local")
    throw new Error(process.env.HOSTING_PROVIDER === "netlify"
      ? `${process.env.APP_MODE === "production" ? "HD_REVIEW_DATABASE_URL" : "FIELDNOTE_TRIAL_DATABASE_URL"} is required for Netlify.`
      : "A separate DATABASE_URL is required outside local mode.");
  const dataPath = path.resolve(process.env.LOCAL_DATA_DIR || ".data/local");
  await mkdir(dataPath, { recursive: true });
  const client = new PGlite(dataPath);
  try {
    await client.waitReady;
    for (const file of (await readdir("migrations"))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort()) {
      await client.exec(await readFile(path.resolve("migrations", file), "utf8"));
    }
    state.reviewClose = () => client.close();
    return drizzle(client, { schema });
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}
export function getDb(): Promise<DB> {
  if (!state.reviewDb) {
    const pending = createDatabase();
    state.reviewDb = pending;
    // Failed startup attempts must not poison this process permanently.
    void pending.catch(() => {
      if (state.reviewDb === pending) {
        delete state.reviewDb;
        delete state.reviewClose;
      }
    });
  }
  return state.reviewDb;
}
export async function rows<T>(
  query: ReturnType<typeof sql>,
  db?: DB,
): Promise<T[]> {
  const result = await (db ?? (await getDb())).execute(query);
  return result.rows as T[];
}

export async function closeDb() {
  await state.reviewClose?.();
  delete state.reviewDb;
  delete state.reviewClose;
}
