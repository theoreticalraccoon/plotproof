"use client";

/** One leaf diagnosis for one plot: the model card, the photo run, the advisory and ?diag=1. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODEL_URL, loadTeaCard } from "./card";
import { classifyLeaf } from "./infer";
import { buildAdvisory } from "./evidence";
import {
  buildDiagnosticRows,
  diagnosticsEnabled,
  verifyPublishedModel,
  type ArtifactCheck,
  type RuntimeFacts,
} from "./diagnostics";
import type { TeaAdvisory, TeaModelCard, TeaPrediction } from "./types";
import type { GrowData } from "../useGrowPlot";

export interface LeafDiagnosis {
  /** "loading" until the card is read; null when no usable card is published. */
  card: TeaModelCard | null | "loading";
  busy: boolean;
  prediction: TeaPrediction | null;
  advisory: TeaAdvisory | null;
  analyse: (img: HTMLImageElement) => Promise<void>;
  fail: (reason: "bad_image") => void;
  reset: () => void;
  diag: { enabled: boolean; rows: ReturnType<typeof buildDiagnosticRows>; failures: number };
}

interface Result {
  plotId: string;
  prediction: TeaPrediction;
  runtime: RuntimeFacts | null;
}

export function useLeafDiagnosis(plotId: string | null, grow: GrowData): LeafDiagnosis {
  const [card, setCard] = useState<TeaModelCard | null | "loading">("loading");
  const [result, setResult] = useState<Result | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [diagOn, setDiagOn] = useState(false);
  const [artifact, setArtifact] = useState<ArtifactCheck | null>(null);
  // The plot a photo is being analysed for; a result for any other plot is dropped.
  const current = useRef(plotId);
  current.current = plotId;

  useEffect(() => {
    void loadTeaCard().then(setCard);
    setDiagOn(diagnosticsEnabled(window.location.search));
  }, []);

  // Hash the bytes the browser actually received and compare them to the card.
  useEffect(() => {
    if (!diagOn || !card || card === "loading") return;
    void verifyPublishedModel(MODEL_URL, card).then(setArtifact);
  }, [diagOn, card]);

  const analyse = useCallback(async (img: HTMLImageElement) => {
    const forPlot = current.current;
    if (!forPlot) return;
    setBusyFor(forPlot);
    setResult(null);
    try {
      const { prediction, runtime } = await classifyLeaf(img);
      if (current.current === forPlot) setResult({ plotId: forPlot, prediction, runtime });
    } finally {
      setBusyFor((b) => (b === forPlot ? null : b));
    }
  }, []);

  const fail = useCallback((reason: "bad_image") => {
    const forPlot = current.current;
    if (forPlot) setResult({ plotId: forPlot, prediction: { state: "error", reason }, runtime: null });
  }, []);

  const reset = useCallback(() => setResult(null), []);

  // A leaf result belongs to the plot it was taken for.
  const mine = result && result.plotId === plotId ? result : null;
  const prediction = mine?.prediction ?? null;
  const busy = !!plotId && busyFor === plotId;

  const { state, risks, irrigation, observedThrough } = grow;
  const advisory = useMemo(() => {
    if (!prediction) return null;
    // Only weather that has actually loaded for this plot may explain the leaf result.
    const ready = state === "ready";
    return buildAdvisory({
      prediction,
      risks: ready ? risks : [],
      irrigation: ready ? irrigation : null,
      observedThrough: ready ? observedThrough : null,
    });
  }, [prediction, state, risks, irrigation, observedThrough]);

  const rows = useMemo(
    () => (diagOn ? buildDiagnosticRows(card === "loading" ? null : card, prediction, mine?.runtime ?? null, artifact) : []),
    [diagOn, card, prediction, mine?.runtime, artifact],
  );

  return {
    card,
    busy,
    prediction,
    advisory,
    analyse,
    fail,
    reset,
    diag: { enabled: diagOn, rows, failures: rows.filter((r) => r.ok === false).length },
  };
}
