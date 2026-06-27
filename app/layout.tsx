import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parallax Watchtower",
  description: "Real-time signal atlas and OSINT field ledger."
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
