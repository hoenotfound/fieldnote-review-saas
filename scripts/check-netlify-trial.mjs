/**
 * Netlify build preflight for both legacy pilot and reviewed production modes.
 * Never print environment secrets or database connection strings.
 */
export function netlifyTrialProblems(env) {
  const errors = [];
  const isProduction = env.APP_MODE === "production";
  const dbVariable = isProduction ? "HD_REVIEW_DATABASE_URL" : "FIELDNOTE_TRIAL_DATABASE_URL";
  const markerVariable = isProduction ? "HD_REVIEW_DATABASE_MARKER" : "NETLIFY_TRIAL_MARKER";
  const databaseUrl = env[dbVariable];
  const marker = env[markerVariable];
  if (env.HOSTING_PROVIDER !== "netlify") errors.push("HOSTING_PROVIDER must be netlify.");
  if (env.RENDER === "true") errors.push("Remove Render-only environment variables.");
  if (!["pilot", "production"].includes(env.APP_MODE)) errors.push("APP_MODE must be pilot or production.");
  if (env.REVIEW_DATABASE_APPROVED !== "yes")
    errors.push("Explicitly approve this independent HD Review database.");
  const markerPattern = isProduction
    ? /^hd-review-production-[a-z0-9-]{12,100}$/
    : /^fieldnote-netlify-trial-[a-z0-9-]{12,100}$/;
  if (!markerPattern.test(marker || ""))
    errors.push(`Set ${markerVariable} to the marker stored in the approved HD Review database.`);
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
  // The legacy Netlify Neon extension may provide its own database variables.
  // Ignore generic DATABASE_URL and require this project-specific secret.
  if (!databaseUrl) {
    errors.push(`Missing ${dbVariable}. Set it for Netlify Builds and Functions; generic DATABASE_URL is ignored.`);
  } else {
    try {
      const db = new URL(databaseUrl);
      if (!["postgres:", "postgresql:"].includes(db.protocol))
        errors.push(`${dbVariable} must begin with postgresql://.`);
      if (!db.hostname.endsWith(".neon.tech"))
        errors.push(`${dbVariable} host must end in .neon.tech.`);
      if (!db.hostname.includes("-pooler."))
        errors.push(`${dbVariable} must use the Neon pooled host (-pooler).`);
      if (db.pathname !== "/fieldnote_trial")
        errors.push(`${dbVariable} must select the existing fieldnote_trial database.`);
      // A standard Neon URL uses require. The app upgrades it (or an omitted
      // sslmode) to verify-full before connecting, never weakening TLS.
      const sslModes = db.searchParams.getAll("sslmode");
      if (sslModes.some((mode) => !["require", "verify-full"].includes(mode)))
        errors.push(`${dbVariable} has an unsupported sslmode; use require or verify-full.`);
      if (!sslModes.some((mode) => !["require", "verify-full"].includes(mode)) &&
          (sslModes.length === 0 || sslModes.some((mode) => mode === "require")))
        console.log("Neon trial TLS: secure connection will be upgraded to sslmode=verify-full.");
    } catch {
      errors.push(`${dbVariable} must be a valid PostgreSQL connection URL.`);
    }
  }
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
  if (isProduction && (env.INITIAL_ADMIN_EMAIL || env.INITIAL_ADMIN_PASSWORD))
    errors.push("Remove INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD before switching to production.");
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
    console.log("Netlify configuration validated. Runtime database marker and device checks remain.");
  }
}
