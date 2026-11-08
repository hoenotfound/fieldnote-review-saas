import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const logo = (
    await rows<{ data: string; version: string }>(
      sql`select encode(l.data,'base64') data,l.version from business_logo l join business b on b.id=l.business_id where l.business_id=${id} and b.active=true`,
    )
  )[0];
  const wanted = new URL(req.url).searchParams.get("v");
  if (!logo || (wanted && wanted !== logo.version))
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const etag = '"' + logo.version + '"';
  const headers = {
    "Content-Type": "image/webp",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=3600",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return new Response(Buffer.from(logo.data, "base64"), { headers });
}
