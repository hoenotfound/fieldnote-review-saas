import { sql } from "drizzle-orm";
import { getDb, type DB } from "./db";
import { sweep } from "./reviews";

/** Called by the protected daily maintenance route. No customer text is logged. */
export async function enforceRetention() {
  const db = await getDb();
  await db.transaction(async (t) => {
    const tx = t as unknown as DB;
    // Finish pending requests and erase cache for expired sessions.
    await sweep(tx);
    // Keep non-content generation metadata for at most ~30 days after creation.
    await tx.execute(
      sql`delete from generation where created_at < now() - interval '30 days' and state <> 'pending'`,
    );
    // Consent-based manual spending reports expire alongside generation metadata.
    await tx.execute(
      sql`delete from manual_spending where recorded_at < now() - interval '30 days'`,
    );
    await tx.execute(
      sql`delete from guest_session g
          where g.expires_at < now() - interval '30 days'
            and not exists (select 1 from generation where guest_id=g.id)
            and not exists (select 1 from manual_spending where guest_id=g.id)`,
    );
    // Network identifiers are hashed and short lived; do not retain IP addresses.
    await tx.execute(
      sql`delete from guest_rate_counter where created_at < now() - interval '3 days'`,
    );
    await tx.execute(
      sql`delete from business_daily_budget
          where day < (now() at time zone 'UTC')::date - 90`,
    );
    await tx.execute(
      sql`delete from ai_daily_budget
          where day < (now() at time zone 'UTC')::date - 90`,
    );
  });
}
