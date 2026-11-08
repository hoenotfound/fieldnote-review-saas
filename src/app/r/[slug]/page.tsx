import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/review-form";
import { publicLocation } from "@/lib/reviews";
export const dynamic = "force-dynamic";
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const l = await publicLocation((await params).slug);
  if (!l) notFound();
  return <ReviewForm location={l} local={process.env.APP_MODE === "local"} />;
}
