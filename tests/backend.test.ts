import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, rows, closeDb, type DB } from "../src/lib/db";
import {
  requireBusiness,
  requirePlatform,
  googleUrl,
  facebookReviewUrl,
  instagramHandle,
  requireOrigin,
  AppError,
  hash,
  seal,
  unseal,
} from "../src/lib/security";
import {
  generate,
  sweep,
  finishGuest,
  publicLocation,
  type GenerationInput,
  writeDraft,
  reviewAiInput,
} from "../src/lib/reviews";
import { makeAuth, origin } from "../src/lib/auth";
import { translations } from "../src/lib/i18n";
let userId = "";
let db: DB;
before(async () => {
  process.env.LOCAL_DATA_DIR = await mkdtemp(
    join(tmpdir(), "review-mvp-test-"),
  );
  delete process.env.DATABASE_URL;
  process.env.APP_MODE = "local";
  process.env.AI_MODE = "demo";
  process.env.AI_DAILY_ATTEMPT_LIMIT = "100";
  // Legacy interaction tests are not intended to exercise the new business cap.
  process.env.AI_BUSINESS_DAILY_ATTEMPT_LIMIT = "100";
  db = await getDb();
  const a = await makeAuth(true);
  const r = await a.api.signUpEmail({
    body: {
      email: "test@example.com",
      password: "Only-for-local-tests-1827",
      name: "Test owner",
    },
  });
  userId = r.user.id;
  for (const id of ["a", "b"]) {
    await db.execute(
      sql`insert into business(id,name,expires_at,allowance) values(${id},${id},now()+interval '1 day',100)`,
    );
    await db.execute(
      sql`insert into location(id,business_id,slug,qr_code,name,address) values(${id},${id},${id},${"q-" + id},${id},'Fictional address')`,
    );
  }
  await db.execute(
    sql`insert into membership(user_id,business_id) values(${userId},'a')`,
  );
});
async function guest(location = "a") {
  const id = randomUUID();
  await db.execute(
    sql`insert into guest_session(id,token_hash,location_id,expires_at) values(${id},${hash(id)},${location},now()+interval '2 hours')`,
  );
  return id;
}
function input(overrides: Partial<GenerationInput> = {}): GenerationInput {
  return {
    slug: "a",
    experience: "The noodles were good but the wait was long.",
    locale: "en",
    platform: "google",
    requestKey: randomUUID(),
    ...overrides,
  };
}
const fake = async (i: GenerationInput) => ({
  draft: { title: "", body: i.experience, demo: true },
  inputTokens: 0,
  outputTokens: 0,
});
test("manual spending needs consent and correct location, and never charges AI credits", async () => {
  const { recordManualSpending, manualSpendingInput } = await import("../src/lib/spending");
  const guestId = await guest("a");
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: 320, consent: false }).success, false);
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: 100000.01, consent: true }).success, false);
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: 320, consent: true, text: "private review" }).success, false);
  const before = (await rows<{ used: number; reserved: number }>(
    sql`select used,reserved from business where id='a'`,
  ))[0];
  await recordManualSpending({ slug: "a", spend: 320, consent: true }, guestId, db);
  await recordManualSpending({ slug: "a", spend: 450.25, consent: true }, guestId, db);
  const records = await rows<{ spend_rm: string }>(
    sql`select spend_rm from manual_spending where guest_id=${guestId}`,
  );
  assert.equal(records.length, 1);
  assert.equal(Number(records[0].spend_rm), 450.25);
  const after = (await rows<{ used: number; reserved: number }>(
    sql`select used,reserved from business where id='a'`,
  ))[0];
  assert.deepEqual(after, before);
  assert.deepEqual(await rows(sql`select id from generation where guest_id=${guestId}`), []);
  await assert.rejects(
    recordManualSpending({ slug: "b", spend: 100, consent: true }, guestId, db),
    (e: unknown) => e instanceof AppError && e.code === "SESSION_EXPIRED",
  );
  await db.execute(sql`update guest_session set expires_at=now()-interval '1 minute' where id=${guestId}`);
  await assert.rejects(
    recordManualSpending({ slug: "a", spend: 100, consent: true }, guestId, db),
    (e: unknown) => e instanceof AppError && e.status === 401,
  );
});

