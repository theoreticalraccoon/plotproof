/**
 * Shared Framer Motion variants/transitions. Values mirror the ui-ux-pro-max
 * skill's GSAP motion presets (.claude/skills/ui-ux-pro-max/data/motion.csv)
 * translated to Framer Motion's transition shape, so the "GSAP-caliber" timing
 * table (duration/easing per intensity tier) is the actual source of truth,
 * not eyeballed values.
 *
 *   Scroll Reveal (Standard): 400-600ms, power2.out, y:24 → EASE_OUT / durations.base
 *   Stagger List (Subtle):    250-350ms, power1.out, stagger 0.03 → STAGGER_CONTAINER
 *   Hover (Standard):         200-300ms, power2.out, y:-4 scale:1.02 → HOVER_LIFT
 */
import type { Transition, Variants } from "framer-motion";

// power1.out / power2.out approximated as cubic-bezier, matching app/globals.css
export const EASE_OUT_1: Transition["ease"] = [0.25, 0.46, 0.45, 0.94];
export const EASE_OUT_2: Transition["ease"] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: Transition["ease"] = [0.65, 0, 0.35, 1];

export const durations = { fast: 0.15, base: 0.25, slow: 0.45, page: 0.35 };

/** Scroll-triggered fade+rise for sections (skill: Scroll Reveal / Standard tier). */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: EASE_OUT_2 } },
};

/** Smaller, faster variant for inline elements (skill: Scroll Reveal / Subtle tier). */
export const revealUpSm: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: durations.base, ease: EASE_OUT_1 } },
};

export const revealFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.slow, ease: EASE_OUT_1 } },
};

/** Same as revealUp/revealFade but with an explicit start delay. Framer Motion's
 *  per-variant transition takes precedence over a component-level `transition`
 *  prop, so a delay must be baked into the variant itself rather than passed
 *  alongside, this keeps that intentional instead of relying on merge order. */
export function revealUpDelayed(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: durations.slow, ease: EASE_OUT_2, delay } },
  };
}
export function revealFadeDelayed(delay: number): Variants {
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: durations.slow, ease: EASE_OUT_1, delay } },
  };
}

/** Parent container for staggered children (skill: Stagger List / Subtle tier). */
export const staggerContainer = (staggerChildren = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: durations.base, ease: EASE_OUT_2 } },
};

/** Card hover lift (skill: Hover Micro-interaction / Standard tier). Displacement
 *  kept small per the skill's "Don't" note so it reads as feedback, not motion. */
export const hoverLift = {
  whileHover: { y: -4, scale: 1.015, transition: { duration: durations.base, ease: EASE_OUT_2 } },
  whileTap: { scale: 0.98, transition: { duration: durations.fast } },
};

/** Subtle press-only feedback for buttons/pills (skill: Hover / Subtle tier). */
export const pressFeedback = {
  whileTap: { scale: 0.96, transition: { duration: durations.fast } },
};

/** Page transition (Next.js App Router route change). Kept to a plain
 *  fade+small-rise, the skill's Flip-based page transition needs the GSAP
 *  Flip club plugin, which this project doesn't license; this is the
 *  documented plain fallback. */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: durations.page, ease: EASE_OUT_2 } },
  exit: { opacity: 0, y: -8, transition: { duration: durations.page * 0.7, ease: EASE_OUT_1 } },
};

/** In-page step change (wizard steps, tab panels), smaller/faster than a
 *  full route transition since nothing is navigating, just swapping content. */
export const stepTransition: Variants = {
  initial: { opacity: 0, x: 12 },
  enter: { opacity: 1, x: 0, transition: { duration: durations.base, ease: EASE_OUT_2 } },
  exit: { opacity: 0, x: -12, transition: { duration: durations.fast, ease: EASE_OUT_1 } },
};

/** Mobile nav drawer slide-in. */
export const drawerSlide: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { duration: durations.slow, ease: EASE_OUT_2 } },
  exit: { x: "100%", transition: { duration: durations.base, ease: EASE_IN_OUT } },
};

export const backdropFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.base } },
  exit: { opacity: 0, transition: { duration: durations.base } },
};

/** An element whose value is awaiting an async result. A slow opacity breath,
 *  NOT a progress indicator: it says "still working" without implying how far
 *  along the work is, which is the only honest thing to say when we do not
 *  know. Pair with the .is-pending utility for the cursor/dim treatment. */
export const pendingPulse: Variants = {
  idle: { opacity: 1, transition: { duration: durations.base, ease: EASE_OUT_1 } },
  pending: {
    opacity: [1, 0.55, 1],
    transition: { duration: 1.4, ease: EASE_IN_OUT, repeat: Infinity },
  },
};

/** Skeleton → content handoff. The skeleton leaves faster than the content
 *  arrives, so the two overlap and the reader never sees a bare gap where the
 *  placeholder used to be. Use as `exit` on the skeleton and `show` on the
 *  content inside one <AnimatePresence mode="popLayout">. */
export const skeletonFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.base, ease: EASE_OUT_1 } },
  exit: { opacity: 0, transition: { duration: durations.fast, ease: EASE_OUT_1 } },
};

/** An inline spinner or status glyph appearing beside a label. Scales in from
 *  slightly small so it reads as arriving rather than blinking on. */
export const inlineStatusIn: Variants = {
  hidden: { opacity: 0, scale: 0.7 },
  show: { opacity: 1, scale: 1, transition: { duration: durations.fast, ease: EASE_OUT_2 } },
  exit: { opacity: 0, scale: 0.7, transition: { duration: durations.fast, ease: EASE_OUT_1 } },
};
