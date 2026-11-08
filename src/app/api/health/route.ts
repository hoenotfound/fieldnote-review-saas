// Liveness only. Avoid keeping Neon awake with health-check database polling.
export function GET() {
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
