import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { sql } from "drizzle-orm";
import { rows } from "./db";
import { getAuth, origin } from "./auth";
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function seal(s: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(hash(process.env.BETTER_AUTH_SECRET!), "hex"),
    iv,
  );
  return Buffer.concat([
    iv,
    cipher.update(s),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function unseal(s: string) {
  const b = Buffer.from(s, "base64");
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(hash(process.env.BETTER_AUTH_SECRET!), "hex"),
    b.subarray(0, 12),
  );
  d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString();
}
export function requireOrigin(req: Request) {
  if (req.headers.get("origin") !== origin())
    throw new AppError("ORIGIN_REJECTED", 403);
}
export async function actor(headers: Headers) {
  const s = await (await getAuth()).api.getSession({ headers });
  if (!s) throw new AppError("SIGN_IN_REQUIRED", 401);
  return s.user;
}
export async function requireBusiness(userId: string, businessId: string) {
  if (
    !(
      await rows(
        sql`select 1 from membership where user_id=${userId} and business_id=${businessId}`,
      )
    ).length
  )
    throw new AppError("NOT_FOUND", 404);
}
export async function requirePlatform(userId: string) {
  if (
    !(await rows(sql`select 1 from platform_admin where user_id=${userId}`))
      .length
  )
    throw new AppError("NOT_FOUND", 404);
}
export function googleUrl(value: string | null) {
  if (!value) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new AppError("INVALID_GOOGLE_URL");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    ![
      "search.google.com",
      "g.page",
      "maps.google.com",
      "www.google.com",
      "maps.app.goo.gl",
    ].includes(u.hostname)
  )
    throw new AppError("INVALID_GOOGLE_URL");
  return u.toString();
}
export function errorResponse(e: unknown) {
  if (e instanceof AppError)
    return Response.json(
      { error: e.code },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json({ error: "REQUEST_FAILED" }, { status: 500 });
}