test("spending averages use latest successful activity, including a cleared amount", async () => {
  const { spendingSummary, recordManualSpending } = await import("../src/lib/spending");
  const businessId = "analytics-test";
  const locationId = "analytics-location";
  await db.execute(sql`insert into business(id,name,expires_at,allowance)
    values(${businessId},'Analytics test',now()+interval '1 day',100)`);
  await db.execute(sql`insert into location(id,business_id,slug,qr_code,name,address)
    values(${locationId},${businessId},${locationId},'analytics-qr','Analytics branch','Local test')`);
  const first = await guest(locationId);
  await db.execute(sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at,created_at,spend_rm)
    values(${randomUUID()},${first},${businessId},${locationId},${randomUUID()},'a','succeeded','en','google','demo',now()+interval '1 hour',now()-interval '10 minutes',125)`);
  await db.execute(sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at,created_at,spend_rm)
    values(${randomUUID()},${first},${businessId},${locationId},${randomUUID()},'b','succeeded','en','google','demo',now()+interval '1 hour',now()-interval '9 minutes',null)`);
  assert.deepEqual(await spendingSummary(businessId, db), []);
  const second = await guest(locationId);
  await recordManualSpending({ slug: locationId, spend: 90, consent: true }, second, db);
  let report = await spendingSummary(businessId, db);
  assert.equal(report.length, 1);
  assert.equal(report[0].responses, 1);
  assert.equal(Number(report[0].avg_rm), 90);
  // Newer successful AI draft with a cleared amount overrides the manual one.
  await db.execute(sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at,created_at,spend_rm)
    values(${randomUUID()},${second},${businessId},${locationId},${randomUUID()},'c','succeeded','en','google','demo',now()+interval '1 hour',now()+interval '1 minute',null)`);
  report = await spendingSummary(businessId, db);
  assert.equal(report.length, 0);
});

test("repeated manual spending writes have a session cap, but withdrawing never does", async () => {
  const { recordManualSpending, manualSpendingInput } = await import("../src/lib/spending");
  const id = await guest("a");
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: null, consent: false }).success, true);
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: 10, consent: false }).success, false);
  assert.equal(manualSpendingInput.safeParse({ slug: "a", spend: null, consent: true }).success, false);
  for (let i = 0; i < 8; i++)
    await recordManualSpending({ slug: "a", spend: i + 1, consent: true }, id, db);
  const before = await rows<{ spend_rm: string }>(sql`select spend_rm from manual_spending where guest_id=${id}`);
  assert.equal(Number(before[0].spend_rm), 8);
  await assert.rejects(
    recordManualSpending({ slug: "a", spend: 9, consent: true }, id, db),
    (e: unknown) => e instanceof AppError && e.status === 429 && e.code === "SPENDING_RATE_LIMIT",
  );
  await recordManualSpending({ slug: "a", spend: null, consent: false }, id, db);
  assert.deepEqual(await rows(sql`select guest_id from manual_spending where guest_id=${id}`), []);
  // Even repeated withdrawals are allowed; they are privacy controls, not billable writes.
  await recordManualSpending({ slug: "a", spend: null, consent: false }, id, db);
});

test("withdrawing consent removes both manual and earlier AI amounts in that guest session", async () => {
  const { recordManualSpending } = await import("../src/lib/spending");
  const id = await guest("a");
  const generationId = randomUUID();
  await db.execute(
    sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at,spend_rm)
      values(${generationId},${id},'a','a',${randomUUID()},'x','succeeded','en','google','demo',now()+interval '1 hour',800)`,
  );
  await recordManualSpending({ slug: "a", spend: 250, consent: true }, id, db);
  await recordManualSpending({ slug: "a", spend: null, consent: false }, id, db);
  assert.deepEqual(await rows(sql`select guest_id from manual_spending where guest_id=${id}`), []);
  assert.deepEqual(
    (await rows<{ spend_rm: string | null }>(
      sql`select spend_rm from generation where id=${generationId}`,
    ))[0].spend_rm, null,
  );
  // A merchant disabling the location must not prevent the customer withdrawing.
  await db.execute(sql`update location set active=false where id='a'`);
  try {
    await recordManualSpending({ slug: "a", spend: null, consent: false }, id, db);
    await assert.rejects(
      recordManualSpending({ slug: "a", spend: 123, consent: true }, id, db),
      (e: unknown) => e instanceof AppError && e.status === 404,
    );
  } finally {
    await db.execute(sql`update location set active=true where id='a'`);
  }
});

