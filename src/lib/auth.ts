import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";
import * as schema from "./schema";
export const origin = () => process.env.APP_ORIGIN || "http://localhost:3000";
export async function makeAuth(bootstrap = false) {
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32
  )
    throw new Error("Set a unique BETTER_AUTH_SECRET.");
  return betterAuth({
    database: drizzleAdapter(await getDb(), { provider: "pg", schema }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: origin(),
    trustedOrigins: [origin()],
    emailAndPassword: {
      enabled: true,
      disableSignUp: !bootstrap,
      minPasswordLength: 12,
    },
    session: { expiresIn: 60 * 60 * 8, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 30 },
    advanced: {
      cookiePrefix: "review_mvp",
      useSecureCookies: origin().startsWith("https://"),
    },
  });
}
let authPromise: ReturnType<typeof makeAuth> | undefined;
export function getAuth() {
  return (authPromise ??= makeAuth());
}
