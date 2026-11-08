import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./db";

const credentials = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .refine((value) => !value.endsWith(".example")),
  password: z.string().min(12).max(128),
});

// Server startup only. Never expose this function through an HTTP route.
export async function initializeFirstAdmin(
  db: DB,
  env: Record<string, string | undefined>,
): Promise<"not_configured" | "already_initialized" | "created"> {
  if (!env.INITIAL_ADMIN_EMAIL && !env.INITIAL_ADMIN_PASSWORD)
    return "not_configured";
  if (env.APP_MODE !== "pilot")
    throw new Error("Initial admin setup is restricted to pilot startup.");

  return db.transaction(async (tx) => {
    // Serializes simultaneous starts and blocks competing account inserts.
    await tx.execute(
      sql`lock table auth_user, platform_admin in exclusive mode`,
    );
    const admins = await tx.execute(sql`select 1 from platform_admin limit 1`);
    if (admins.rows.length) return "already_initialized";
    const users = await tx.execute(sql`select 1 from auth_user limit 1`);
    if (users.rows.length)
      throw new Error(
        "Initial admin setup requires an empty account database.",
      );

    const parsed = credentials.safeParse({
      email: env.INITIAL_ADMIN_EMAIL,
      password: env.INITIAL_ADMIN_PASSWORD,
    });
    if (!parsed.success) {
      const invalidPassword = parsed.error.issues.some(
        (issue) => issue.path[0] === "password",
      );
      throw Object.assign(new Error("Initial admin settings are invalid."), {
        code: invalidPassword
          ? "INITIAL_ADMIN_PASSWORD_INVALID"
          : "INITIAL_ADMIN_EMAIL_INVALID",
      });
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);
    await tx.execute(sql`insert into auth_user(id,name,email)
      values(${id},'Platform admin',${parsed.data.email})`);
    await tx.execute(sql`insert into auth_account(id,user_id,account_id,provider_id,password)
      values(${randomUUID()},${id},${id},'credential',${passwordHash})`);
    await tx.execute(sql`insert into platform_admin(user_id) values(${id})`);
    return "created";
  });
}
