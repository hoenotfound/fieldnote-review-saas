import Link from "next/link";
import { Feather, ArrowUpRight } from "lucide-react";
export function Header() {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        <Feather strokeWidth={1.5} />
        fieldnote<span style={{ color: "#8fa279" }}>.</span>
      </Link>
      <nav className="topnav">
        <span className="pill">
          {process.env.APP_MODE === "local"
            ? "LOCAL PROTOTYPE"
            : "BUSINESS WORKSPACE"}
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
      <span>fieldnote. &nbsp; Real experiences. Your words.</span>
      <span>
        {process.env.APP_MODE === "local" ? "Fictional data · " : ""}No
        automatic posting · Independent project
      </span>
    </footer>
  );
}
