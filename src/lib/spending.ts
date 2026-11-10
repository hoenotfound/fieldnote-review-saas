import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows, type DB } from "./db";
import { AppError } from "./security";
import { spendAmountSchema } from "./questionnaire";

export const manualSpendingInput = z.object({
  slug: z.string().min(1).max(100),
  spend: spendAmountSchema,
  consent: z.literal(true),
}).strict();

/** Only existing, live, location-bound guests can store manual spending. */
export async function recordManualSpending(
  input: z.infer<typeof manualSpendingInput>,
  guestId: string,
  db?: DB,
) {
  const recorded = await rows<{ guest_id: string }>(
    sql`insert into manual_spending(guest_id,business_id,location_id,spend_rm)
      select g.id, l.business_id, l.id, ${input.spend}
      from guest_session g
      join location l on l.id=g.location_id
      join business b on b.id=l.business_id
      where g.id=${guestId} and g.expires_at>now()
        and l.slug=${input.slug} and l.active=true and b.active=true
      on conflict(guest_id)
        do update set spend_rm=excluded.spend_rm, recorded_at=now()
      returning guest_id`,
    db ?? (await getDb()),
  );
  if (!recorded.length) throw new AppError("SESSION_EXPIRED", 401);
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
