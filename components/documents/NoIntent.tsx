"use client";

/** Shared empty state for the document generators when no sale intent is saved
 *  yet, sends the farmer back to the /sell wizard that seeds it. */
import Link from "next/link";

export default function NoIntent() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="glass-card w-full p-8">
        <p className="muted text-sm">No sale details yet.</p>
        <Link href="/sell" className="btn btn-primary mt-4">
          Start with “Sell your harvest”
        </Link>
      </div>
    </main>
  );
}
