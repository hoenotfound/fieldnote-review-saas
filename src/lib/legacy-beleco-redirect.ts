/**
 * Legacy Fieldnote Render QR bridge for the two verified Beleco locations.
 * Disabled by default and restricted to the original Render deployment.
 *
 * Keep the Render service alive while printed QR codes point at its domain.
 * Never make the destination arbitrary or forward unrecognized query strings.
 * The Netlify app uses its own DB and does not invoke this bridge.
 */
const destinationOrigin = "https://fieldnote-review.netlify.app";
const renderOrigin = "https://fieldnote-review-saas.onrender.com";
const qrCodes = new Set([
  "3c5c651505c14e46ae729d33", // Beleco Puchong
  "af4bc34b41cb4adaa1d0e07d", // Beleco Sri Petaling
]);
const slugs = new Set([
  "beleco-clinic-puchong-5f208684220a",
  "beleco-clinic-sri-petaling-473a46a79e90",
]);
export function legacyBelecoRedirect(
  route: "qr" | "review",
  value: string,
  requestUrl: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (
    env.RENDER !== "true" ||
    env.HOSTING_PROVIDER === "netlify" ||
    env.FIELDNOTE_BELECO_NETLIFY_REDIRECT !== "true"
  ) return null;
  try {
    if (new URL(env.APP_ORIGIN || "").origin !== renderOrigin) return null;
    if (!(route === "qr" ? qrCodes : slugs).has(value)) return null;
    const url = new URL(
      route === "qr" ? "/q/" + value : "/r/" + value,
      destinationOrigin,
    );
    // A QR kiosk flag is the only query parameter approved for forwarding.
    if (new URL(requestUrl).searchParams.get("kiosk") === "1")
      url.searchParams.set("kiosk", "1");
    return url.href;
  } catch {
    return null;
  }
}
