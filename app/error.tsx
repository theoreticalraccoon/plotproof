"use client";

// Route-level error boundary, turns any thrown render/data error into an explainable card with
// a retry, instead of a blank screen or a stack trace.
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card flex flex-col items-center gap-4 p-8"
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <AlertTriangle size={22} />
        </span>
        <h1 className="text-lg font-semibold">Something went wrong on this screen.</h1>
        <p className="text-sm muted">
          Your captured plots are saved on this device and are safe. You can retry, or
          go back to the start.
        </p>
        <div className="flex gap-2">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <a href="/" className="btn btn-ghost">Home</a>
        </div>
      </motion.div>
    </main>
  );
}
