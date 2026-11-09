import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "drizzle-orm";
import { AppError } from "./security";
import { rows, type DB } from "./db";

/** All counters are atomic PostgreSQL upserts; no process-local limit state. */
export function boundedLimit(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback;
}

/**
 * Render appends the immediate peer to X-Forwarded-For. The rightmost address
 * is used, never the user-controlled leftmost address. Outside Render, an
 * unknown shared key is safer than trusting an unauthenticated header.
 * Network keys are salted digests scoped to a business, never raw addresses.
 */
export function networkKey(request: Request, businessId: string) {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate =
    (process.env.RENDER === "true" || process.env.APP_MODE === "local") &&
    forwarded
      ? forwarded.split(",").at(-1)?.trim()
      : undefined;
  const identity = candidate && isIP(candidate) ? candidate : "unknown";
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET || "local-test-only")
    .update("fieldnote-network-v1:")
    .update(businessId)
    .update(":")
    .update(identity)
    .digest("hex");
}

export async function spendWindow(
  db: DB,
  scope: string,
  key: string,
  seconds: number,
  limit: number,
  errorCode: string,
) {
  const inserted = await rows(
    sql`insert into guest_rate_counter(scope,key_hash,window_key,attempts)
        values (${scope},${key},floor(extract(epoch from now())/${seconds})::bigint,1)
        on conflict(scope,key_hash,window_key)
        do update set attempts=guest_rate_counter.attempts+1
        where guest_rate_counter.attempts < ${limit}
        returning attempts`,
    db,
  );
  if (!inserted.length) throw new AppError(errorCode, 429);
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
) {
  // Sessions issued before the additive migration have no network key.
  // They expire in two hours, but still consume the per-business daily cap.
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
  // Keep a single business from consuming all of a small shared global cap.
  const defaultCap = Math.max(1, Math.min(20, Math.floor(globalCap * 0.6)));
  const businessCap = Math.min(
    globalCap,
    boundedLimit(process.env.AI_BUSINESS_DAILY_ATTEMPT_LIMIT, defaultCap, 10000),
  );
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
