"use client";

/**
 * Scroll-driven word reveal, adapted from 21st.dev / MagicUI "Text Reveal"
 * (dillionverma). As the pinned section scrolls, each word fades from faint to
 * full, so a statement "reads itself", the Linear/Vercel signature scroll beat.
 *
 * Adapted to PlotProof: rendered in the memorable Fraunces display face, tokened
 * colors (no hardcoded black/white), a single accent word for emphasis, and a
 * prefers-reduced-motion fallback that just shows the finished sentence.
 * (Also fixes the source's duplicate ref bug, the scroll target is the outer
 * container only.)
 */
import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";

export default function ScrollReveal({
  text,
  accentWords = [],
  className = "",
}: {
  text: string;
  accentWords?: string[];
  className?: string;
}) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start 0.9", "start 0.25"],
  });
  const words = text.split(" ");
  const accentSet = new Set(accentWords.map((w) => w.toLowerCase().replace(/[.,]/g, "")));

  if (reduce) {
    return (
      <div className={`mx-auto max-w-4xl px-5 py-24 sm:px-8 ${className}`}>
        <p className="font-display text-2xl leading-snug sm:text-3xl lg:text-4xl">{text}</p>
      </div>
    );
  }

  return (
    <div ref={targetRef} className={`relative mx-auto max-w-4xl px-5 py-24 sm:px-8 ${className}`}>
      <p className="font-display flex flex-wrap text-[1.7rem] leading-[1.25] sm:text-4xl lg:text-[3rem]">
        {words.map((word, i) => {
          const start = i / words.length;
          const end = start + 1 / words.length;
          const clean = word.toLowerCase().replace(/[.,]/g, "");
          return (
            <Word key={i} progress={scrollYProgress} range={[start, end]} accent={accentSet.has(clean)}>
              {word}
            </Word>
          );
        })}
      </p>
    </div>
  );
}

function Word({
  children,
  progress,
  range,
  accent,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  accent: boolean;
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <span className="relative mx-[0.28rem] my-[0.12em] lg:mx-2">
      <span className="absolute inset-0" style={{ color: "var(--fg)", opacity: 0.12 }} aria-hidden="true">
        {children}
      </span>
      <motion.span style={{ opacity, color: accent ? "var(--accent)" : "var(--fg)" }}>
        {children}
      </motion.span>
    </span>
  );
}
