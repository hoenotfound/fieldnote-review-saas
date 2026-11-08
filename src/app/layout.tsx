import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fieldnote · A little help with your words",
  description:
    "Independent writing assistant for genuine customer experiences.",
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
