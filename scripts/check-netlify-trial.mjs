/**
 * Build-time guard for a separate Netlify trial. Never prints secret values.
 * The application also checks its unique trial DB marker when connecting.
 */
export function netlifyTrialProblems(env) {
  const errors = [];
  if (env.HOSTING_PROVIDER !== "netlify") errors.push("HOSTING_PROVIDER must be netlify.");
  if (env.RENDER === "true") errors.push("Remove Render-only environment variables.");
  if (env.APP_MODE !== "pilot") errors.push("APP_MODE must be pilot.");
  if (env.REVIEW_DATABASE_APPROVED !== "yes")
    errors.push("Review and explicitly approve the isolated trial database.");
  if (!/^fieldnote-netlify-trial-[a-z0-9-]{12,100}$/.test(env.NETLIFY_TRIAL_MARKER || ""))
    errors.push("Set the marker created in the isolated trial database.");
  let appOrigin = "";
  try {
    const app = new URL(env.APP_ORIGIN || "");
    if (
      app.protocol !== "https:" ||
      !app.hostname.endsWith(".netlify.app") ||
      app.username || app.password ||
      app.pathname !== "/" || app.search || app.hash
    ) throw Error("invalid origin");
    appOrigin = app.origin;
  } catch { errors.push("APP_ORIGIN must be the dedicated HTTPS Netlify trial origin."); }
  if (env.URL && appOrigin) {
    try {
      if (new URL(env.URL).origin !== appOrigin)
        errors.push("APP_ORIGIN must exactly match this Netlify site's primary URL.");
    } catch {
      errors.push("Netlify URL is malformed.");
    }
  }
  try {
    const db = new URL(env.DATABASE_URL || "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.hostname.endsWith(".neon.tech") ||
      db.searchParams.get("sslmode") !== "verify-full"
    ) throw Error("invalid database connection");
  } catch { errors.push("Use the isolated Neon trial database URL with sslmode=verify-full."); }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 ||
      /example|replace/i.test(env.BETTER_AUTH_SECRET))
    errors.push("Set a new 32+ character BETTER_AUTH_SECRET for Netlify.");
  if (!env.MAINTENANCE_SECRET || env.MAINTENANCE_SECRET.length < 32)
    errors.push("Set a separate 32+ character MAINTENANCE_SECRET.");
  if (env.AI_MODE !== "gemini" || !env.GEMINI_API_KEY || !env.GEMINI_MODEL)
    errors.push("Configure the Gemini key/model for the trial.");
  const cap = Number(env.AI_DAILY_ATTEMPT_LIMIT);
  if (!Number.isInteger(cap) || cap < 1 || cap > 100)
    errors.push("Set AI_DAILY_ATTEMPT_LIMIT between 1 and 100 for the trial.");
  if (Boolean(env.TURNSTILE_SITE_KEY) !== Boolean(env.TURNSTILE_SECRET_KEY))
    errors.push("Configure both Turnstile keys, or neither until testing the challenge.");
  return errors;
}

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const errors = netlifyTrialProblems(process.env);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log("Netlify trial configuration validated. Runtime database marker and device checks remain.");
  }
}
