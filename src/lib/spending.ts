import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows, type DB } from "./db";
import { AppError, hash } from "./security";
import { spendWindow } from "./rate-limits";
import { spendAmountSchema } from "./questionnaire";

const spendingSlug = z.string().min(1).max(100);
export const manualSpendingInput = z.discriminatedUnion("consent", [
  z.object({ slug: spendingSlug, spend: spendAmountSchema, consent: z.literal(true) }).strict(),
  z.object({ slug: spendingSlug, spend: z.null(), consent: z.literal(false) }).strict(),
]);

/**
 * Guest-owned, location-scoped optional analytics.
 * A withdrawal removes manual spending and any older AI spending in this same
 * session; later explicitly submitted AI amounts can be recorded independently.
 * Only saves have a request cap. Withdrawing consent must never be rate-limited.
 */
export async function recordManualSpending(
  input: z.infer<typeof manualSpendingInput>,
  guestId: string,
  db?: DB,
) {
  const database = db ?? (await getDb());
  await database.transaction(async (t) => {
    const tx = t as unknown as DB;
    const guest = (await rows<{
      location_id: string;
      business_id: string;
      location_active: boolean;
      business_active: boolean;
    }>(
      sql`select l.id as location_id, l.business_id, l.active as location_active,
            b.active as business_active
          from guest_session g
          join location l on l.id=g.location_id
          join business b on b.id=l.business_id
          where g.id=${guestId} and g.expires_at>now()
            and l.slug=${input.slug}
          for update of g`,
      tx,
    ))[0];
    if (!guest) throw new AppError("SESSION_EXPIRED", 401);

    if (!input.consent) {
      // No amount is needed for deletion. Do not require the business to remain active.
      await tx.execute(sql`delete from manual_spending where guest_id=${guestId}`);
      await tx.execute(
        sql`update generation set spend_rm=null
            where guest_id=${guestId} and spend_rm is not null`,
      );
      return;
    }
    if (!guest.location_active || !guest.business_active)
      throw new AppError("NOT_FOUND", 404);
    await spendWindow(
      tx, "manual-spend-session", hash(guestId), 7200, 8, "SPENDING_RATE_LIMIT",
    );
    await tx.execute(
      sql`insert into manual_spending(guest_id,business_id,location_id,spend_rm)
          values(${guestId},${guest.business_id},${guest.location_id},${input.spend})
          on conflict(guest_id)
          do update set spend_rm=excluded.spend_rm, recorded_at=now()`,
    );
  });
}

/** Latest completed activity per guest wins, even if its amount was cleared. */
export async function spendingSummary(businessId: string, db?: DB) {
  return rows<{ location_id: string; responses: number; avg_rm: string }>(
    sql`with activity as (
        select guest_id, location_id, spend_rm, created_at as at_time, 1 as source,
          id as record_id
        from generation
        where business_id=${businessId} and state='succeeded'
        union all
        select guest_id, location_id, spend_rm, recorded_at as at_time, 2 as source,
          guest_id as record_id
        from manual_spending
        where business_id=${businessId}
      ), latest as (
        select distinct on (guest_id) guest_id, location_id, spend_rm
        from activity order by guest_id, at_time desc, source desc, record_id desc
      )
      select location_id, count(*)::int as responses,
             round(avg(spend_rm),2)::text as avg_rm
      from latest where spend_rm is not null group by location_id`,
    db ?? (await getDb()),
  );
}
