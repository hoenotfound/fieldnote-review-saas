export function safeStartupFailure(stage: string, error: unknown) {
  const stages = [
    "configuration",
    "database",
    "initial-admin",
    "account-check",
  ];
  const safeStage = stages.includes(stage) ? stage : "startup";
  const reasons: Record<string, string> = {
    "28P01": "Database authentication failed.",
    "42501": "The database role lacks a required permission.",
    NETLIFY_TRIAL_DATABASE_MISMATCH: "The database is not the approved isolated Netlify trial database.",
    "42P01": "A required database table is missing.",
    "42703": "A required database column is missing.",
    ENOTFOUND: "The database hostname could not be resolved.",
    EAI_AGAIN: "Database hostname resolution temporarily failed.",
    ETIMEDOUT: "The database connection timed out.",
    ECONNREFUSED: "The database connection was refused.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE:
      "Database TLS certificate verification failed.",
    SELF_SIGNED_CERT_IN_CHAIN: "Database TLS certificate verification failed.",
    ERR_TLS_CERT_ALTNAME_INVALID: "The database TLS hostname did not match.",
    CERT_HAS_EXPIRED: "The database TLS certificate has expired.",
    INITIAL_ADMIN_PASSWORD_INVALID:
      "INITIAL_ADMIN_PASSWORD must contain 12 to 128 characters.",
    INITIAL_ADMIN_EMAIL_INVALID:
      "INITIAL_ADMIN_EMAIL must be a valid non-demo email address.",
    PILOT_ADMIN_MISSING:
      "No platform admin exists. Supply both initial-admin settings for an empty account database.",
    PILOT_FIXTURES_PRESENT:
      "Remove fictional demo records before enabling the pilot.",
  };
  let current = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === "object";
    depth++
  ) {
    const item = current as { code?: unknown; cause?: unknown };
    if (
      typeof item.code === "string" &&
      Object.prototype.hasOwnProperty.call(reasons, item.code)
    )
      return `Pilot check failed at ${safeStage} (${item.code}). ${reasons[item.code]} No credentials are printed.`;
    current = item.cause;
  }
  return `Pilot check failed at ${safeStage}. Check the database, account settings and server configuration. No credentials are printed.`;
}

/** Netlify must never use the generic DATABASE_URL from an extension.
 * Upgrade only the approved Neon trial URL to full TLS certificate verification.
 * Never silently downgrade or override an unsafe SSL mode.
 */
export function databaseConnectionUrl(env: Record<string, string | undefined>) {
  if (env.HOSTING_PROVIDER !== "netlify") return env.DATABASE_URL;
  const raw = env.FIELDNOTE_TRIAL_DATABASE_URL;
  if (!raw) return raw;
  try {
    const db = new URL(raw);
    const sslModes = db.searchParams.getAll("sslmode");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.hostname.endsWith(".neon.tech") ||
      !db.hostname.includes("-pooler.") ||
      db.pathname !== "/fieldnote_trial" ||
      sslModes.some((mode) => mode !== "require" && mode !== "verify-full")
    ) return raw;
    // Normalizes an omitted mode, Neon default require, or duplicate secure
    // sslmode parameters to one explicit verify-full before pg sees the URL.
    db.searchParams.set("sslmode", "verify-full");
    return db.toString();
  } catch {
    return raw;
  }
}

export function pilotProblems(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  if (env.APP_MODE !== "pilot") errors.push("APP_MODE must be pilot.");
  if (env.REVIEW_DATABASE_APPROVED !== "yes")
    errors.push(
      "Confirm the independent review database with REVIEW_DATABASE_APPROVED=yes.",
    );
  try {
    const db = new URL(databaseConnectionUrl(env) || "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.hostname.endsWith(".neon.tech") ||
      !["require", "verify-full"].includes(db.searchParams.get("sslmode") || "") ||
      (env.HOSTING_PROVIDER === "netlify" &&
        (db.pathname !== "/fieldnote_trial" ||
         db.searchParams.get("sslmode") !== "verify-full" ||
         !db.hostname.includes("-pooler.")))
    )
      throw new Error();
  } catch {
    errors.push(env.HOSTING_PROVIDER === "netlify"
      ? "FIELDNOTE_TRIAL_DATABASE_URL must be the pooled Neon trial connection for /fieldnote_trial with sslmode=verify-full; DATABASE_URL is ignored on Netlify."
      : "Use the separate Neon connection string with TLS enabled.");
  }
  try {
    const url = new URL(env.APP_ORIGIN || "");
    if (
      url.protocol !== "https:" ||
      url.hostname === "localhost" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
  } catch {
    errors.push("APP_ORIGIN must be the exact public HTTPS origin.");
  }
  if (
    !env.BETTER_AUTH_SECRET ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    /replace|example/i.test(env.BETTER_AUTH_SECRET)
  )
    errors.push(
      "Set a unique random authentication secret of at least 32 characters.",
    );
  if (env.AI_MODE !== "gemini" || !env.GEMINI_API_KEY || !env.GEMINI_MODEL)
    errors.push(
      "Configure the server-side Gemini key, model and AI_MODE=gemini.",
    );
  if (env.HOSTING_PROVIDER === "netlify") {
    // A marker exists only in the isolated trial database, never in Render's
    // live database. It is checked again during every application cold start.
    if (!/^fieldnote-netlify-trial-[a-z0-9-]{12,100}$/.test(env.NETLIFY_TRIAL_MARKER || ""))
      errors.push("NETLIFY_TRIAL_MARKER must identify the isolated Netlify database.");
    const host = (() => {
      try { return new URL(env.APP_ORIGIN || "").hostname; } catch { return ""; }
    })();
    if (!host.endsWith(".netlify.app") || !host || host === ".netlify.app")
      errors.push("Use the dedicated Netlify trial domain for APP_ORIGIN.");
    if (env.RENDER === "true")
      errors.push("Do not enable both Render and Netlify hosting providers.");
  }
  const limit = Number(env.AI_DAILY_ATTEMPT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    errors.push("Set an explicit daily AI attempt limit from 1 to 10000.");
  return errors;
}
