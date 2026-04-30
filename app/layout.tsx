import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Repair App V1",
  description: "Damaged goods repair workflow",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