test("owner can access own business but not a different business or platform admin", async () => {

  await requireBusiness(userId, "a");
  await assert.rejects(
    requireBusiness(userId, "b"),
    (e: unknown) => e instanceof AppError && e.status === 404,
  );
  await assert.rejects(requirePlatform(userId));
});
test("public registration is disabled; real password authentication works", async () => {
  const a = await makeAuth();
  await assert.rejects(
    a.api.signUpEmail({
      body: {
        email: "blocked@example.com",
        password: "No-public-signup-123",
        name: "Blocked",
      },
    }),
  );
  const signed = await a.api.signInEmail({
    body: { email: "test@example.com", password: "Only-for-local-tests-1827" },
  });
  assert.equal(signed.user.id, userId);
  await assert.rejects(
    a.api.signInEmail({
      body: { email: "test@example.com", password: "wrong-password" },
    }),
  );
});
test("Google links reject script, credentials and lookalike hosts", () => {
  assert.equal(googleUrl(null), null);
  assert.ok(googleUrl("https://g.page/r/demo/review"));
  for (const value of [
    "javascript:alert(1)",
    "https://g.page.evil.test",
    "https://evil.test",
    "https://x@g.page/r/demo",
    "https://g.page:444/x",
  ])
    assert.throws(() => googleUrl(value));
});
test("social destinations reject lookalike hosts and unsafe redirect URLs", () => {
  assert.equal(facebookReviewUrl(null), null);
  assert.equal(instagramHandle(""), null);
  assert.equal(instagramHandle("@yourbusiness"), "yourbusiness");
  assert.ok(facebookReviewUrl("https://www.facebook.com/YourPage/reviews"));
  assert.ok(facebookReviewUrl("https://www.facebook.com/profile.php?id=123456&sk=reviews"));
  assert.equal(facebookReviewUrl("https://m.facebook.com/YourPage/?mibextid=abc_123"), "https://www.facebook.com/YourPage/reviews");
  assert.equal(facebookReviewUrl("https://web.facebook.com/YourPage/reviews/?ref=page_internal"), "https://www.facebook.com/YourPage/reviews");
  assert.equal(facebookReviewUrl("https://www.facebook.com/100064654155301"), "https://www.facebook.com/100064654155301/reviews");
  assert.equal(facebookReviewUrl("https://www.facebook.com/pg/YourPage/reviews/"), "https://www.facebook.com/pg/YourPage/reviews");
  assert.equal(facebookReviewUrl("https://www.facebook.com/p/YourPage-100064654155301/reviews"), "https://www.facebook.com/p/YourPage-100064654155301/reviews");
  assert.equal(facebookReviewUrl("https://www.facebook.com/profile.php?id=123456&ref=page_internal"), "https://www.facebook.com/profile.php?id=123456&sk=reviews");
  assert.equal(facebookReviewUrl("https://www.facebook.com/profile.php?sk=reviews&id=123456"), "https://www.facebook.com/profile.php?id=123456&sk=reviews");
  for (const value of [
    "https://facebook.com.evil.test/YourPage/reviews",
    "javascript:alert(1)",
    "https://x@facebook.com/Page/reviews",
    "https://www.facebook.com/Page/reviews?next=https://evil.test",
    "https://www.facebook.com/Page/reviews?ref=https://evil.test",
    "https://www.facebook.com/Page/reviews?sk=reviews",
    "https://www.facebook.com/profile.php?id=123&sk=reviews&sk=other",
    "https://www.facebook.com/profile.php?id=123&id=456",
    "https://www.facebook.com/l.php?u=https://evil.test",
    "https://www.facebook.com/groups/123/reviews",
    "https://www.facebook.com/login",
  ]) assert.throws(() => facebookReviewUrl(value));
  for (const value of [
    "https://instagram.com/yourbusiness",
    "@name/redirect",
    "my..brand",
    "a".repeat(31),
  ]) assert.throws(() => instagramHandle(value));
});
test("both new platforms pass request validation", async () => {
  const { generationInput } = await import("../src/lib/reviews");
  for (const platform of ["google", "xiaohongshu", "facebook", "instagram"] as const) {
    assert.equal(generationInput.safeParse(input({ platform })).success, true);
  }
  assert.equal(generationInput.safeParse(input({ platform: "other" as GenerationInput["platform"] })).success, false);
});
test("merchant social settings persist and reach only their public location", async () => {
  const url = facebookReviewUrl("https://m.facebook.com/YourPage/?ref=page_internal");
  const handle = instagramHandle("@yourbusiness");
  try {
    await db.execute(
      sql`update location set facebook_review_url=${url}, instagram_handle=${handle} where id='a'`,
    );
    const location = await publicLocation("a");
    assert.equal(location?.facebook_review_url, "https://www.facebook.com/YourPage/reviews");
    assert.equal(location?.instagram_handle, "yourbusiness");
    assert.equal((await publicLocation("b"))?.facebook_review_url, null);
  } finally {
    await db.execute(
      sql`update location set facebook_review_url=null, instagram_handle=null where id='a'`,
    );
  }
});

test("direct Facebook generation with no Page link rejects before provider or quota usage", async () => {
  const id = await guest();
  const attempted = input({ platform: "facebook" });
  let providerCalls = 0;
  const provider = async (i: GenerationInput) => {
    providerCalls++;
    return fake(i);
  };
  const usage = async () => ({
    business: (await rows<{ used: number; reserved: number }>(
      sql`select used, reserved from business where id='a'`,
    ))[0],
    guest: (await rows<{ attempts: number }>(
      sql`select attempts from guest_session where id=${id}`,
    ))[0].attempts,
    global: (await rows<{ attempts: number }>(
      sql`select coalesce((select attempts from ai_daily_budget where day=current_date),0) as attempts`,
    ))[0].attempts,
    perBusiness: (await rows<{ attempts: number }>(
      sql`select coalesce((select attempts from business_daily_budget where business_id='a' and day=current_date),0) as attempts`,
    ))[0].attempts,
    generations: (await rows<{ count: number }>(
      sql`select count(*)::int as count from generation where guest_id=${id}`,
    ))[0].count,
  });
  const before = await usage();
  assert.equal((await publicLocation("a"))?.facebook_review_url, null);
  await assert.rejects(
    generate(attempted, id, provider),
    (e: unknown) => e instanceof AppError && e.code === "FACEBOOK_NOT_CONFIGURED" && e.status === 422,
  );
  assert.equal(providerCalls, 0);
  assert.deepEqual(await usage(), before);
  // After merchant configuration, that same valid request should work.
  await db.execute(sql`update location set facebook_review_url='https://www.facebook.com/TestPage/reviews' where id='a'`);
  try {
    const draft = await generate(attempted, id, provider);
    assert.equal(draft.body, attempted.experience);
    assert.equal(providerCalls, 1);
    assert.equal((await usage()).business.used, before.business.used + 1);
  } finally {
    await db.execute(sql`update location set facebook_review_url=null where id='a'`);
  }
});

