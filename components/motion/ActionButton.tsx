"use client";

/** A button that makes success and failure *visible*. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useToast } from "@/components/shell/Toast";

type Status = "idle" | "loading" | "success" | "error";

export default function ActionButton({
  onAction,
  children,
  className = "btn btn-primary",
  loadingLabel,
  successLabel,
  successToast,
  errorToast,
  disabled,
  type = "button",
  resetMs = 1600,
  style,
}: {
  onAction: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  successToast?: string;
  errorToast?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  resetMs?: number;
  /** Base styling; the success/error flash overrides it while it plays. */
  style?: React.CSSProperties;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const { toast } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const run = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try {
      await onAction();
      setStatus("success");
      if (successToast) toast(successToast, "success");
    } catch (e) {
      setStatus("error");
      toast(errorToast ?? (e instanceof Error && e.message ? e.message : "Something went wrong."), "error");
    } finally {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setStatus("idle"), resetMs);
    }
  };

  const flash: React.CSSProperties | undefined =
    status === "success"
      ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)" }
      : status === "error"
        ? { borderColor: "var(--danger)", color: "var(--danger)" }
        : undefined;

  return (
    <button
      type={type}
      onClick={run}
      disabled={disabled || status === "loading"}
      className={className}
      style={{ ...style, ...flash }}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "loading" ? (
          <motion.span key="l" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <span className="spinner" aria-hidden="true" /> {loadingLabel ?? children}
          </motion.span>
        ) : status === "success" ? (
          <motion.span key="s" className="inline-flex items-center gap-2" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
            <Check size={16} strokeWidth={2.5} /> {successLabel ?? children}
          </motion.span>
        ) : status === "error" ? (
          <motion.span key="e" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -4, 4, -3, 3, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <X size={16} strokeWidth={2.5} /> {children}
          </motion.span>
        ) : (
          <motion.span key="i" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
