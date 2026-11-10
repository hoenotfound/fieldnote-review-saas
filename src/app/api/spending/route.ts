import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { publicLocation } from "@/lib/reviews";
import { manualSpendingInput, recordManualSpending } from "@/lib/spending";
import { AppError, errorResponse, hash, requireOrigin, readLimitedJson } from "@/lib/security";

export const runtime = "nodejs";
/** Optional manual-only metadata. Never receives a review, or invokes Gemini. */
export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const parsed = manualSpendingInput.safeParse(await readLimitedJson(req, 1000));
    if (!parsed.success) throw new AppError("INVALID_INPUT", 422);
    const input = parsed.data;
    const loc = await publicLocation(input.slug);
    if (!loc) throw new AppError("NOT_FOUND", 404);
    const token = (await cookies()).get("rv_guest_" + loc.id)?.value;
    if (!token) throw new AppError("SESSION_EXPIRED", 401);
    const session = (
      await rows<{ id: string }>(
        sql`select id from guest_session where token_hash=${hash(token)}
          and location_id=${loc.id} and expires_at>now()`,
      )
    )[0];
    if (!session) throw new AppError("SESSION_EXPIRED", 401);
    await recordManualSpending(input, session.id);
    return Response.json({ ok: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
