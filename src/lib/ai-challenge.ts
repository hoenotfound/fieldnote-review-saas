import { origin } from "./auth";
import { AppError } from "./security";

/** Turnstile tokens are single-use. Only the server calls Siteverify. */
export async function verifyAiChallenge(token: unknown): Promise<boolean> {
  if (!process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY)
    throw new AppError("AI_RATE_LIMIT", 429);
  if (typeof token !== "string" || !token || token.length > 2048)
    throw new AppError("AI_CHALLENGE_FAILED", 403);

  const form = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("Siteverify unavailable");
    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (
      result.success !== true ||
      result.action !== "fieldnote_ai" ||
      result.hostname !== new URL(origin()).hostname
    )
      throw new AppError("AI_CHALLENGE_FAILED", 403);
    return true;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("AI_CHALLENGE_FAILED", 503);
  }
}
