import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { spendingSummary } from "@/lib/spending";
import { getAuth } from "@/lib/auth";
import { Header } from "@/components/chrome";
import { SignOut } from "@/components/auth-controls";
import {
  BrandingForm,
  LogoForm,
  QuestionnaireForm,
  LocationForm,
  type Business,
  type Location,
} from "@/components/manage-forms";
export const dynamic = "force-dynamic";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const session = await (
    await getAuth()
  ).api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const businesses = await rows<Business>(
    sql`select b.*,bl.version logo_version from business b join membership m on m.business_id=b.id left join business_logo bl on bl.business_id=b.id where m.user_id=${session.user.id} order by b.name`,
  );
  const admin =
    (
      await rows(
        sql`select 1 from platform_admin where user_id=${session.user.id}`,
      )
    ).length > 0;
  if (!businesses.length) {
    if (admin) redirect("/platform");
    return (
      <>
        <Header />
        <main className="page">
          <h1>No business access.</h1>
          <p>Ask the platform operator to assign your account.</p>
          <SignOut />
        </main>
      </>
    );
  }
  const selected = (await searchParams).business;
  const b = businesses.find((x) => x.id === selected) || businesses[0];
  const locations = await rows<Location>(
    sql`select * from location where business_id=${b.id} order by name`,
  );
  const spending = await spendingSummary(b.id);
  const bs = { ...b, expires_at: new Date(b.expires_at).toISOString() };
  return (
    <>
      <Header />
      <div className="dashboard">
        <aside className="sidebar">
          <div className="label">YOUR WORKSPACE</div>
          {businesses.map((x) => (
            <Link
              className={x.id === b.id ? "active" : ""}
              key={x.id}
              href={"/dashboard?business=" + encodeURIComponent(x.id)}
            >
              {x.name}
            </Link>
          ))}
          {admin && <Link href="/platform">Platform admin</Link>}
          <Link href="/">Customer demo</Link>
          <SignOut />
        </aside>
        <main className="main">
          <div className="eyebrow">BUSINESS OVERVIEW</div>
          <h1>{b.name}</h1>
          <p className="subtitle">
            Your locations, your branding. One simple place to manage both.
          </p>
          <div className="stats">
            <div className="card stat">
              <p>Locations</p>
              <strong>{locations.length}</strong>
            </div>
            <div className="card stat">
              <p>Drafts used</p>
              <strong>
                {b.used}
                <span style={{ fontSize: 16, color: "var(--muted)" }}>
                  {" "}
                  / {b.allowance}
                </span>
              </strong>
            </div>
            <div className="card stat">
              <p>AI access through</p>
              <strong style={{ fontSize: 23 }}>
                {new Date(b.expires_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </strong>
            </div>
          </div>
          <section className="card">
            <h3>Private spending insights</h3>
            <p className="subtitle">
              Optional, self-reported amounts from successful AI drafts and manually
              shared spending reports. Only the latest submission per customer session
              counts, including cleared amounts. These are estimates, not revenue.
              Individual amounts are never shown.
            </p>
            <div className="stats">
              {locations.map((location) => {
                const summary = spending.find((x) => x.location_id === location.id);
                return (
                  <div className="card stat" key={location.id}>
                    <p>{location.name}</p>
                    <strong>{summary ? "RM " + Number(summary.avg_rm).toFixed(2) : "No data"}</strong>
                    <small>{summary ? summary.responses + " reported sessions · average amount" : "No sessions with a reported amount"}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card">
            <h3>Business branding</h3>
            <BrandingForm key={b.id} business={bs} />
            <LogoForm key={b.id} business={bs} />
          </section>
          <section className="card">
            <h3>Customer questionnaire</h3>
            <QuestionnaireForm key={b.id} business={bs} />
          </section>
          <section>
            <div className="section-head">
              <h2>Your locations</h2>
              <small>QR links stay stable when you rename a location.</small>
            </div>
            <div className="grid">
              {locations.map((l) => (
                <article className="card" key={l.id}>
                  <LocationForm businessId={b.id} location={l} />
                  <div className="qr-row">
                    <img
                      src={"/api/qr/" + l.id}
                      className="qr"
                      alt={"QR for " + l.name}
                    />
                    <div>
                      <Link href={"/r/" + l.slug}>Open customer page ↗</Link>
                      <br />
                      <a href={"/api/qr/" + l.id + "?download=1"} download>
                        Download QR code
                      </a>
                    </div>
                  </div>
                </article>
              ))}
              <article className="card">
                <h3>Add another location</h3>
                <LocationForm businessId={b.id} />
              </article>
            </div>
          </section>
          <div className="notice">
            Usage counts completed drafts, including clearly labelled demo
            generations. No customer draft text is shown here. Access and
            allowances are managed by the platform operator.
          </div>
        </main>
      </div>
    </>
  );
}
