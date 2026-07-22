"use client";

/** Global offline reassurance. On conference wifi dropping out, the officer sees
 *  a calm explanation, not broken UI, capture keeps working offline. */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { t, useLang } from "@/lib/i18n";

export default function OnlineBanner() {
  const [online, setOnline] = useState(true);
  const lang = useLang();

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="glass-nav flex items-center justify-center gap-2 overflow-hidden px-4 py-1.5 text-center text-sm print:hidden"
          style={{ color: "var(--warn)" }}
        >
          <WifiOff size={14} />
          {t(lang, "offline_message")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
