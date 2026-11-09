import Link from "next/link";
import { ArrowRight, Quote, Feather } from "lucide-react";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { Header, Footer } from "@/components/chrome";
export const dynamic = "force-dynamic";
export default async function Home() {
  const isLocal = process.env.APP_MODE === "local";
  const locations = isLocal
    ? await rows<{
        slug: string;
        name: string;
        business_name: string;
        accent: string;
        initials: string;
      }>(
        sql`select l.slug,l.name,b.name business_name,b.accent,b.initials from location l join business b on b.id=l.business_id where l.active and b.active order by b.name,l.name`,
      )
    : [];
  return (
    <>
      <Header />
      <main className="page">
        <section className="hero">
          <div>
            <div className="eyebrow">A LITTLE HELP WITH THE WORDS</div>
            <h1>
              Real experiences.
              <br />
              Thoughtfully written.
            </h1>
            <p>
              A simple way to turn your visit into a review that sounds like
              you. Write, refine, and share when you’re ready.
            </p>
            <div className="actions" style={{ marginTop: 28 }}>
              {isLocal ? (
                <>
                  <a href="#locations" className="btn">
                    Explore the demo <ArrowRight />
                  </a>
                  <Link href="/login" className="btn secondary">
                    Business sign in
                  </Link>
                </>
              ) : (
                <Link href="/login" className="btn">
                  Business sign in <ArrowRight />
                </Link>
              )}
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="note">
              <Quote size={26} strokeWidth={1.3} />
              <p>
                “The food was lovely.
                <br />
                The wait was a little long.
                <br />
                Both belong in my review.”
              </p>
              <div className="rule" />
              <small>
                <Feather size={14} style={{ verticalAlign: "middle" }} /> YOUR
                EXPERIENCE COMES FIRST
              </small>
            </div>
          </div>
        </section>
        {isLocal ? (
          <section id="locations">
            <div className="section-head">
              <h2>Choose a demo location</h2>
              <small>Two fictional businesses. Three distinct locations.</small>
            </div>
            <div className="grid">
              {locations.map((l) => (
                <Link
                  className="card location-card"
                  key={l.slug}
                  href={"/r/" + l.slug}
                  style={{ "--accent": l.accent } as React.CSSProperties}
                >
                  <span className="brand-icon">{l.initials}</span>
                  <h3>{l.business_name}</h3>
                  <p>{l.name} · Fictional location</p>
                  <span className="card-link">
                    Write about your visit <ArrowRight size={17} />
                  </span>
                </Link>
              ))}
            </div>
            <div className="notice">
              This local prototype uses simulated generation. It returns your own
              words unchanged and makes no paid AI calls. Business settings,
              sign-in, QR codes and usage tracking use a real local database.
            </div>
          </section>
        ) : (
          <section>
            <div className="section-head">
              <h2>Sharing an experience?</h2>
              <small>
                Open the location link or scan the QR code provided by the business.
              </small>
            </div>
            <p>
              Each participating location has its own private link. Nothing is
              posted automatically.
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
