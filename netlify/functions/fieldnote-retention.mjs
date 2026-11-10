/**
 * Netlify-only privacy cleanup, separate from the existing Render/GitHub job.
 * The server endpoint authenticates the request with MAINTENANCE_SECRET.
 * Netlify scheduled functions execute on published deploys in UTC.
 */
export default async function fieldnoteRetention() {
  const site = process.env.APP_ORIGIN;
  const secret = process.env.MAINTENANCE_SECRET;
  if (
    process.env.HOSTING_PROVIDER !== "netlify" ||
    !site || !secret || secret.length < 32
  ) throw new Error("Trial retention is not safely configured");
  const url = new URL(site);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".netlify.app") ||
      url.href !== url.origin + "/")
    throw new Error("Retention refuses a non-trial origin");
  const response = await fetch(url.origin + "/api/maintenance", {
    method: "POST",
    headers: { authorization: "Bearer " + secret },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error("Trial retention failed with HTTP " + response.status);
}

export const config = { schedule: "23 3 * * *" };
