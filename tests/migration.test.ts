import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { getDb, closeDb, rows } from "../src/lib/db";

test("existing local data survives the additive questionnaire migration and reopening", async () => {
  const dir = await mkdtemp(join(tmpdir(), "review-migration-"));
  const original = new PGlite(dir);
  await original.exec(await readFile("migrations/001_initial.sql", "utf8"));
  await original.exec(
    "insert into business(id,name,accent,initials,expires_at,allowance,used) values('existing','My edited brand','#123456','ME',now()+interval '1 day',40,7)",
  );
  await original.exec(
    "insert into location(id,business_id,slug,qr_code,name,address) values('loc','existing','same-link','same-qr','Existing branch','Existing address')",
  );
  await original.close();
  process.env.APP_MODE = "local";
  process.env.LOCAL_DATA_DIR = dir;
  delete process.env.DATABASE_URL;
  try {
    await getDb();
    const b = (
      await rows<{
        name: string;
        accent: string;
        used: number;
        questionnaire: unknown;
      }>(sql`select * from business where id='existing'`)
    )[0];
    assert.equal(b.name, "My edited brand");
    assert.equal(b.accent, "#123456");
    assert.equal(b.used, 7);
    assert.deepEqual(b.questionnaire, { items: [] });
    const config = {
      items: [
        { id: "one", labels: { en: "One", "zh-CN": "", "zh-TW": "", ms: "" } },
      ],
    };
    const db = await getDb();
    await db.execute(
      sql`update business set questionnaire=${JSON.stringify(config)}::jsonb where id='existing'`,
    );
    await closeDb();
    await getDb();
    assert.deepEqual(
      (
        await rows<{ questionnaire: unknown }>(
          sql`select questionnaire from business where id='existing'`,
        )
      )[0].questionnaire,
      config,
    );
    assert.equal(
      (
        await rows<{ qr_code: string }>(
          sql`select qr_code from location where id='loc'`,
        )
      )[0].qr_code,
      "same-qr",
    );
  } finally {
    await closeDb();
  }
});
