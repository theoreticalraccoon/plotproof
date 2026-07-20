import type { Metadata } from "next";
import "./globals.css";
import OnlineBanner from "@/components/OnlineBanner";

export const metadata: Metadata = {
  title: "PlotProof — sell your harvest abroad, legally",
  description:
    "Helps farmers export directly to the EU, UK and US: the exact certifications and customs documents they need, generated where possible.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // lang is a placeholder; interface strings are externalised (see PROJECT.md).
  return (
    <html lang="en">
      <body className="antialiased">
        <OnlineBanner />
        {children}
      </body>
    </html>
  );
}
