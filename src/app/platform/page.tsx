import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { getAuth } from "@/lib/auth";
import { Header } from "@/components/chrome";
import { SignOut } from "@/components/auth-controls";
import {
  SubscriptionForm,
  NewBusiness,
  type Business,
} from "@/components/manage-forms";
export const dynamic = "force-dynamic";
export default async function Platform() {
  const session = await (
    await getAuth()
  ).api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (
    !(
      await rows(
        sql`select 1 from platform_admin where user_id=${session.user.id}`,
      )
    ).length
  )
    notFound();
  const businesses = await rows<Business>(
    sql`select * from business order by name`,
  );
  const attempts =
    (
      await rows<{ attempts: number }>(
        sql`select attempts from ai_daily_budget where day=current_date`,
      )
    )[0]?.attempts || 0;
  const failed =
    (
      await rows<{ count: string }>(
        sql`select count(*) from generation where state='failed' and created_at>now()-interval '1 day'`,
      )
    )[0]?.count || "0";
  return (
    <>
      <Header />
      <div className="dashboard">
        <aside className="sidebar">
          <div className="label">PLATFORM</div>
          <Link href="/platform" className="active">
            Businesses & access
          </Link>
          <Link href="/dashboard">Business workspace</Link>
          <Link href="/">Customer demo</Link>
          <SignOut />
        </aside>
        <main className="main">
          <div className="eyebrow">PLATFORM OPERATIONS</div>
          <h1>A small, clear control room.</h1>
          <p className="subtitle">
            Manage access manually while the product finds its feet.
          </p>
          <div className="stats">
            <div className="card stat">
              <p>Businesses</p>
              <strong>{businesses.length}</strong>
            </div>
            <div className="card stat">
              <p>Attempts today (UTC)</p>
              <strong>{attempts}</strong>
            </div>
            <div className="card stat">
              <p>Failed in 24 hours</p>
              <strong>{failed}</strong>
            </div>
          </div>
          <div className="admin-list">
            {businesses.map((b) => (
              <section className="card" key={b.id} style={{ margin: 0 }}>
                <div className="admin-head">
                  <div>
                    <h3>{b.name}</h3>
                    <p>{b.id}</p>
                  </div>
                  <span className="pill">
                    {b.active ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                <div className="statbar">
                  <span>{b.used} drafts used</span>
                  <span>{b.reserved} in flight</span>
                  <span>{b.allowance} allowed</span>
                </div>
                <SubscriptionForm
                  business={{
                    ...b,
                    expires_at: new Date(b.expires_at).toISOString(),
                  }}
                />
              </section>
            ))}
          </div>
          <section className="card">
            <h3>Create a business</h3>
            <NewBusiness />
          </section>
          <div className="notice">
            No automated payments. No impersonation or customer-draft browsing.
            Changes are logged. Operator MFA and account-recovery setup remain
            pilot release requirements.
          </div>
        </main>
      </div>
    </>
  );
}
