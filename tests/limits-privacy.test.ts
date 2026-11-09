import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, rows, closeDb, type DB } from "../src/lib/db";
import {
  networkKey,
  spendWindow,
  limitGuestIssuance,
  limitGeneration,
} from "../src/lib/rate-limits";
import { enforceRetention } from "../src/lib/retention";
import { AppError } from "../src/lib/security";

let db: DB;
before(async () => {
  process.env.LOCAL_DATA_DIR = await mkdtemp(join(tmpdir(), "fieldnote-rate-"));
  process.env.APP_MODE = "local";
  process.env.BETTER_AUTH_SECRET = "isolated-local-test-secret-longer-than-32";
  delete process.env.DATABASE_URL;
  db = await getDb();
  await db.execute(
    sql`insert into business(id,name,expires_at,allowance)
        values('limits-a','Test clinic',now()+interval '7 days',100)`,
  );
});
after(async () => {
  await closeDb();
});

test("spoofed leftmost forwarded address cannot change selected network", () => {
  const request = (xff: string) => new Request("http://localhost/api/guest", {
    headers: { "x-forwarded-for": xff },
  });
  assert.equal(
    networkKey(request("198.51.100.5, 203.0.113.10"), "limits-a"),
    networkKey(request("192.0.2.111, 203.0.113.10"), "limits-a"),
  );
  assert.notEqual(
    networkKey(request("192.0.2.111, 203.0.113.10"), "limits-a"),
    networkKey(request("192.0.2.111, 203.0.113.11"), "limits-a"),
  );
  assert.notEqual(
    networkKey(request("203.0.113.10"), "limits-a"),
    networkKey(request("203.0.113.10"), "other-business"),
  );
});

test("atomic window counters stop further requests", async () => {
  const key = randomUUID();
  await spendWindow(db, "test-hour", key, 3600, 2, "SESSION_RATE_LIMIT");
  await spendWindow(db, "test-hour", key, 3600, 2, "SESSION_RATE_LIMIT");
  await assert.rejects(
    spendWindow(db, "test-hour", key, 3600, 2, "SESSION_RATE_LIMIT"),
    (e: unknown) => e instanceof AppError && e.status === 429,
  );
});

test("repeated issuance is bounded without charging unrelated networks", async () => {
  const a = randomUUID(), b = randomUUID();
  process.env.GUEST_SESSIONS_PER_NETWORK_HOUR = "2";
  try {
    await db.transaction(async (t) => limitGuestIssuance(t as unknown as DB, "limits-a", a));
    await db.transaction(async (t) => limitGuestIssuance(t as unknown as DB, "limits-a", a));
    await assert.rejects(
      db.transaction(async (t) => limitGuestIssuance(t as unknown as DB, "limits-a", a)),
      (e: unknown) => e instanceof AppError && e.status === 429,
    );
    await db.transaction(async (t) => limitGuestIssuance(t as unknown as DB, "limits-a", b));
  } finally {
    delete process.env.GUEST_SESSIONS_PER_NETWORK_HOUR;
  }
});

test("a small global allowance preserves capacity for another business", async () => {
  const distinct = Array.from({ length: 7 }, () => randomUUID());
  for (let i = 0; i < 6; i++)
    await db.transaction(async (t) =>
      limitGeneration(t as unknown as DB, "limits-a", distinct[i], 10),
    );
  await assert.rejects(
    db.transaction(async (t) =>
      limitGeneration(t as unknown as DB, "limits-a", distinct[6], 10),
    ),
    (e: unknown) => e instanceof AppError && e.code === "BUSINESS_DAILY_LIMIT",
  );
});

test("retention removes stale content and expired records", async () => {
  const g = randomUUID(), id = randomUUID();
  await db.execute(sql`insert into location(id,business_id,slug,qr_code,name,address)
    values('limits-location','limits-a','limits-location','limits-qr','Clinic','Test address')`);
  await db.execute(sql`insert into guest_session(id,token_hash,location_id,expires_at)
    values(${g},${g},'limits-location',now()-interval '40 days')`);
  await db.execute(sql`insert into generation(
    id,guest_id,business_id,location_id,request_key,input_hash,state,
    output_encrypted,output_locale,platform,provider,created_at,deadline_at
  ) values(
    ${id},${g},'limits-a','limits-location',${randomUUID()},'hash',
    'succeeded','encrypted','en','google','demo',
    now()-interval '35 days',now()-interval '35 days'
  )`);
  await enforceRetention();
  assert.equal((await rows(sql`select id from generation where id=${id}`)).length, 0);
  assert.equal((await rows(sql`select id from guest_session where id=${g}`)).length, 0);
});

test("maintenance endpoint requires a private bearer secret", async () => {
  const { POST } = await import("../src/app/api/maintenance/route");
  process.env.MAINTENANCE_SECRET = "maintenance-long-test-secret-at-least-32";
  try {
    const req = new Request("http://localhost/api/maintenance", { method: "POST" });
    assert.equal((await POST(req)).status, 401);
  } finally {
    delete process.env.MAINTENANCE_SECRET;
  }
});
