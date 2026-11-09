import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { AppError, errorResponse, hash, requireOrigin, readLimitedJson } from "@/lib/security";
import { publicLocation, generationInput, generate, writeDraft } from "@/lib/reviews";
import { verifyAiChallenge } from "@/lib/ai-challenge";
export const runtime = "nodejs";
export const maxDuration = 35;
export async function POST(req: Request) {
  try {
    requireOrigin(req);
    const rawInput = await readLimitedJson(req, 12000);
    if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput))
      throw new AppError("INVALID_INPUT", 422);
    const { challengeToken, ...candidate } = rawInput as Record<string, unknown>;
    const parsed = generationInput.safeParse(candidate);
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
    // Challenge is optional for normal usage but mandatory once the
    // database-backed unverified visitor allowance is exhausted.
    const verifiedHuman =
      challengeToken === undefined ? false : await verifyAiChallenge(challengeToken);
    return Response.json(await generate(input, guest.id, writeDraft, verifiedHuman), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
