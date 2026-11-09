import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { getDb, rows, closeDb } from "../src/lib/db";
import { getAuth } from "../src/lib/auth";

test("failed first database startup can recover without restarting the process", async () => {
  const previousMode = process.env.APP_MODE;
  const previousUrl = process.env.DATABASE_URL;
  const previousDir = process.env.LOCAL_DATA_DIR;
  try {
    delete process.env.DATABASE_URL;
    process.env.APP_MODE = "pilot";
    await assert.rejects(getDb(), /DATABASE_URL/);

    process.env.APP_MODE = "local";
    process.env.LOCAL_DATA_DIR = await mkdtemp(
      join(tmpdir(), "fieldnote-startup-retry-"),
    );
    const db = await getDb();
    assert.ok(db);
    const result = await rows<{ result: number }>(sql`select 1 as result`);
    assert.equal(result[0].result, 1);
  } finally {
    await closeDb();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousDir === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = previousDir;
  }
});

test("failed first auth initialization can recover after valid configuration", async () => {
  const previousMode = process.env.APP_MODE;
  const previousUrl = process.env.DATABASE_URL;
  const previousDir = process.env.LOCAL_DATA_DIR;
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  try {
    delete process.env.DATABASE_URL;
    process.env.APP_MODE = "local";
    process.env.LOCAL_DATA_DIR = await mkdtemp(
      join(tmpdir(), "fieldnote-auth-retry-"),
    );
    process.env.BETTER_AUTH_SECRET = "short";
    await assert.rejects(getAuth(), /BETTER_AUTH_SECRET/);

    process.env.BETTER_AUTH_SECRET = "recovery-test-secret-at-least-32-chars";
    const auth = await getAuth();
    assert.equal(typeof auth.handler, "function");
    assert.equal(await getAuth(), auth);
  } finally {
    await closeDb();
    if (previousMode === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = previousMode;
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousDir === undefined) delete process.env.LOCAL_DATA_DIR;
    else process.env.LOCAL_DATA_DIR = previousDir;
    if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previousSecret;
  }
});
