import { timingSafeEqual } from "node:crypto";
import { enforceRetention } from "@/lib/retention";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.MAINTENANCE_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json({ error: "MAINTENANCE_DISABLED" }, { status: 503 });
  }
  const provided = req.headers.get("authorization");
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(provided || "");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    await enforceRetention();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "CLEANUP_FAILED" }, { status: 503 });
  }
}
