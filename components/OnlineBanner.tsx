"use client";

/** Global offline reassurance. On conference wifi dropping out, the officer sees
 *  a calm explanation, not broken UI — capture keeps working offline. */
import { useEffect, useState } from "react";

export default function OnlineBanner() {
  const [online, setOnline] = useState(true);

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

  if (online) return null;
  return (
    <div className="bg-amber-500 px-4 py-1 text-center text-sm text-white">
      Offline — your work is saved on this device and will sync when you reconnect.
    </div>
  );
}