test("mutations reject absent or foreign origin", () => {
  assert.throws(() =>
    requireOrigin(new Request("http://localhost/api/manage")),
  );
  assert.throws(() =>
    requireOrigin(
      new Request("http://localhost/api/manage", {
        headers: { origin: "https://evil.test" },
      }),
    ),
  );
  requireOrigin(
    new Request("http://localhost/api/manage", {
      headers: { origin: process.env.APP_ORIGIN! },
    }),
  );
});
test("Netlify trial permits a trailing slash in APP_ORIGIN without weakening origin checks", () => {
  const previousOrigin = process.env.APP_ORIGIN;
  const previousHost = process.env.HOSTING_PROVIDER;
  try {
    process.env.APP_ORIGIN = "https://fieldnote-review.netlify.app/";
    // Browser-sent Origin has no trailing slash. Configuration may have one.
    assert.equal(origin(), "https://fieldnote-review.netlify.app");
    requireOrigin(new Request("https://fieldnote-review.netlify.app/api/guest", {
      method: "POST",
      headers: { origin: "https://fieldnote-review.netlify.app" },
    }));
    delete process.env.HOSTING_PROVIDER;
    for (const candidate of [
      "https://fieldnote-review.netlify.app.evil.test",
      "https://evil.test",
      "null",
    ]) {
      assert.throws(() => requireOrigin(new Request(
        "https://fieldnote-review.netlify.app/api/guest",
        { method: "POST", headers: { origin: candidate } },
      )), (e: unknown) => e instanceof AppError &&
        e.code === "ORIGIN_REJECTED" && e.status === 403);
    }
    assert.throws(() => requireOrigin(new Request(
      "https://fieldnote-review.netlify.app/api/guest",
      { method: "POST" },
    )), (e: unknown) => e instanceof AppError && e.status === 403);
  } finally {
    if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previousOrigin;
    if (previousHost === undefined) delete process.env.HOSTING_PROVIDER;
    else process.env.HOSTING_PROVIDER = previousHost;
  }
});
test("encrypted cache round-trips without retaining plaintext", () => {
  const secret = "my unpublished review";
  const encrypted = seal(secret);
  assert.equal(unseal(encrypted), secret);
  assert.ok(!encrypted.includes(secret));
  assert.throws(() => unseal(encrypted.slice(0, -8) + "AAAAAAAA"));
});
test("all four customer translations have complete matching keys", () => {
  const keys = Object.keys(translations.en).sort();
  for (const t of Object.values(translations))
    assert.deepEqual(Object.keys(t).sort(), keys);
});
test("duplicate request invokes provider once and consumes one credit", async () => {
  const id = await guest();
  const i = input();
  let calls = 0;
  const provider = async (x: GenerationInput) => {
    calls++;
    return fake(x);
  };
  const before = (
    await rows<{ used: number }>(sql`select used from business where id='a'`)
  )[0].used;
  const first = await generate(i, id, provider);
  const second = await generate(i, id, provider);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  assert.equal(
    (
      await rows<{ used: number }>(sql`select used from business where id='a'`)
    )[0].used,
    before + 1,
  );
  await assert.rejects(
    generate({ ...i, experience: "A different experience" }, id, provider),
    (e: unknown) => e instanceof AppError && e.code === "REQUEST_CONFLICT",
  );
});
test("customer session cannot generate for another location", async () => {
  const id = await guest("b");
  await assert.rejects(
    generate(input(), id, fake),
    (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
  );
});
test("provider failure releases reservation and charges no successful draft", async () => {
  const id = await guest();
  const before = (
    await rows<{ used: number; reserved: number }>(
      sql`select used,reserved from business where id='a'`,
    )
  )[0];
  await assert.rejects(
    generate(input(), id, async () => {
      throw new Error("simulated provider failure");
    }),
  );
  const after = (
    await rows<{ used: number; reserved: number }>(
      sql`select used,reserved from business where id='a'`,
    )
  )[0];
  assert.deepEqual(before, after);
});
test("two customers racing for last credit cannot overspend", async () => {
  const usage = (
    await rows<{ used: number }>(sql`select used from business where id='a'`)
  )[0].used;
  await db.execute(
    sql`update business set allowance=${usage + 1} where id='a'`,
  );
  const a = await guest(),
    b = await guest();
  const results = await Promise.allSettled([
    generate(input(), a, fake),
    generate(input(), b, fake),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  const after = (
    await rows<{ used: number; allowance: number; reserved: number }>(
      sql`select used,allowance,reserved from business where id='a'`,
    )
  )[0];
  assert.equal(after.used, after.allowance);
  assert.equal(after.reserved, 0);
  await db.execute(sql`update business set allowance=100 where id='a'`);
});
test("expired subscription refuses generation; manual public page stays available", async () => {
  await db.execute(
    sql`update business set expires_at=now()-interval '1 day' where id='a'`,
  );
  await assert.rejects(
    generate(input(), await guest(), fake),
    (e: unknown) => e instanceof AppError && e.code === "SUBSCRIPTION_EXPIRED",
  );
  await db.execute(
    sql`update business set expires_at=now()+interval '1 day' where id='a'`,
  );
});
test("global attempt cap stops calls even when failed attempts did not consume credits", async () => {
  const id = await guest();
  process.env.AI_DAILY_ATTEMPT_LIMIT = "1";
  let calls = 0;
  await assert.rejects(
    generate(input(), id, async (x) => {
      calls++;
      return fake(x);
    }),
    (e: unknown) => e instanceof AppError && e.code === "DAILY_LIMIT",
  );
  assert.equal(calls, 0);
  process.env.AI_DAILY_ATTEMPT_LIMIT = "100";
});
test("stale requests release quota, expired sessions purge cached draft content", async () => {
  const g = await guest();
  const i = input();
  await generate(i, g, fake);
  await db.execute(
    sql`update guest_session set expires_at=now()-interval '1 second' where id=${g}`,
  );
  const stale = randomUUID();
  await db.execute(
    sql`insert into generation(id,guest_id,business_id,location_id,request_key,input_hash,state,output_locale,platform,provider,deadline_at) values(${stale},${g},'a','a',${randomUUID()},'x','pending','en','google','demo',now()-interval '1 second')`,
  );
  await db.execute(sql`update business set reserved=reserved+1 where id='a'`);
  await db.transaction((t) => sweep(t as unknown as DB));
  assert.equal(
    (
      await rows<{ state: string }>(
        sql`select state from generation where id=${stale}`,
      )
    )[0].state,
    "failed",
  );
  assert.ok(
    (
      await rows<{ output_encrypted: string | null }>(
        sql`select output_encrypted from generation where guest_id=${g}`,
      )
    ).every((r) => r.output_encrypted === null),
  );
});
test("demo is explicit and does not invent or translate the experience", async () => {
  const i = input({ locale: "zh-TW" });
  const r = await writeDraft(i, "Fictional business");
  assert.equal(r.draft.body, i.experience);
  assert.equal(r.draft.demo, true);
});

after(async () => {
  await closeDb();
});

test("finishing a session discards an in-flight result and releases its credit", async () => {
  const id = await guest();
  let release!: (v: Awaited<ReturnType<typeof fake>>) => void;
  let started!: () => void;
  const signal = new Promise<void>((r) => (started = r));
  const i = input();
  const job = generate(i, id, async () => {
    started();
    return new Promise((r) => (release = r));
  });
  await signal;
  await finishGuest(hash(id), "a");
  release(await fake(i));
  await assert.rejects(job);
  const r = (
    await rows<{ state: string; output_encrypted: string | null }>(
      sql`select state,output_encrypted from generation where guest_id=${id}`,
    )
  )[0];
  assert.equal(r.state, "failed");
  assert.equal(r.output_encrypted, null);
  assert.equal(
    (
      await rows<{ reserved: number }>(
        sql`select reserved from business where id='a'`,
      )
    )[0].reserved,
    0,
  );
});

test("authenticated management and QR endpoints enforce business ownership", async () => {
  const { POST } = await import("../src/app/api/manage/route");
  const { GET } = await import("../src/app/api/qr/[id]/route");
  const base = process.env.APP_ORIGIN!;
  const auth = await makeAuth();
  const login = await auth.handler(
    new Request(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: base },
      body: JSON.stringify({
        email: "test@example.com",
        password: "Only-for-local-tests-1827",
      }),
    }),
  );
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  const request = (id: string) =>
    new Request(base + "/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: base, cookie },
      body: JSON.stringify({
        action: "branding",
        businessId: id,
        name: "Updated own brand",
        accent: "#336644",
        initials: "AB",
      }),
    });
  assert.equal((await POST(request("b"))).status, 404);
  assert.equal((await POST(request("a"))).status, 200);
  const questionnaireRequest = (businessId: string) =>
    new Request(base + "/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: base, cookie },
      body: JSON.stringify({
        action: "questionnaire",
        businessId,
        config: {
          items: [
            {
              id: "coffee",
              labels: {
                en: "Coffee",
                "zh-CN": "咖啡",
                "zh-TW": "咖啡",
                ms: "Kopi",
              },
            },
          ],
        },
      }),
    });
  assert.equal((await POST(questionnaireRequest("b"))).status, 404);
  assert.equal((await POST(questionnaireRequest("a"))).status, 200);
  const { publicLocation } = await import("../src/lib/reviews");
  assert.equal(
    (await publicLocation("a"))?.questionnaire?.items[0].labels.ms,
    "Kopi",
  );
  assert.deepEqual((await publicLocation("b"))?.questionnaire?.items, []);

  // Exercise the authenticated location-save route, not just direct SQL writes.
  const locationSave = (
    businessId: string,
    facebookReviewUrlValue: string,
    instagramHandleValue: string,
  ) => new Request(base + "/api/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: base, cookie },
    body: JSON.stringify({
      action: "location",
      businessId,
      id: "a",
      name: "Test location A",
      address: "Fictional address",
      googleUrl: "",
      facebookReviewUrl: facebookReviewUrlValue,
      instagramHandle: instagramHandleValue,
      active: true,
    }),
  });
  assert.equal(
    (await POST(locationSave("b", "https://www.facebook.com/YourPage", "@yourbusiness"))).status,
    404,
  );
  assert.equal(
    (await POST(locationSave("a", "https://m.facebook.com/YourPage/?ref=page_internal", "@yourbusiness"))).status,
    200,
  );
  assert.equal((await publicLocation("a"))?.facebook_review_url, "https://www.facebook.com/YourPage/reviews");
  assert.equal((await publicLocation("a"))?.instagram_handle, "yourbusiness");
  assert.equal((await publicLocation("b"))?.facebook_review_url, null);
  assert.equal((await publicLocation("b"))?.instagram_handle, null);
  assert.equal(
    (await POST(locationSave("a", "https://facebook.com.evil.test/YourPage/reviews", "@bad"))).status,
    400,
  );
  assert.equal((await publicLocation("a"))?.facebook_review_url, "https://www.facebook.com/YourPage/reviews");
  assert.equal((await POST(locationSave("a", "", ""))).status, 200);
  assert.equal((await publicLocation("a"))?.facebook_review_url, null);
  assert.equal((await publicLocation("a"))?.instagram_handle, null);

  assert.equal(
    (
      await GET(new Request(base + "/api/qr/b", { headers: { cookie } }), {
        params: Promise.resolve({ id: "b" }),
      })
    ).status,
    404,
  );
  const qr = await GET(
    new Request(base + "/api/qr/a", { headers: { cookie } }),
    { params: Promise.resolve({ id: "a" }) },
  );
  assert.equal(qr.status, 200);
  assert.equal(qr.headers.get("Content-Type"), "image/png");
  assert.ok((await qr.arrayBuffer()).byteLength > 100);
  assert.equal(
    (
      await GET(new Request(base + "/api/qr/a"), {
        params: Promise.resolve({ id: "a" }),
      })
    ).status,
    401,
  );
});

