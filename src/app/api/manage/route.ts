import { randomUUID, randomBytes } from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import {
  actor,
  requireOrigin,
  requireBusiness,
  requirePlatform,
  errorResponse,
  AppError,
  googleUrl,
  facebookReviewUrl,
  instagramHandle,
} from "@/lib/security";
import { getDb, rows, type DB } from "@/lib/db";
import { sweep } from "@/lib/reviews";
import { questionnaireConfigSchema } from "@/lib/questionnaire";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("questionnaire"),
      businessId: z.string(),
      config: questionnaireConfigSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("branding"),
      businessId: z.string(),
      name: z.string().trim().min(2).max(80),
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      initials: z.string().trim().min(1).max(3),
    })
    .strict(),
  z
    .object({
      action: z.literal("location"),
      businessId: z.string(),
      id: z.string().optional(),
      name: z.string().trim().min(2).max(80),
      address: z.string().trim().min(2).max(200),
      googleUrl: z.string().max(500),
      facebookReviewUrl: z.string().max(500).optional(),
      instagramHandle: z.string().max(100).optional(),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("subscription"),
      businessId: z.string(),
      active: z.boolean(),
      allowance: z.number().int().min(0).max(100000),
      expiresAt: z.string().datetime(),
      resetUsage: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("business"),
      name: z.string().trim().min(2).max(80),
      ownerEmail: z.string().email(),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const text = await req.text();
    if (text.length > 20000) throw new AppError("INVALID_INPUT", 413);
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AppError("INVALID_INPUT", 422);
    const data = parsed.data;
    const u = await actor(req.headers);
    const db = await getDb();
    if (data.action === "business") {
      await requirePlatform(u.id);
      const owner = (
        await rows<{ id: string }>(
          sql`select id from auth_user where email=${data.ownerEmail.toLowerCase()}`,
        )
      )[0];
      if (!owner) throw new AppError("OWNER_ACCOUNT_REQUIRED", 422);
      const id = randomUUID();
      await db.transaction(async (t) => {
        await t.execute(
          sql`insert into business(id,name,expires_at) values(${id},${data.name},now()+interval '30 days')`,
        );
        await t.execute(
          sql`insert into membership(user_id,business_id) values(${owner.id},${id})`,
        );
        await t.execute(
          sql`insert into audit_event(id,actor_id,business_id,action) values(${randomUUID()},${u.id},${id},'business_created')`,
        );
      });
    } else if (data.action === "subscription") {
      await requirePlatform(u.id);
      await db.transaction(async (t) => {
        await sweep(t as unknown as DB);
        const b = (
          await rows<{ used: number; reserved: number }>(
            sql`select used,reserved from business where id=${data.businessId} for update`,
            t as unknown as DB,
          )
        )[0];
        if (!b) throw new AppError("NOT_FOUND", 404);
        if (data.resetUsage && b.reserved > 0)
          throw new AppError("GENERATION_IN_PROGRESS", 409);
        await t.execute(
          sql`update business set active=${data.active}, allowance=${data.allowance}, expires_at=${data.expiresAt}::timestamptz,used=${data.resetUsage ? 0 : b.used} where id=${data.businessId}`,
        );
        await t.execute(
          sql`insert into audit_event(id,actor_id,business_id,action) values(${randomUUID()},${u.id},${data.businessId},${data.resetUsage ? "subscription_updated_usage_reset" : "subscription_updated"})`,
        );
      });
    } else {
      await requireBusiness(u.id, data.businessId);
      if (data.action === "branding")
        await db.execute(
          sql`update business set name=${data.name},accent=${data.accent},initials=${data.initials} where id=${data.businessId}`,
        );
      else if (data.action === "questionnaire") {
        await db.execute(
          sql`update business set questionnaire=${JSON.stringify(data.config)}::jsonb where id=${data.businessId}`,
        );
      } else {
        const url = googleUrl(data.googleUrl || null);
        const facebookUrl = facebookReviewUrl(data.facebookReviewUrl || null);
        const instagram = instagramHandle(data.instagramHandle || null);
        if (data.id) {
          const done = await rows(
            sql`update location set name=${data.name},address=${data.address},google_url=${url},facebook_review_url=${facebookUrl},instagram_handle=${instagram},active=${data.active} where id=${data.id} and business_id=${data.businessId} returning id`,
          );
          if (!done.length) throw new AppError("NOT_FOUND", 404);
        } else {
          const id = randomUUID();
          const suffix = randomBytes(6).toString("hex");
          const slug =
            data.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 45) || "location";
          await db.execute(
            sql`insert into location(id,business_id,slug,qr_code,name,address,google_url,facebook_review_url,instagram_handle,active) values(${id},${data.businessId},${slug + "-" + suffix},${randomBytes(12).toString("hex")},${data.name},${data.address},${url},${facebookUrl},${instagram},${data.active})`,
          );
        }
      }
      await db.execute(
        sql`insert into audit_event(id,actor_id,business_id,action) values(${randomUUID()},${u.id},${data.businessId},${data.action + "_updated"})`,
      );
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
