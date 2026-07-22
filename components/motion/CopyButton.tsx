"use client";

/** Copy-to-clipboard with a satisfying success swap (icon + label flip to the
 *  accent for ~1.5s). A small, common "did it work?" reassurance. */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/shell/Toast";

export default function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  toastMsg,
  className = "",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  toastMsg?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (toastMsg) toast(toastMsg, "success");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy to clipboard", "error");
    }
  };

  return (
    <button
      onClick={copy}
      aria-label={copied ? copiedLabel : label}
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${className}`}
      style={{ color: copied ? "var(--accent)" : "var(--fg-faint)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="c" className="inline-flex items-center gap-1" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Check size={13} strokeWidth={2.5} /> {copiedLabel}
          </motion.span>
        ) : (
          <motion.span key="i" className="inline-flex items-center gap-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <Copy size={13} /> {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
