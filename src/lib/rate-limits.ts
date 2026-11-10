import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import { AppError } from "./security";
import { rows, type DB } from "./db";

/** Atomic PostgreSQL counters. No per-process limit state and no raw addresses. */
export function boundedLimit(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback;
}

function scopedHash(scope: string, businessId: string, identity: string) {
  if (!process.env.BETTER_AUTH_SECRET && process.env.APP_MODE !== "local")
    throw new Error("BETTER_AUTH_SECRET is required for visitor rate limits");
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET || "local-test-only")
    .update(`fieldnote-${scope}-v2:`)
    .update(businessId)
    .update(":")
    .update(identity)
    .digest("hex");
}

/**
 * Rate-limit network identity must come from the selected hosting platform,
 * never from an untrusted X-Forwarded-For or Client-IP chain. Treat proxy
 * headers as deployment assumptions requiring live spoofing tests. If any
 * required Netlify/Render header is missing, fall back to one shared bucket
 * instead of assuming an attacker-supplied address is genuine.
 */
export function networkKey(request: Request, businessId: string) {
  let identity = "unverified-network";
  if (process.env.HOSTING_PROVIDER === "netlify") {
    // Netlify retains x-nf-client-connection-ip and x-nf-request-id for
    // Functions. x-nf-site-id is NOT a documented forwarded header.
    // Hosting-provider selection and HMAC business scoping bind the identity
    // to this app; never require an unsupported request-site header.
    //
    // Do not trust caller-controlled x-forwarded-for or client-ip. These
    // Netlify headers are deployment assumptions, NOT cryptographic proof.
    // Verify the CDN overwrites spoofed headers before a wider rollout.
    const ip = request.headers.get("x-nf-client-connection-ip")?.trim();
    const requestId = request.headers.get("x-nf-request-id")?.trim();
    if (requestId && /^[a-z0-9-]{10,100}$/i.test(requestId) &&
        ip && isIP(ip)) identity = ip;
  } else if (process.env.RENDER === "true") {
    const ip = request.headers.get("cf-connecting-ip")?.trim();
    if (request.headers.get("cf-ray")?.trim() && ip && isIP(ip))
      identity = ip;
  } else if (process.env.APP_MODE === "local") {
    // Local-only proxy simulation for tests; never used in hosted production.
    const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
    if (ip && isIP(ip)) identity = ip;
  }
  return scopedHash("network", businessId, identity);
}

/** Persistent, random, server-issued browser cookie. Clearing it can still
 * change identity, so it only complements the network controls. */
export function browserKey(cookieToken: string, businessId: string) {
  return scopedHash("browser", businessId, cookieToken);
}

export async function spendWindow(
  db: DB,
  scope: string,
  key: string,
  seconds: number,
  limit: number,
  errorCode: string,
) {
  const updated = await rows(
    sql`insert into guest_rate_counter(scope,key_hash,window_key,attempts)
        values (${scope},${key},floor(extract(epoch from now())/${seconds})::bigint,1)
        on conflict(scope,key_hash,window_key)
        do update set attempts=guest_rate_counter.attempts+1
        where guest_rate_counter.attempts < ${limit}
        returning attempts`,
    db,
  );
  if (!updated.length) throw new AppError(errorCode, 429);
}

export async function limitGuestIssuance(
  db: DB,
  businessId: string,
  key: string,
) {
  await spendWindow(
    db, "session-hour", key, 3600,
    boundedLimit(process.env.GUEST_SESSIONS_PER_NETWORK_HOUR, 20, 500),
    "SESSION_RATE_LIMIT",
  );
  await spendWindow(
    db, "session-day", key, 86400,
    boundedLimit(process.env.GUEST_SESSIONS_PER_NETWORK_DAY, 60, 2000),
    "SESSION_RATE_LIMIT",
  );
  await spendWindow(
    db, "business-session-day", businessId, 86400,
    boundedLimit(process.env.GUEST_SESSIONS_PER_BUSINESS_DAY, 200, 20000),
    "SESSION_RATE_LIMIT",
  );
}

export async function limitGeneration(
  db: DB,
  businessId: string,
  key: string | null,
  globalCap: number,
  clientKey: string | null = null,
  verifiedHuman = false,
) {
  // Existing sessions from before migration 004 have no network/browser key,
  // but still consume business and global caps.
  const defaultBusinessCap = Math.max(1, Math.min(20, Math.floor(globalCap * 0.6)));
  const businessCap = boundedLimit(
    process.env.AI_BUSINESS_DAILY_ATTEMPT_LIMIT, defaultBusinessCap, 10000,
  );
  if (key) {
    await spendWindow(
      db, "generation-hour", key, 3600,
      boundedLimit(process.env.AI_ATTEMPTS_PER_NETWORK_HOUR, 8, 100),
      "AI_RATE_LIMIT",
    );
    await spendWindow(
      db, "generation-day", key, 86400,
      boundedLimit(process.env.AI_ATTEMPTS_PER_NETWORK_DAY, 12, 500),
      "AI_RATE_LIMIT",
    );
  }
  // Without verified challenge, one network can consume only a portion of
  // business capacity. After the threshold, customers can pass Turnstile.
  // With no configured verifier we fail closed and preserve manual writing.
  const challengeAvailable = Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY,
  );
  const challengeError = challengeAvailable
    ? "AI_CHALLENGE_REQUIRED"
    : "AI_RATE_LIMIT";
  if (!verifiedHuman && key) {
    await spendWindow(
      db, "generation-unverified-day", key, 86400,
      boundedLimit(
        process.env.AI_UNVERIFIED_NETWORK_DAILY_LIMIT,
        Math.max(1, Math.min(3, Math.floor(businessCap / 2))),
        100,
      ),
      challengeError,
    );
  }
  if (!verifiedHuman && clientKey) {
    await spendWindow(
      db, "generation-browser-day", clientKey, 86400,
      boundedLimit(process.env.AI_UNVERIFIED_BROWSER_DAILY_LIMIT, 2, 20),
      challengeError,
    );
  }
  const spent = await rows(
    sql`insert into business_daily_budget(business_id,day,attempts)
        values(${businessId},(now() at time zone 'UTC')::date,1)
        on conflict(business_id,day)
        do update set attempts=business_daily_budget.attempts+1
        where business_daily_budget.attempts < ${businessCap}
        returning attempts`,
    db,
  );
  if (!spent.length) throw new AppError("BUSINESS_DAILY_LIMIT", 429);
}
