"use client";

/** A thin accent bar pinned to the very top that fills as the page scrolls -
 *  a quiet, modern orientation cue on long pages. Spring-smoothed; hidden when
 *  reduced-motion is on (it would otherwise jump). */
import { motion, useScroll, useSpring, useReducedMotion } from "framer-motion";

export default function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left print:hidden"
      style={{ scaleX, background: "var(--accent)" }}
    />
  );
}
