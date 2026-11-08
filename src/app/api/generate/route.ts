import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { AppError, errorResponse, hash, requireOrigin } from "@/lib/security";
import { publicLocation, generationInput, generate } from "@/lib/reviews";
export const runtime = "nodejs";
export const maxDuration = 35;
export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const text = await req.text();
    if (text.length > 12000) throw new AppError("INVALID_INPUT", 413);
    const parsed = generationInput.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AppError("INVALID_INPUT", 422);
    const input = parsed.data;
    const loc = await publicLocation(input.slug);
    if (!loc) throw new AppError("NOT_FOUND", 404);
    const token = (await cookies()).get("rv_guest_" + loc.id)?.value;
    if (!token) throw new AppError("SESSION_EXPIRED", 401);
    const guest = (
      await rows<{ id: string }>(
        sql`select id from guest_session where token_hash=${hash(token)} and location_id=${loc.id} and expires_at>now()`,
      )
    )[0];
    if (!guest) throw new AppError("SESSION_EXPIRED", 401);
    return Response.json(await generate(input, guest.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
