import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { origin } from "@/lib/auth";
import { legacyBelecoRedirect } from "@/lib/legacy-beleco-redirect";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const l = (
    await rows<{ slug: string }>(
      sql`select l.slug from location l join business b on b.id=l.business_id where l.qr_code=${code} and l.active and b.active`,
    )
  )[0];
  if (!l) return new Response("This location is unavailable.", { status: 404 });
  const legacy = legacyBelecoRedirect("qr", code, request.url);
  if (legacy) return Response.redirect(legacy, 302);
  const destination = new URL("/r/" + encodeURIComponent(l.slug), origin());
  // Never forward arbitrary user-provided parameters to the customer page.
  if (new URL(request.url).searchParams.get("kiosk") === "1")
    destination.searchParams.set("kiosk", "1");
  return Response.redirect(destination, 302);
}
