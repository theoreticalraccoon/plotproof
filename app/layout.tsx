import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import OnlineBanner from "@/components/OnlineBanner";
import AppShell from "@/components/shell/AppShell";

// Signature pairing, self-served by Next (no runtime CDN request). Neither is Inter:
//   Fraunces      , warm high-contrast optical serif; large display headings
//                    ONLY, for a memorable, premium, craft-forward voice.
//   Hanken Grotesk, high legibility at small sizes; body, UI, small headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-fraunces",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PlotProof, sell your harvest abroad, legally",
  description:
    "Helps farmers export directly to the EU, UK and US: the exact certifications and customs documents they need, generated where possible.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // lang is a placeholder; interface strings are externalised (see PROJECT.md).
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="antialiased">
        <OnlineBanner />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
