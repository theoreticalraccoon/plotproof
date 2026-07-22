"use client";

/**
 * Tiny language store: localStorage-persisted, hydration-safe (server snapshot is
 * always "en"), shared across every component via useSyncExternalStore, no
 * provider wiring, so any client component can call useLang().
 */
import { useSyncExternalStore } from "react";
import type { Lang } from "./strings";

export { LANGS, t, type Lang } from "./strings";

const KEY = "plotproof.lang";
const listeners = new Set<() => void>();

function snapshot(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const v = localStorage.getItem(KEY);
  return v === "si" || v === "ta" ? v : "en";
}

export function setLang(lang: Lang): void {
  localStorage.setItem(KEY, lang);
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => "en",
  );
}
