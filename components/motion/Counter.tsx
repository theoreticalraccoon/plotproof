"use client";

/** Count-up number, plays once when scrolled into view. Degrades to a static
 *  render under prefers-reduced-motion. */
import { motion, useInView, useMotionValue, useTransform, useReducedMotion, animate } from "framer-motion";
import { useEffect, useRef } from "react";

export default function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const count = useMotionValue(reduce ? to : 0);
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(count, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [inView, reduce, to, count]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
