"use client";

// Tiny language store: localStorage-persisted, hydration-safe (server snapshot is always "en"),
// shared across every component via useSyncExternalStore, no provider wiring.
import { useSyncExternalStore } from "react";
import type { Lang } from "./strings";
import { readText, writeText } from "../device/local";

export { LANGS, t, tOr, type Lang } from "./strings";

const KEY = "plotproof.lang";
const listeners = new Set<() => void>();

function snapshot(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const v = readText(KEY);
  return v === "si" || v === "ta" ? v : "en";
}

export function setLang(lang: Lang): void {
  writeText(KEY, lang);
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
