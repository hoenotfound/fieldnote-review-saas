import { notFound, redirect } from "next/navigation";
import { legacyBelecoRedirect } from "@/lib/legacy-beleco-redirect";
import { origin } from "@/lib/auth";
import { ReviewForm } from "@/components/review-form";
import { publicLocation } from "@/lib/reviews";
export const dynamic = "force-dynamic";
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ kiosk?: string }>;
}) {
  const slug = (await params).slug;
  const l = await publicLocation(slug);
  if (!l) notFound();
  const query = (await searchParams)?.kiosk === "1" ? "?kiosk=1" : "";
  const legacy = legacyBelecoRedirect(
    "review", slug, origin() + "/r/" + encodeURIComponent(slug) + query,
  );
  if (legacy) redirect(legacy);
  return (
    <ReviewForm
      location={l}
      local={process.env.APP_MODE === "local"}
      turnstileSiteKey={
        process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY
          ? process.env.TURNSTILE_SITE_KEY
          : ""
      }
    />
  );
}
