import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pilotProblems } from "../src/lib/pilot";

const config = {
  HOSTING_PROVIDER: "netlify",
  APP_MODE: "pilot",
  REVIEW_DATABASE_APPROVED: "yes",
  APP_ORIGIN: "https://fieldnote-netlify-trial.netlify.app",
  URL: "https://fieldnote-netlify-trial.netlify.app",
  DATABASE_URL: "postgresql://test:fake@ep-trial-pooler.us-east-2.aws.neon.tech/fieldnote_trial?sslmode=verify-full",
  NETLIFY_TRIAL_MARKER: "fieldnote-netlify-trial-morning-cloud-02172364",
  BETTER_AUTH_SECRET: "nonproduction-test-auth-secret-of-more-than-32-chars",
  MAINTENANCE_SECRET: "nonproduction-test-maintenance-secret-of-more-than-32-chars",
  AI_MODE: "gemini",
  GEMINI_API_KEY: "test-not-a-real-api-key",
  GEMINI_MODEL: "test-model-only",
  AI_DAILY_ATTEMPT_LIMIT: "5",
} as const;

test("Netlify preflight accepts only a dedicated site with a separate database marker", () => {
  const env = { ...process.env, ...config };
  delete env.RENDER;
  const good = spawnSync(process.execPath, ["scripts/check-netlify-trial.mjs"], {
    encoding: "utf8", env,
  });
  assert.equal(good.status, 0, good.stderr);
  assert.deepEqual(pilotProblems(env), []);

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
  const { default: cleanup, config: schedule } =
    await import("../netlify/functions/fieldnote-retention.mjs");
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
