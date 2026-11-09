import type { Metadata } from "next";
import "./globals.css";
import "./customer-review.css";
export const metadata: Metadata = {
  title: "HD Review | Real experiences. Easy to share.",
  description:
    "HD Review by DA Smarketing Solutions helps customers write and share authentic, editable review drafts for Google Reviews and Xiaohongshu.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
