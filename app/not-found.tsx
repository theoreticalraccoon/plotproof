"use client";

import { motion } from "framer-motion";
import { Compass } from "lucide-react";

export default function NotFound() {
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
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Compass size={22} />
        </span>
        <h1 className="text-lg font-semibold">Page not found.</h1>
        <p className="text-sm muted">The page you're looking for doesn't exist or has moved.</p>
        <a href="/" className="btn btn-primary">Back to start</a>
      </motion.div>
    </main>
  );
}
