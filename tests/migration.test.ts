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
  // A legacy database is reachable but must fail the new schema readiness check.
  await assert.rejects(original.query("select facebook_review_url, instagram_handle from location limit 0"));
  await original.exec(
    "insert into business(id,name,accent,initials,expires_at,allowance,used) values('existing','My edited brand','#123456','ME',now()+interval '1 day',40,7)",
  );
  await original.exec(
    "insert into location(id,business_id,slug,qr_code,name,address,google_url) values('loc','existing','same-link','same-qr','Existing branch','Existing address','https://g.page/r/demo/review')",
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
    const location = (
      await rows<{ qr_code: string; slug: string; google_url: string; facebook_review_url: string | null; instagram_handle: string | null }>(
        sql`select qr_code, slug, google_url, facebook_review_url, instagram_handle from location where id='loc'`,
      )
    )[0];
    assert.equal(location.slug, "same-link");
    assert.equal(location.qr_code, "same-qr");
    assert.equal(location.google_url, "https://g.page/r/demo/review");
    assert.equal(location.facebook_review_url, null);
    assert.equal(location.instagram_handle, null);
    await (await getDb()).execute(
      sql`update location set facebook_review_url='https://www.facebook.com/TestPage/reviews', instagram_handle='testclinic' where id='loc'`,
    );
    await closeDb();
    await getDb();
    const after = (
      await rows<{ qr_code: string; google_url: string; facebook_review_url: string; instagram_handle: string }>(
        sql`select qr_code, google_url, facebook_review_url, instagram_handle from location where id='loc'`,
      )
    )[0];
    assert.equal(after.qr_code, "same-qr");
    assert.equal(after.google_url, "https://g.page/r/demo/review");
    assert.equal(after.facebook_review_url, "https://www.facebook.com/TestPage/reviews");
    assert.equal(after.instagram_handle, "testclinic");
  } finally {
    await closeDb();
  }
});