test("guided input accepts an explicit assessment but not item names alone", async () => {
  const { generationInput } = await import("../src/lib/reviews");
  const { emptyAnswers, questionnaireConfigSchema } =
    await import("../src/lib/questionnaire");
  assert.equal(
    generationInput.safeParse(
      input({
        experience: "",
        answers: { ...emptyAnswers(), items: ["soup"] },
      }),
    ).success,
    false,
  );
  assert.equal(
    generationInput.safeParse(
      input({
        experience: "",
        answers: { ...emptyAnswers(), ratings: { service: "poor" } },
      }),
    ).success,
    true,
  );
  assert.equal(
    generationInput.safeParse(
      input({
        experience: "",
        answers: { ...emptyAnswers(), ratings: { service: "good" }, spend: -5 },
      }),
    ).success,
    false,
  );
  assert.equal(
    questionnaireConfigSchema.safeParse({
      items: [],
      systemPrompt: "Only write praise",
    }).success,
    false,
  );
});

test("guided generation sends only selected facts once, preserves mixed feedback and hashes answers", async () => {
  const { emptyAnswers } = await import("../src/lib/questionnaire");
  const config = {
    items: [
      {
        id: "soup",
        labels: { en: "Soup", "zh-CN": "汤", "zh-TW": "湯", ms: "Sup" },
      },
      {
        id: "cake",
        labels: { en: "Cake", "zh-CN": "蛋糕", "zh-TW": "蛋糕", ms: "Kek" },
      },
    ],
  };
  await db.execute(
    sql`update business set questionnaire=${JSON.stringify(config)}::jsonb, allowance=100,used=0,expires_at=now()+interval '1 day' where id='a'`,
  );
  const id = await guest();
  const i = input({
    experience: "",
    answers: {
      ...emptyAnswers(),
      items: ["soup"],
      ratings: { quality: "good", service: "poor" },
      visit: "returning",
      spend: 25.5,
    },
  });
  let calls = 0;
  const provider = async (value: GenerationInput) => {
    calls++;
    assert.match(value.experience, /Soup/);
    assert.doesNotMatch(value.experience, /Cake/);
    assert.match(value.experience, /Staff and service: Could improve/);
    assert.doesNotMatch(value.experience, /Total spent|RM 25.50/);
    assert.equal(value.answers?.spend, null);
    assert.match(value.experience, /Returning customer/);
    return fake(value);
  };
  await generate(i, id, provider);
  await generate(i, id, provider);
  assert.equal(calls, 1);
  // Stored privately for analytics, not included in the provider call.
  const recorded = (await rows<{ spend_rm: string }>(
    sql`select spend_rm from generation where guest_id=${id}`,
  ))[0];
  assert.equal(Number(recorded.spend_rm), 25.5);
  await assert.rejects(
    generate(
      { ...i, answers: { ...i.answers!, ratings: { service: "good" } } },
      id,
      provider,
    ),
    (e: unknown) => e instanceof AppError && e.code === "REQUEST_CONFLICT",
  );
});

