import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb, rows } from "../src/lib/db";
import { makeAuth } from "../src/lib/auth";
async function main() {
  if (process.env.APP_MODE !== "local" || process.env.DATABASE_URL)
    throw new Error("Fictional seed is LOCAL ONLY.");
  const db = await getDb();
  const auth = await makeAuth(true);
  const access: string[] = [];
  for (const [email, name, bid] of [
    ["owner@juniper.example", "Juniper owner", "juniper"],
    ["owner@tide.example", "Tide owner", "tide"],
    ["admin@review.example", "Platform operator", ""],
  ]) {
    let u = (
      await rows<{ id: string }>(
        sql`select id from auth_user where email=${email}`,
      )
    )[0];
    if (!u) {
      const password = randomBytes(18).toString("base64url");
      const result = await auth.api.signUpEmail({
        body: { email, password, name },
      });
      u = result.user;
      access.push(`${email}\n${password}\n`);
      await db.execute(
        sql`update auth_user set email_verified=true where id=${u.id}`,
      );
    }
    if (bid) {
      await db.execute(
        sql`insert into business(id,name,accent,initials,expires_at,allowance) values(${bid},${bid === "juniper" ? "Juniper Table" : "Tide & Timber"},${bid === "juniper" ? "#35664f" : "#315f77"},${bid === "juniper" ? "JT" : "TT"},now()+interval '30 days',100) on conflict do nothing`,
      );
      await db.execute(
        sql`insert into membership(user_id,business_id) values(${u.id},${bid}) on conflict do nothing`,
      );
    } else
      await db.execute(
        sql`insert into platform_admin(user_id) values(${u.id}) on conflict do nothing`,
      );
  }
  for (const [id, bid, slug, name, address] of [
    [
      "juniper-centre",
      "juniper",
      "juniper-town-centre",
      "Town Centre",
      "12 Garden Lane · Fictional address",
    ],
    [
      "juniper-park",
      "juniper",
      "juniper-park-side",
      "Park Side",
      "8 Willow Walk · Fictional address",
    ],
    [
      "tide-riverside",
      "tide",
      "tide-riverside",
      "Riverside",
      "21 River Lane · Fictional address",
    ],
  ])
    await db.execute(
      sql`insert into location(id,business_id,slug,qr_code,name,address) values(${id},${bid},${slug},${"demo-" + id},${name},${address}) on conflict do nothing`,
    );
  if (access.length)
    await writeFile(
      "local-access.txt",
      "LOCAL FICTIONAL ACCOUNTS ONLY. Do not deploy these accounts.\n\n" +
        access.join("\n"),
      { mode: 0o600 },
    );
  console.log(
    "Local fictional businesses seeded. Credentials are in local-access.txt (excluded from source package).",
  );
  process.exit(0);
}
main().catch(() => {
  console.error(
    "Seed failed. Check local-only configuration and database schema.",
  );
  process.exit(1);
});
