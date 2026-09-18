# The ML in PlotProof

> This file previously held the build prompt for an in-house satellite
> deforestation service. That service was deleted on 2026-07-27 because it could
> not be trained or validated honestly by one developer (see `PARKED.md`). This
> is what actually exists now.

Four components, three of which ship today. Every one follows the same contract:

**a script produces a static artifact → a typed loader reads it → the UI renders
it, or renders nothing.** No inference server, no ML API routes, no Python in
production. `app/api/` contains exactly one route (`health`).

---

## 1. Tea leaf condition classifier — `ml/tea/`

A MobileNetV3-Small CNN that runs **in the browser** on a photo of a leaf.

| | |
|---|---|
| Artifact | `public/models/tea-disease-mnv3s.onnx` (6.08 MB) + `-card.json` |
| Classes | healthy, blister blight, brown blight, red rust, red spider mite, tea mosquito bug |
| Training data | CS-D (Assam), CC BY 4.0 — 9,000 photographs, group-held-out split |
| Status | Trained and evaluated. **Not yet wired into the UI.** |

The headline result is a gap, not a number:

| Test set | Accuracy | Macro-F1 | ECE |
|---|---:|---:|---:|
| CS-D internal (in-distribution) | 0.9975 | 0.9975 | 0.0006 |
| EWU cross-dataset (detached leaf) | 0.7061 | 0.7346 | 0.1972 |
| TLD-BD cross-dataset (field) | 0.6999 | 0.7959 | 0.2447 |

99.75% on data like its training set; ~70% on a farm it has never seen. The
three are never averaged — they measure different things. Published tea-disease
papers report the first number and stop.

Because the model stays confident while becoming wrong across a domain shift, it
**abstains**: below a confidence of 0.9976 the answer is "uncertain — retake the
photo". On the EWU set that declines 65% of inputs and lifts accuracy on the rest
from 0.706 to 0.957.

**No cross-dataset evidence exists for blister blight or red rust.** Neither
appears in any external dataset in the audited corpus. Blister blight is
simultaneously the most important class in the product and the least verifiable.

Full detail: `ml/tea/README.md`, `models/tea/evaluation.json`,
`models/tea/dataset-audit.md`.

---

## 2. Disease infection-risk engine — `lib/grow/risk.ts`

Not a learned model, and deliberately so. Weather-driven infection pressure for
three tea pathogens, computed from published epidemiology: leaf wetness duration,
temperature window, humidity, sunshine hours, with persistence required so one
wet day cannot raise an alarm.

This is the half of the disease system with **no transfer gap**. The CNN is
trained on Assam imagery and is uncertain in Sri Lanka; this is computed from the
plot's own weather and is exactly as valid anywhere. That asymmetry is the whole
argument for fusing them rather than shipping the classifier alone — the
locally-grounded evidence stabilises the transferred visual evidence.

Its decision logic lives outside any model on purpose: it is the part an
agronomist will question, so it has to be readable rather than buried in weights.

---

## 3. FAO-56 water balance — `lib/grow/irrigation.ts`

Also not learned. The FAO Irrigation & Drainage Paper 56 procedure implemented
directly, with every constant traceable to one of its tables. A farmer acting on
a watering instruction deserves arithmetic they could check.

The interesting part is the **anchoring ladder**: sensor > grid > balance. An
observation of the soil state beats an integration toward it, because a running
balance accumulates every coefficient error and never forgets it. The UI names
which tier produced the answer.

**The top tier is now reachable, and untested against hardware.** `/grow/sensor`
opens the USB port with Web Serial, parses the board's JSON frames, applies a
two-point air/water calibration and writes readings that the ladder then prefers
over the grid estimate. The parser and the calibration arithmetic are unit-tested;
the serial path and the ESP32 sketch have never been run against a real Magicbit.

Two honesty constraints ride with it. The calibration is a FIELD calibration —
air and water remove the probe's arbitrary ADC scale, but a water content
accurate for a specific soil needs oven-dried gravimetric samples, and the UI
says so. And because Web Serial is Chromium-desktop-only, a labelled simulator
exists for demonstrations; every reading it produces is stored with
`source: "simulated"` so the label survives the screen that produced it.

---

## 4. Price intelligence — `ml/prices/`

Walk-forward backtest of five forecasters on the World Bank Pink Sheet,
shipped as `public/models/prices.json`. The model card prints the chosen model's
backtest error **next to the naive baseline's**, so a random walk can never be
dressed up as AI.

---

## Rules that apply to all of them

1. **Licence before training.** Verified at the original repository record, never
   a mirror or a search summary. `models/tea/provenance.json`. The acoustic model
   was built on ESC-50 and only afterwards found to be CC BY-NC, which made the
   weights unshippable and the work dead.
2. **Split by source, never by image.** Every public plant-disease dataset ships
   augmented copies of a smaller set of photographs, and several ship a split
   that does not respect that. Splitting on images produces memorisation wearing
   a generalisation label.
3. **Report the baseline next to the number.** A metric without its baseline is
   not a result.
4. **Test sets are touched once**, after the model is frozen. Selection,
   calibration and thresholds come from validation only.
5. **No artifact → render nothing.** Never a placeholder, never a guess.
6. **Facts live in the artifact, not the UI.** Classes, preprocessing constants,
   thresholds, metrics and caveats are data, so correcting a caveat is a JSON
   edit rather than a component change.

## What is deliberately not here

- **A satellite deforestation model.** Deleted 2026-07-27; could not be trained
  or validated honestly by one developer. EUDR context now cites JRC TMF and
  Global Forest Watch instead of inventing a verdict.
- **An acoustic chainsaw classifier.** Deleted 2026-09-16. Its ingest routes had
  already gone with the watchdog layers, the hardware never existed, and ESC-50's
  CC BY-NC licence blocked shipping the weights regardless.
