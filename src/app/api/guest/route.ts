import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { rows, getDb, type DB } from "@/lib/db";
import { limitGuestIssuance, networkKey, browserKey } from "@/lib/rate-limits";
import { publicLocation, finishGuest } from "@/lib/reviews";
import { AppError, errorResponse, hash, requireOrigin } from "@/lib/security";
import { origin } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const raw = await req.text();
    if (raw.length > 1000) throw new AppError("INVALID_INPUT", 413);
    const body = JSON.parse(raw);
    if (!body || typeof body.slug !== "string" || body.slug.length > 100)
      throw new AppError("INVALID_INPUT");
    const loc = await publicLocation(body.slug);
    if (!loc) throw new AppError("NOT_FOUND", 404);
    const jar = await cookies();
    const name = "rv_guest_" + loc.id;
    const old = jar.get(name)?.value;
    if (body.finish) {
      if (old) await finishGuest(hash(old), loc.id);
      jar.delete(name);
      return Response.json({ ok: true });
    }
    if (
      old &&
      (
        await rows(
          sql`select 1 from guest_session where token_hash=${hash(old)} and location_id=${loc.id} and expires_at>now()`,
        )
      ).length
    )
      return Response.json({ ok: true });
    const token = randomBytes(32).toString("hex");
    const key = networkKey(req, loc.business_id);
    const existingBrowser = jar.get("rv_browser")?.value;
    const browserToken = existingBrowser && /^[a-f0-9]{64}$/.test(existingBrowser)
      ? existingBrowser
      : randomBytes(32).toString("hex");
    const clientKey = browserKey(browserToken, loc.business_id);
    const db = await getDb();
    await db.transaction(async (t) => {
      const tx = t as unknown as DB;
      await limitGuestIssuance(tx, loc.business_id, key);
      await tx.execute(
        sql`insert into guest_session(id,token_hash,location_id,expires_at,network_key,client_key)
            values(${randomUUID()},${hash(token)},${loc.id},now()+interval '2 hours',${key},${clientKey})`,
      );
    });
    jar.set("rv_browser", browserToken, {
      httpOnly: true,
      secure: origin().startsWith("https://"),
      sameSite: "strict",
      maxAge: 86400,
      path: "/",
    });
    jar.set(name, token, {
      httpOnly: true,
      secure: origin().startsWith("https://"),
      sameSite: "strict",
      maxAge: 7200,
      path: "/",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