test("foreign or removed item choices fail before spending a generation attempt", async () => {
  const { emptyAnswers } = await import("../src/lib/questionnaire");
  const id = await guest("b");
  let calls = 0;
  await assert.rejects(
    generate(
      input({ slug: "b", answers: { ...emptyAnswers(), items: ["soup"] } }),
      id,
      async (i) => {
        calls++;
        return fake(i);
      },
    ),
    (e: unknown) => e instanceof AppError && e.code === "QUESTIONNAIRE_CHANGED",
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await rows<{ attempts: number }>(
        sql`select attempts from guest_session where id=${id}`,
      )
    )[0].attempts,
    0,
  );
});

test("detailed feedback requires balanced pairs and sends only the customer's selected side", async () => {
  const { questionnaireConfigSchema, answersSchema, emptyAnswers } =
    await import("../src/lib/questionnaire");
  const positive = {
    en: "Service was quick",
    "zh-CN": "服务很快",
    "zh-TW": "服務很快",
    ms: "Layanan cepat",
  };
  const negative = {
    en: "The wait was long",
    "zh-CN": "等候时间很长",
    "zh-TW": "等候時間很長",
    ms: "Masa menunggu lama",
  };
  assert.equal(
    questionnaireConfigSchema.safeParse({
      items: [],
      feedback: [{ id: "speed", positive }],
    }).success,
    false,
  );
  assert.equal(
    answersSchema.safeParse({
      ...emptyAnswers(),
      details: ["speed:positive", "speed:negative"],
    }).success,
    false,
  );
  const config = { items: [], feedback: [{ id: "speed", positive, negative }] };
  await db.execute(
    sql`update business set questionnaire=${JSON.stringify(config)}::jsonb,used=0,allowance=100 where id='a'`,
  );
  const id = await guest();
  let calls = 0;
  const draft = await generate(
    input({
      experience: "",
      answers: { ...emptyAnswers(), details: ["speed:negative"] },
    }),
    id,
    async (i) => {
      calls++;
      assert.equal(i.experience, "The wait was long");
      return fake(i);
    },
  );
  assert.equal(calls, 1);
  assert.equal(draft.body, "The wait was long");
  await assert.rejects(
    generate(
      input({ answers: { ...emptyAnswers(), details: ["foreign:positive"] } }),
      await guest(),
      fake,
    ),
    (e: unknown) => e instanceof AppError && e.code === "QUESTIONNAIRE_CHANGED",
  );
});

