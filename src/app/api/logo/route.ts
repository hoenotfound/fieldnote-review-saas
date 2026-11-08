import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  actor,
  requireBusiness,
  requireOrigin,
  errorResponse,
  AppError,
} from "@/lib/security";
import { boundedBody, processLogo, MAX_LOGO_BYTES } from "@/lib/logos";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const user = await actor(req.headers);
    const raw = await boundedBody(req, MAX_LOGO_BYTES + 16000);
    const form = await new Response(raw, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    const businessId = form.get("businessId"),
      file = form.get("logo");
    if (
      typeof businessId !== "string" ||
      businessId.length > 100 ||
      !(file instanceof File)
    )
      throw new AppError("INVALID_INPUT", 422);
    await requireBusiness(user.id, businessId);
    const bytes = await processLogo(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const version = randomUUID(),
      db = await getDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`insert into business_logo(business_id,data,version) values(${businessId},decode(${bytes.toString("base64")},'base64'),${version}) on conflict(business_id) do update set data=excluded.data,version=excluded.version,updated_at=now()`,
      );
      await tx.execute(
        sql`insert into audit_event(id,actor_id,business_id,action) values(${randomUUID()},${user.id},${businessId},'logo_updated')`,
      );
    });
    return Response.json(
      { version },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    requireOrigin(req);
    const user = await actor(req.headers);
    const body = JSON.parse((await boundedBody(req, 1000)).toString());
    if (typeof body.businessId !== "string" || body.businessId.length > 100)
      throw new AppError("INVALID_INPUT", 422);
    await requireBusiness(user.id, body.businessId);
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`delete from business_logo where business_id=${body.businessId}`,
      );
      await tx.execute(
        sql`insert into audit_event(id,actor_id,business_id,action) values(${randomUUID()},${user.id},${body.businessId},'logo_removed')`,
      );
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
