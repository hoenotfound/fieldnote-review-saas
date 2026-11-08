import Link from "next/link";
import { Header } from "@/components/chrome";
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="page">
        <h1>This page is unavailable.</h1>
        <p style={{ margin: "20px 0" }}>
          Check the location link or contact the business.
        </p>
        <Link href="/" className="btn">
          Back to home
        </Link>
      </main>
    </>
  );
}
