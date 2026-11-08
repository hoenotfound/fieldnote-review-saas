import QRCode from "qrcode";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import {
  actor,
  requireBusiness,
  errorResponse,
  AppError,
} from "@/lib/security";
import { origin } from "@/lib/auth";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await actor(req.headers);
    const l = (
      await rows<{ id: string; business_id: string; qr_code: string }>(
        sql`select id,business_id,qr_code from location where id=${(await params).id}`,
      )
    )[0];
    if (!l) throw new AppError("NOT_FOUND", 404);
    await requireBusiness(u.id, l.business_id);
    const png = await QRCode.toBuffer(origin() + "/q/" + l.qr_code, {
      width: 600,
      margin: 3,
      errorCorrectionLevel: "M",
    });
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        ...(new URL(req.url).searchParams.has("download")
          ? { "Content-Disposition": 'attachment; filename="location-qr.png"' }
          : {}),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
