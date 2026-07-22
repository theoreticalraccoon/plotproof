"use client";

/**
 * Scroll-triggered reveal, the Framer Motion equivalent of the skill's GSAP
 * ScrollTrigger reveal preset: fade + small rise, plays once, degrades to a
 * plain instant-visible render under prefers-reduced-motion.
 */
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { revealUpDelayed, revealFadeDelayed } from "@/lib/motion/variants";

export default function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "fade";
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={variant === "up" ? revealUpDelayed(delay) : revealFadeDelayed(delay)}
    >
      {children}
    </motion.div>
  );
}
