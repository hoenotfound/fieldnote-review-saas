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

test("Render Cloudflare visitor header is stable despite forged forwarded chains", () => {
  const prior = process.env.RENDER;
  try {
    process.env.RENDER = "true";
    const req = (ip: string, xff: string, ray = "ray-123") =>
      new Request("https://example.com/api/guest", {
        headers: { "cf-connecting-ip": ip, "cf-ray": ray, "x-forwarded-for": xff },
      });
    assert.equal(
      networkKey(req("203.0.113.10", "198.51.100.1, 192.0.2.1"), "limits-a"),
      networkKey(req("203.0.113.10", "192.0.2.200, 198.51.100.20"), "limits-a"),
    );
    assert.notEqual(
      networkKey(req("203.0.113.10", "192.0.2.20"), "limits-a"),
      networkKey(req("203.0.113.11", "192.0.2.20"), "limits-a"),
    );
    // If Cloudflare provenance cannot be checked, fail closed to one key.
    assert.equal(
      networkKey(req("203.0.113.10", "spoof", ""), "limits-a"),
      networkKey(req("203.0.113.11", "spoof", ""), "limits-a"),
    );
  } finally {
    if (prior === undefined) delete process.env.RENDER;
    else process.env.RENDER = prior;
  }
});

test("Netlify network identity is site-bound and ignores caller forwarded chains", () => {
  const saved = {
    hosting: process.env.HOSTING_PROVIDER,
    render: process.env.RENDER,
    site: process.env.SITE_ID,
  };
  try {
    process.env.HOSTING_PROVIDER = "netlify";
    process.env.SITE_ID = "00000000-0000-4000-8000-000000000001";
    delete process.env.RENDER;
    const req = (ip: string, xff: string, siteId = process.env.SITE_ID!, requestId = "01KNNETLIFYREQUESTABCD") =>
      new Request("https://fieldnote-trial.netlify.app/api/guest", {
        headers: {
          "x-nf-client-connection-ip": ip,
          "x-nf-request-id": requestId,
          "x-nf-site-id": siteId,
          "x-forwarded-for": xff,
        },
      });
    assert.equal(
      networkKey(req("203.0.113.10", "192.0.2.10"), "limits-a"),
      networkKey(req("203.0.113.10", "198.51.100.5"), "limits-a"),
    );
    assert.notEqual(
      networkKey(req("203.0.113.10", "192.0.2.10"), "limits-a"),
      networkKey(req("203.0.113.11", "192.0.2.10"), "limits-a"),
    );
    // Incorrect/missing Netlify site or request ID: fail closed to one bucket.
    assert.equal(
      networkKey(req("203.0.113.10", "spoof", "wrong-site"), "limits-a"),
      networkKey(req("203.0.113.11", "other", "wrong-site"), "limits-a"),
    );
    assert.equal(
      networkKey(req("203.0.113.10", "spoof", process.env.SITE_ID, ""), "limits-a"),
      networkKey(req("203.0.113.11", "other", process.env.SITE_ID, ""), "limits-a"),
    );
    // Netlify never falls back to a caller-supplied XFF when its metadata is absent.
    assert.equal(
      networkKey(new Request("https://fieldnote-trial.netlify.app", { headers: {
        "x-forwarded-for": "203.0.113.10",
      }}), "limits-a"),
      networkKey(new Request("https://fieldnote-trial.netlify.app", { headers: {
        "x-forwarded-for": "203.0.113.200",
      }}), "limits-a"),
    );
  } finally {
    for (const [key, value] of Object.entries({
      HOSTING_PROVIDER: saved.hosting,
      RENDER: saved.render,
      SITE_ID: saved.site,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("unverified networks are limited but verified users can continue on shared Wi-Fi", async () => {
  await db.execute(sql`insert into business(id,name,expires_at,allowance)
    values('shared-clinic','Shared Wi-Fi',now()+interval '7 days',100)`);
  process.env.TURNSTILE_SITE_KEY = "public-test-key";
  process.env.TURNSTILE_SECRET_KEY = "private-test-key";
  try {
    for (let i = 0; i < 3; i++) {
      await db.transaction(async t =>
        limitGeneration(t as unknown as DB, "shared-clinic", "same-wifi", 10, "browser-" + i),
      );
    }
    await assert.rejects(
      db.transaction(async t =>
        limitGeneration(t as unknown as DB, "shared-clinic", "same-wifi", 10, "browser-new"),
      ),
      (e: unknown) => e instanceof AppError && e.code === "AI_CHALLENGE_REQUIRED",
    );
    // Someone on the same legitimate clinic Wi-Fi can complete the challenge.
    await db.transaction(async t =>
      limitGeneration(t as unknown as DB, "shared-clinic", "same-wifi", 10, "browser-new", true),
    );
    const totals = await rows<{ attempts: number }>(
      sql`select attempts from business_daily_budget where business_id='shared-clinic'`,
    );
    assert.equal(totals[0].attempts, 4);
    // A different visitor network can still use the remaining budget.
    await db.transaction(async t =>
      limitGeneration(t as unknown as DB, "shared-clinic", "other-wifi", 10, "browser-other"),
    );
  } finally {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  }
});

test("replacing a guest session does not reset the browser's unverified AI budget", async () => {
  await db.execute(sql`insert into business(id,name,expires_at,allowance)
    values('browser-limit','Same browser',now()+interval '7 days',100)`);
  process.env.TURNSTILE_SITE_KEY = "test-key";
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  try {
    await db.transaction(async t =>
      limitGeneration(t as unknown as DB, "browser-limit", "network-one", 10, "same-browser"),
    );
    await db.transaction(async t =>
      limitGeneration(t as unknown as DB, "browser-limit", "network-two", 10, "same-browser"),
    );
    await assert.rejects(
      db.transaction(async t =>
        limitGeneration(t as unknown as DB, "browser-limit", "network-three", 10, "same-browser"),
      ),
      (e: unknown) => e instanceof AppError && e.code === "AI_CHALLENGE_REQUIRED",
    );
  } finally {
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  }
});

test("QR redirect forwards only the approved kiosk flag", async () => {
  const { GET } = await import("../src/app/q/[code]/route");
  const route = (query: string) => GET(
    new Request("http://localhost:3000/q/limits-qr" + query),
    { params: Promise.resolve({ code: "limits-qr" }) },
  );
  const kiosk = await route("?kiosk=1&next=https://evil.example");
  assert.equal(kiosk.status, 302);
  const url = new URL(kiosk.headers.get("location")!);
  assert.equal(url.searchParams.get("kiosk"), "1");
  assert.equal(url.searchParams.has("next"), false);
  assert.equal(url.pathname, "/r/limits-location");
  const normal = await route("?kiosk=anything-else");
  assert.equal(new URL(normal.headers.get("location")!).search, "");
});

test("human verification rejects invalid tokens, wrong hostnames and wrong actions", async () => {
  const { verifyAiChallenge } = await import("../src/lib/ai-challenge");
  const priorFetch = globalThis.fetch;
  const priorSite = process.env.TURNSTILE_SITE_KEY;
  const priorSecret = process.env.TURNSTILE_SECRET_KEY;
  process.env.TURNSTILE_SITE_KEY = "test-public";
  process.env.TURNSTILE_SECRET_KEY = "test-private";
  try {
    await assert.rejects(verifyAiChallenge(""), e => e instanceof AppError);
    globalThis.fetch = async () => Response.json({
      success: true, hostname: "evil.example", action: "fieldnote_ai",
    });
    await assert.rejects(verifyAiChallenge("provided-token"), e => e instanceof AppError);
    globalThis.fetch = async () => Response.json({
      success: true, hostname: new URL(process.env.APP_ORIGIN!).hostname, action: "wrong-action",
    });
    await assert.rejects(verifyAiChallenge("provided-token"), e => e instanceof AppError);
    globalThis.fetch = async () => Response.json({
      success: true, hostname: new URL(process.env.APP_ORIGIN!).hostname, action: "fieldnote_ai",
    });
    assert.equal(await verifyAiChallenge("provided-token"), true);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSite === undefined) delete process.env.TURNSTILE_SITE_KEY;
    else process.env.TURNSTILE_SITE_KEY = priorSite;
    if (priorSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = priorSecret;
  }
});

test("JSON parsing enforces byte limits before allocation and rejects invalid JSON", async () => {
  const { readLimitedJson } = await import("../src/lib/security");
  const make = (body: string, headers?: Record<string, string>) =>
    new Request("http://localhost:3000/api/guest", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    });
  const tooBig = make(JSON.stringify({ input: "x".repeat(5000) }));
  await assert.rejects(
    readLimitedJson(tooBig, 100),
    (e: unknown) => e instanceof AppError && e.status === 413,
  );
  const bogusLength = make("{}", { "Content-Length": "5000" });
  await assert.rejects(
    readLimitedJson(bogusLength, 100),
    (e: unknown) => e instanceof AppError && e.status === 413,
  );
  await assert.rejects(
    readLimitedJson(make("{malformed"), 100),
    (e: unknown) => e instanceof AppError && e.status === 422,
  );
  assert.deepEqual(await readLimitedJson(make('{"slug":"a"}'), 100), { slug: "a" });
});
