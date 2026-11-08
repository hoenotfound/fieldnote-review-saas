// Local operator CLI. Password is read from stdin, never command arguments or logs.
import { makeAuth } from "../src/lib/auth";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "../src/lib/db";
async function main() {
  const pilot = process.env.APP_MODE === "pilot";
  if (
    pilot
      ? process.env.ALLOW_OWNER_PROVISIONING !== "yes"
      : process.env.APP_MODE !== "local" || process.env.DATABASE_URL
  )
    throw new Error(
      "Pilot provisioning requires the temporary ALLOW_OWNER_PROVISIONING=yes operator flag.",
    );
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const { email, name, password, platformAdmin = false } = JSON.parse(raw);
  if (
    typeof platformAdmin !== "boolean" ||
    (pilot && String(email).endsWith(".example"))
  )
    throw new Error("Use a real pilot account.");
  const created = await (
    await makeAuth(true)
  ).api.signUpEmail({ body: { email, name, password } });
  if (platformAdmin)
    await (
      await getDb()
    ).execute(
      sql`insert into platform_admin(user_id) values(${created.user.id})`,
    );
  console.log(
    "Account created. Assign business access through platform admin if needed.",
  );
  await closeDb();
}
main().catch(() => {
  console.error("Account not created. Check local mode and account details.");
  process.exit(1);
});
