import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { HDReviewWordmark } from "./hd-review-wordmark";
export function Header() {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark" aria-label="HD Review home">
        <HDReviewWordmark />
      </Link>
      <nav className="topnav" aria-label="Main navigation">
        <span className="pill">
          {process.env.APP_MODE === "local" ? "LOCAL PROTOTYPE" : "BUSINESS WORKSPACE"}
        </span>
        <Link href="/dashboard">
          Business dashboard{" "}
          <ArrowUpRight size={13} style={{ verticalAlign: "middle" }} />
        </Link>
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span className="hd-footer-company">
        <img
          src="/da-smarketing-logo.svg"
          alt=""
          width={30}
          height={30}
        />
        <span>© {new Date().getFullYear()} DA Smarketing Solutions · HD Review</span>
      </span>
      <span>
        {process.env.APP_MODE === "local" ? "Fictional data · " : ""}
        Real experiences · No automatic posting · <Link href="/privacy">Privacy</Link>
      </span>
    </footer>
  );
}
