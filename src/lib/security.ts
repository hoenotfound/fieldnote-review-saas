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
/** Stream with a strict byte limit. Do not buffer an unlimited request first. */
export async function readLimitedJson(req: Request, maxBytes: number): Promise<unknown> {
  const declared = req.headers.get("content-length");
  if (declared && Number.isFinite(Number(declared)) && Number(declared) > maxBytes)
    throw new AppError("INVALID_INPUT", 413);
  const type = req.headers.get("content-type")?.split(";")[0]?.trim();
  if (type !== "application/json" || !req.body)
    throw new AppError("INVALID_INPUT", 415);
  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new AppError("INVALID_INPUT", 413);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("INVALID_INPUT", 422);
  }
}
export function requireOrigin(req: Request) {
  const expectedOrigin = origin();
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin !== expectedOrigin) {
    if (process.env.HOSTING_PROVIDER === "netlify") {
      // Only log public hostnames and presence flags. Never log the incoming
      // body, cookies, review text, tokens or configuration secrets.
      let requestHostname = "missing-or-invalid";
      try {
        if (requestOrigin) requestHostname = new URL(requestOrigin).hostname;
      } catch {}
      console.warn(JSON.stringify({
        route: "origin-check",
        error_code: "ORIGIN_REJECTED",
        expected_host: new URL(expectedOrigin).hostname,
        received_host: requestHostname,
        origin_present: Boolean(requestOrigin),
      }));
    }
    throw new AppError("ORIGIN_REJECTED", 403);
  }
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
/** Normalize known Facebook Page links to the Reviews tab; never accept arbitrary redirects. */
export function facebookReviewUrl(value: string | null) {
  if (!value?.trim()) return null;
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    throw new AppError("INVALID_FACEBOOK_URL");
  }
  const invalid = () => { throw new AppError("INVALID_FACEBOOK_URL"); };
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash ||
    !["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"].includes(u.hostname))
    invalid();

  // Page copy links often contain these harmless tracking fields. Discard them
  // rather than passing unknown parameters through to the customer's browser.
  const tracking = new Set(["ref", "refid", "fbclid", "mibextid"]);
  for (const [key, val] of u.searchParams) {
    if (key === "id" || key === "sk") continue;
    if (!tracking.has(key) || !/^[A-Za-z0-9._-]{1,128}$/.test(val)) invalid();
  }

  if (u.pathname === "/profile.php") {
    const id = u.searchParams.getAll("id");
    const section = u.searchParams.getAll("sk");
    if (id.length !== 1 || !/^\d{1,25}$/.test(id[0]) ||
      section.length > 1 || (section.length === 1 && section[0] !== "reviews"))
      invalid();
    return "https://www.facebook.com/profile.php?id=" + id[0] + "&sk=reviews";
  }

  if (u.searchParams.has("id") || u.searchParams.has("sk")) invalid();
  const path = u.pathname.replace(/\/+$/, "");
  // Username and numeric Page ID formats, plus legacy /pg/ and /p/ Page links.
  const match = path.match(/^\/(?:(pg|p)\/)?([A-Za-z0-9._-]{1,100})(?:\/reviews)?$/);
  if (!match) invalid();
  const prefix = match![1];
  const page = match![2];
  if (["login", "share", "pages", "groups", "events", "watch", "marketplace",
    "help", "settings", "messages", "reel", "reels", "l.php", "story.php",
    "permalink.php", "photo.php", "video.php", "profile.php"].includes(page.toLowerCase()))
    invalid();
  return "https://www.facebook.com/" + (prefix ? prefix + "/" : "") + page + "/reviews";
}

/** Store an Instagram handle, not a merchant-supplied outgoing URL. */
export function instagramHandle(value: string | null) {
  if (!value?.trim()) return null;
  const handle = value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle) ||
    handle.startsWith(".") || handle.endsWith(".") || handle.includes(".."))
    throw new AppError("INVALID_INSTAGRAM_HANDLE");
  return handle;
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError)
    return Response.json(
      { error: e.code },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json({ error: "REQUEST_FAILED" }, { status: 500 });
}
