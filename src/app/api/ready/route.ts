import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";

// On-demand readiness probe. Do not poll it frequently on a serverless Neon plan.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await rows(sql`select 1 as ready`);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