test("logo upload, cache and removal enforce ownership and accept only processed raster images", async () => {
  const sharp = (await import("sharp")).default;
  const { POST, DELETE } = await import("../src/app/api/logo/route");
  const { GET } = await import("../src/app/api/logo/[id]/route");
  const base = process.env.APP_ORIGIN!;
  const login = await (
    await makeAuth()
  ).handler(
    new Request(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: base },
      body: JSON.stringify({
        email: "test@example.com",
        password: "Only-for-local-tests-1827",
      }),
    }),
  );
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const png = await sharp({
    create: { width: 600, height: 300, channels: 4, background: "#34674f" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const upload = (
    businessId: string,
    bytes: Uint8Array = png,
    signed = true,
  ) => {
    const form = new FormData();
    form.set("businessId", businessId);
    form.set(
      "logo",
      new File([bytes as BlobPart], "logo.png", { type: "image/png" }),
    );
    return new Request(base + "/api/logo", {
      method: "POST",
      headers: { origin: base, ...(signed ? { cookie } : {}) },
      body: form,
    });
  };
  assert.equal((await POST(upload("a", png, false))).status, 401);
  assert.equal((await POST(upload("b"))).status, 404);
  assert.equal(
    (
      await POST(
        upload("a", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
      )
    ).status,
    422,
  );
  const saved = await POST(upload("a"));
  assert.equal(saved.status, 200);
  const version = (await saved.json()).version;
  const query = { params: Promise.resolve({ id: "a" }) };
  const logo = await GET(new Request(base + "/api/logo/a?v=" + version), query);
  assert.equal(logo.status, 200);
  assert.equal(logo.headers.get("Content-Type"), "image/webp");
  const image = await sharp(Buffer.from(await logo.arrayBuffer())).metadata();
  assert.equal(image.width, 256);
  assert.equal(image.height, 128);
  assert.equal(image.exif, undefined);
  assert.equal(
    (
      await GET(
        new Request(base + "/api/logo/a", {
          headers: { "If-None-Match": '"' + version + '"' },
        }),
        query,
      )
    ).status,
    304,
  );
  const remove = (businessId: string) =>
    new Request(base + "/api/logo", {
      method: "DELETE",
      headers: { origin: base, cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
  assert.equal((await DELETE(remove("b"))).status, 404);
  assert.equal((await DELETE(remove("a"))).status, 200);
  assert.equal(
    (await GET(new Request(base + "/api/logo/a"), query)).status,
    404,
  );
});

test("image processing bounds bytes and decoded dimensions without trusting file extensions", async () => {
  const sharp = (await import("sharp")).default;
  const { processLogo, boundedBody, MAX_LOGO_BYTES } =
    await import("../src/lib/logos");
  await assert.rejects(
    processLogo(Buffer.alloc(MAX_LOGO_BYTES + 1), "image/png"),
    (e: unknown) => e instanceof AppError && e.status === 413,
  );
  const big = await sharp({
    create: { width: 4100, height: 4100, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    processLogo(big, "image/png"),
    (e: unknown) => e instanceof AppError && e.code === "INVALID_LOGO",
  );
  await assert.rejects(
    boundedBody(
      new Request("http://local", { method: "POST", body: "12345" }),
      4,
    ),
    (e: unknown) => e instanceof AppError && e.status === 413,
  );
});

test("pilot configuration refuses demo mode, missing isolation confirmation and insecure URLs", async () => {
  const { pilotProblems } = await import("../src/lib/pilot");
  const env = {
    APP_MODE: "pilot",
    REVIEW_DATABASE_APPROVED: "yes",
    DATABASE_URL:
      "postgresql://user:password@independent-test.neon.tech/reviews?sslmode=require",
    APP_ORIGIN: "https://reviews.test",
    BETTER_AUTH_SECRET: "abc123".repeat(8),
    AI_MODE: "gemini",
    GEMINI_API_KEY: "test-key",
    GEMINI_MODEL: "test-model",
    AI_DAILY_ATTEMPT_LIMIT: "10",
  };
  assert.deepEqual(pilotProblems(env), []);
  for (const change of [
    { APP_MODE: "local" },
    { REVIEW_DATABASE_APPROVED: "" },
    { DATABASE_URL: "postgresql://user:password@unrelated.test/db" },
    { APP_ORIGIN: "http://reviews.test" },
    { AI_DAILY_ATTEMPT_LIMIT: "0" },
  ])
    assert.ok(pilotProblems({ ...env, ...change }).length > 0);
});


test("Xiaohongshu Experience Post accepts customer details but rejects invented or cross-platform mode inputs", async () => {
  const { generationInput } = await import("../src/lib/reviews");
  const valid = {
    ...input({ experience: "", platform: "xiaohongshu" }),
    xhsStyle: "experience" as const,
    xhsStandout: "The staff explained each step before the treatment.",
    xhsTip: "Ask questions about the process before starting.",
  };
  assert.equal(generationInput.safeParse(valid).success, true);
  assert.equal(generationInput.safeParse({ ...valid, xhsStandout: "good", xhsTip: "" }).success, false);
  assert.equal(generationInput.safeParse({ ...valid, xhsStyle: "quick" }).success, false);
  assert.equal(generationInput.safeParse({ ...valid, platform: "google" }).success, false);
  assert.equal(generationInput.safeParse({ ...valid, xhsStandout: "A".repeat(241) }).success, false);
  assert.equal(generationInput.safeParse({
    ...input({ platform: "xiaohongshu", experience: "A nice service." }),
    xhsStyle: "quick",
  }).success, true);
});

test("Experience Post details are included once and are part of idempotency identity", async () => {
  const id = await guest();
  const request = {
    ...input({ experience: "", platform: "xiaohongshu" }),
    xhsStyle: "experience" as const,
    xhsStandout: "I asked about every step and the team explained it.",
    xhsTip: "Bring your questions before the appointment.",
  };
  const observed: Array<{ experience: string; business: string; customerText: string; locationName?: string }> = [];
  // Match writeDraft's optional third argument to satisfy its provider type.
  const provider = async (i: GenerationInput, business: string, customerText = "", locationName?: string) => {
    observed.push({ experience: i.experience, business, customerText, locationName });
    return { draft: { title: "My visit", body: i.xhsStandout || "", demo: true }, inputTokens: 0, outputTokens: 0 };
  };
  await generate(request, id, provider);
  await generate(request, id, provider);
  assert.equal(observed.length, 1);
  // Other backend tests deliberately rename this test business.
  // Compare against the current verified location instead of assuming a fixed name.
  const currentLocation = await publicLocation("a");
  assert.equal(observed[0]?.business, currentLocation?.business_name);
  assert.equal(observed[0]?.locationName, currentLocation?.name);
  assert.match(observed[0]?.customerText || "", /I asked about every step/);
  assert.equal(observed[0]?.experience, "");
  await assert.rejects(
    generate({ ...request, xhsTip: "Different tip from the customer." }, id, provider),
    (error: unknown) => error instanceof AppError && error.code === "REQUEST_CONFLICT",
  );
});

test("Gemini context separates customer-authored concerns from coarse survey labels", () => {
  const typed = "做激光疗程时等候比预期久。";
  const combined = "Product or service quality: Good\\nEnvironment: Mixed\\nValue for money: Mixed\\n\\n" + typed;
  const draftInput = reviewAiInput({
    ...input({ platform: "xiaohongshu", experience: combined }),
    xhsStyle: "quick",
  }, "Test Clinic", typed, "Puchong");
  assert.equal(draftInput.customerWrittenNote, typed);
  assert.equal(draftInput.experience, combined);
  assert.equal(draftInput.platform, "xiaohongshu");
  assert.equal("customerStandout" in draftInput, false);
  assert.equal("locationName" in draftInput, false);
  assert.equal(JSON.stringify(draftInput).includes("RM100"), false);
  const otherPlatform = reviewAiInput(input({ experience: typed, platform: "google" }), "Test Clinic", typed);
  assert.equal(otherPlatform.customerWrittenNote, typed);
  assert.equal("xhsStyle" in otherPlatform, false);
});
