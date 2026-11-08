import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { origin } from "@/lib/auth";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const l = (
    await rows<{ slug: string }>(
      sql`select l.slug from location l join business b on b.id=l.business_id where l.qr_code=${code} and l.active and b.active`,
    )
  )[0];
  if (!l) return new Response("This location is unavailable.", { status: 404 });
  return Response.redirect(new URL("/r/" + l.slug, origin()), 302);
}
