import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pilotProblems, databaseConnectionUrl } from "../src/lib/pilot";

const config = {
  HOSTING_PROVIDER: "netlify",
  APP_MODE: "pilot",
  REVIEW_DATABASE_APPROVED: "yes",
  APP_ORIGIN: "https://fieldnote-netlify-trial.netlify.app",
  URL: "https://fieldnote-netlify-trial.netlify.app",
  FIELDNOTE_TRIAL_DATABASE_URL: "postgresql://test:fake@ep-trial-pooler.us-east-2.aws.neon.tech/fieldnote_trial?sslmode=verify-full",
  DATABASE_URL: "postgresql://another:fake@ep-production-pooler.us-east-2.aws.neon.tech/fieldnote?sslmode=require",
  NETLIFY_TRIAL_MARKER: "fieldnote-netlify-trial-morning-cloud-02172364",
  BETTER_AUTH_SECRET: "nonproduction-test-auth-secret-of-more-than-32-chars",
  MAINTENANCE_SECRET: "nonproduction-test-maintenance-secret-of-more-than-32-chars",
  AI_MODE: "gemini",
  GEMINI_API_KEY: "test-not-a-real-api-key",
  GEMINI_MODEL: "test-model-only",
  AI_DAILY_ATTEMPT_LIMIT: "5",
} as const;

test("Netlify preflight accepts only a dedicated site with a separate database marker", () => {
  const env: NodeJS.ProcessEnv = { ...process.env, ...config };
  delete env.RENDER;
  const good = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], {
    encoding: "utf8", env,
  });
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(pilotProblems(env), []);
  assert.equal(databaseConnectionUrl(env), env.FIELDNOTE_TRIAL_DATABASE_URL);
  assert.notEqual(databaseConnectionUrl(env), env.DATABASE_URL);

  const withoutDedicatedUrl = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: "" };
  const missing = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], { encoding: "utf8", env: withoutDedicatedUrl });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing FIELDNOTE_TRIAL_DATABASE_URL/);
  assert.ok(pilotProblems(withoutDedicatedUrl).length);
  const standardNeonUrl = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: env.FIELDNOTE_TRIAL_DATABASE_URL!.replace("sslmode=verify-full", "sslmode=require") };
  const tls = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], { encoding: "utf8", env: standardNeonUrl });
  assert.equal(tls.status, 0, tls.stderr);
  assert.equal(new URL(databaseConnectionUrl(standardNeonUrl)!).searchParams.get("sslmode"), "verify-full");
  assert.match(tls.stdout, /upgraded to sslmode=verify-full/);

  const noSslMode = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: env.FIELDNOTE_TRIAL_DATABASE_URL!.replace("?sslmode=verify-full", "") };
  const absent = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], { encoding: "utf8", env: noSslMode });
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(new URL(databaseConnectionUrl(noSslMode)!).searchParams.get("sslmode"), "verify-full");

  const duplicates = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: env.FIELDNOTE_TRIAL_DATABASE_URL + "&sslmode=require" };
  assert.equal(new URL(databaseConnectionUrl(duplicates)!).searchParams.getAll("sslmode").join(","), "verify-full");

  const disabledTls = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: env.FIELDNOTE_TRIAL_DATABASE_URL!.replace("sslmode=verify-full", "sslmode=disable") };
  const insecure = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], { encoding: "utf8", env: disabledTls });
  assert.notEqual(insecure.status, 0);
  assert.match(insecure.stderr, /unsupported sslmode/);
  assert.ok(pilotProblems(disabledTls).length);
  const wrongDb = { ...env, FIELDNOTE_TRIAL_DATABASE_URL: env.FIELDNOTE_TRIAL_DATABASE_URL!.replace("/fieldnote_trial?", "/fieldnote?") };
  const db = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], { encoding: "utf8", env: wrongDb });
  assert.notEqual(db.status, 0);
  assert.match(db.stderr, /fieldnote_trial database/);
  const noMarker = { ...env, NETLIFY_TRIAL_MARKER: "" };
  const bad = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], {
    encoding: "utf8", env: noMarker,
  });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /marker/i);
  assert.ok(pilotProblems(noMarker).length);

  const prodDomain = { ...env, APP_ORIGIN: "https://fieldnote-review-saas.onrender.com" };
  const rejectProd = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], {
    encoding: "utf8", env: prodDomain,
  });
  assert.notEqual(rejectProd.status, 0);
  assert.match(rejectProd.stderr, /Netlify/i);
});

test("Netlify retention calls only its own protected Netlify endpoint", async () => {
  // @ts-ignore: standalone Netlify ESM function intentionally has no .d.mts declaration
  const module = await import("../netlify/functions/fieldnote-retention.mjs");
  const { default: cleanup, config: schedule } = module;
  assert.equal(schedule.schedule, "23 3 * * *");
  const previous = {
    provider: process.env.HOSTING_PROVIDER,
    origin: process.env.APP_ORIGIN,
    maintenance: process.env.MAINTENANCE_SECRET,
  };
  const previousFetch = globalThis.fetch;
  let count = 0;
  try {
    process.env.HOSTING_PROVIDER = "netlify";
    process.env.APP_ORIGIN = config.APP_ORIGIN;
    process.env.MAINTENANCE_SECRET = config.MAINTENANCE_SECRET;
    globalThis.fetch = async (url, options) => {
      count++;
      assert.equal(String(url), config.APP_ORIGIN + "/api/maintenance");
      assert.equal(options?.method, "POST");
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        "Bearer " + config.MAINTENANCE_SECRET,
      );
      return Response.json({ ok: true });
    };
    await cleanup();
    assert.equal(count, 1);
    process.env.APP_ORIGIN = "https://fieldnote-review-saas.onrender.com";
    await assert.rejects(cleanup(), /non-trial origin/);
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      HOSTING_PROVIDER: previous.provider,
      APP_ORIGIN: previous.origin,
      MAINTENANCE_SECRET: previous.maintenance,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
