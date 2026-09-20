"use client";

/** One plot's forest check for any screen: the current result, its verdict, and a way to re-run it. */
import { useCallback, useState } from "react";
import { useSaleBook, updateSale } from "../sale/store";
import { tOr, type Lang } from "../i18n";
import { isStale, latestCheck, requestCheck, saveCheck, errorKey, type ForestCheck } from "./check";
import { screenPlot, type Verdict } from "./verdict";
import type { LngLat } from "./gfw";

export interface ForestCheckState {
  check: ForestCheck | null;
  verdict: Verdict | null;
  stale: boolean;
  busy: boolean;
  /** The error code of the last failed run, if any. */
  error: string | null;
  errorMessage: (lang: Lang) => string | null;
  run: () => Promise<void>;
}

export function useForestCheck(plot: { id: string; ring: LngLat[] }): ForestCheckState {
  const { sales } = useSaleBook();
  // Bumped after a run so the stored copy is re-read.
  const [, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = latestCheck(plot.id, sales);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestCheck(plot.ring);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      saveCheck(plot.id, result);
      // Every sale this plot is attached to carries the same check.
      for (const s of sales) {
        if (s.plotIds.includes(plot.id)) {
          updateSale(s.id, (x) => ({ ...x, eudrChecks: { ...x.eudrChecks, [plot.id]: result } }));
        }
      }
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }, [plot.id, plot.ring, sales]);

  return {
    check,
    verdict: check ? screenPlot(check.stats) : null,
    stale: check ? isStale(check, new Date()) : false,
    busy,
    error,
    errorMessage: (lang) => (error ? tOr(lang, errorKey(error), "eudr_err_upstream_failed") : null),
    run,
  };
}
