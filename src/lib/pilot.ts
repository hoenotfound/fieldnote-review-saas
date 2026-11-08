export function pilotProblems(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  if (env.APP_MODE !== "pilot") errors.push("APP_MODE must be pilot.");
  if (env.REVIEW_DATABASE_APPROVED !== "yes")
    errors.push(
      "Confirm the independent review database with REVIEW_DATABASE_APPROVED=yes.",
    );
  try {
    const db = new URL(env.DATABASE_URL || "");
    if (
      !["postgres:", "postgresql:"].includes(db.protocol) ||
      !db.hostname.endsWith(".neon.tech") ||
      !["require", "verify-full"].includes(db.searchParams.get("sslmode") || "")
    )
      throw new Error();
  } catch {
    errors.push("Use the separate Neon connection string with TLS enabled.");
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
  const limit = Number(env.AI_DAILY_ATTEMPT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    errors.push("Set an explicit daily AI attempt limit from 1 to 10000.");
  return errors;
}
