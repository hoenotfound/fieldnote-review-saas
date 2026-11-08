import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { pilotProblems } from "./pilot";
import * as schema from "./schema";
export type DB = PgliteDatabase<typeof schema>;
const state = globalThis as unknown as {
  reviewDb?: Promise<DB>;
  reviewClose?: () => Promise<void>;
};
async function createDatabase(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    if (pilotProblems(process.env).length)
      throw new Error(
        "Pilot configuration is incomplete. Run npm run pilot:check.",
      );
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
    try {
      const marker = await pool.query(
        "select id from review_app_meta where id='independent-review-mvp-v1'",
      );
      if (marker.rowCount !== 1) throw new Error();
      await pool.query("select business_id from business_logo limit 0");
      await pool.query("select questionnaire from business limit 0");
    } catch {
      await pool.end();
      throw new Error(
        "Database is not an initialized independent review app. Apply its migrations explicitly first.",
      );
    }
    state.reviewClose = () => pool.end();
    return pgDrizzle(pool, { schema }) as unknown as DB;
  }
  if (process.env.APP_MODE !== "local")
    throw new Error("A separate DATABASE_URL is required outside local mode.");
  const dataPath = path.resolve(process.env.LOCAL_DATA_DIR || ".data/local");
  await mkdir(dataPath, { recursive: true });
  const client = new PGlite(dataPath);
  await client.waitReady;
  state.reviewClose = () => client.close();
  for (const file of (await readdir("migrations"))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await client.exec(await readFile(path.resolve("migrations", file), "utf8"));
  }
  return drizzle(client, { schema });
}
export function getDb() {
  return (state.reviewDb ??= createDatabase());
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
