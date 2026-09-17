# Browser smoke test — the last release gate for the tea classifier

**Status: NOT PASSED.** Nothing in this repository has yet observed
`classifyLeaf` → `onnxruntime-web` execute in a browser. This document exists so
that a human can close that gate, and records why the gate cannot be closed any
other way.

What is already verified, and why none of it counts:

| Already verified | Why it is not the gate |
| --- | --- |
| `public/models/*` serve 200 | A stale service worker, a proxy or a cached deploy also serve 200 |
| `ml/tea/smoke_infer.py` runs the published `.onnx` | That is onnxruntime **for Python**, a different runtime and a different build |
| 178 unit tests pass | They exercise the pure functions either side of the session, not the session |
| `ml/tea/check_ts_parity.py` passes (37/37 confident at n=40) | It proves the two preprocessing implementations agree; it still runs the ONNX in Python |
| `scripts/audit_release.py` passes | It proves the card, the artifact and the docs agree; it never touches a browser |

The untested span is exactly: **WASM instantiation → `InferenceSession.create`
→ `session.run`** on a real device. Everything before and after it is covered.

---

## 1. The production path, traced

One implementation. There is no browser-only variant of anything below; the
`?diag=1` panel added for this test reads results, it does not compute them.

| Step | Code | Source of its constants |
| --- | --- | --- |
| Route | [app/grow/diagnose/page.tsx](app/grow/diagnose/page.tsx) — field status, leaf, conditions, why, what to do | — |
| Card fetch | [card.ts:`loadTeaCard`](lib/grow/tea/card.ts) → `CARD_URL = /models/tea-disease-mnv3s-card.json` | the published card |
| Card validation | [card.ts:`isUsable`](lib/grow/tea/card.ts) | rejects a card missing/degenerate in threshold, temperature, mean/std, or class order |
| Crop gate | [page.tsx](app/grow/diagnose/page.tsx) — `LeafCapture` rendered only when `profile.crop === "tea"` | Dexie grow profile |
| Image decode | [LeafCapture.tsx](components/grow/LeafCapture.tsx) — `<input type="file" capture="environment">` → `new Image()` | browser decoder |
| Preprocessing | [preprocess.ts:`preprocessFromImage`](lib/grow/tea/preprocess.ts) | `card.preprocessing` — `resize_shorter_side_to`, `image_size`, `crop`, `mean`, `std` |
| Runtime init | [infer.ts:`getSession`](lib/grow/tea/infer.ts) — `import("onnxruntime-web/wasm")`, `numThreads = 1`, `executionProviders: ["wasm"]` | pinned in code, reported by the panel |
| Model load | `InferenceSession.create(MODEL_URL)` → `/models/tea-disease-mnv3s.onnx` | the published artifact |
| Inference | `session.run({ [session.inputNames[0]]: Tensor("float32", …, [1,3,size,size]) })` | `size` from the card; input/output **names read off the session**, not assumed |
| Calibration | [predict.ts:`calibratedSoftmax`](lib/grow/tea/predict.ts) | `card.calibration.temperature` |
| Abstention | [predict.ts:`decide`](lib/grow/tea/predict.ts) | `card.abstention.threshold` |
| Evidence | [evidence.ts:`buildAdvisory`](lib/grow/tea/evidence.ts) | prediction + Day-1 risk/irrigation, read-only |
| Display | [LeafAssessment.tsx](components/grow/LeafAssessment.tsx), [AdvisoryExplanation.tsx](components/grow/AdvisoryExplanation.tsx) | card-derived; render no model constant of their own |

### Identity of the published artifact

Verified on disk at the time of writing:

```
served public/models/tea-disease-mnv3s.onnx   6,370,439 bytes
  sha256 7e55457cac1f9ef1983bb3b62360916f487262f9b812bf3ffc7f220776044fe4
card.model.bytes                              6,370,439
card.model.sha256  7e55457cac1f9ef1983bb3b62360916f487262f9b812bf3ffc7f220776044fe4
ONNX graph  input  "input"  [batch, 3, 160, 160]
            output "logits" [batch, 6]
card.preprocessing.image_size                 160
card.taxonomy.classes                         6
```

The `?diag=1` panel re-runs the hash check **on the bytes the browser received**,
which is the only form of this check that can catch a stale cache or a proxy.

### Tensor layout, normalization, class ordering

* Layout: `[1, 3, size, size]` NCHW, matching the graph's declared input. The
  panel flags any other shape.
* Normalization: `(px/255 − mean[c]) / std[c]`, channel-planar, RGB — the same
  arithmetic in `preprocessRgba` (tested, and the one `check_ts_parity.py`
  drives) and `preprocessFromImage` (production; differs only in letting the
  canvas resample instead of nearest-neighbour, documented in the file).
* Class ordering: `decide()` maps logit *i* to `card.taxonomy.classes[i]`.
  `isUsable` now **enforces** `classes[i].outputIndex === i`, because a
  reordered taxonomy would pass every other check and silently rename every
  diagnosis.

---

## 2. Diagnostic mode

`?diag=1` on `/grow/diagnose` — e.g. `http://localhost:3000/grow/diagnose?diag=1`.

Off otherwise. Gated on the query string rather than `NODE_ENV` on purpose: this
test has to run against a real production build served to a real phone, and a
`NODE_ENV` gate would compile the panel out of exactly the build under test.
It shows model/runtime facts only — no farmer data, no keys, no internals beyond
what a model card already publishes. It reads results and never computes them,
so turning it on cannot change what a farmer is told.

It hard-codes nothing: every value is read from the loaded card or measured at
runtime, and `test/teaDiagnostics.test.ts` proves it by mutating the card and
requiring the panel to move with it.

Reported: card loaded · model name+version · architecture · card sha256 · served
bytes and sha256 (with PASS/FAIL against the card) · runtime backend and build ·
input tensor name+shape (PASS/FAIL vs the card) · output tensor name+shape
(PASS/FAIL vs the class count) · session-init ms · inference ms · total ms ·
preprocessing constants · temperature · abstention threshold · state · predicted
class · calibrated confidence · abstention decision · cross-dataset-validated
flag · model version shown · load/inference failure reason.

---

## 3. Manual checklist

### Setup

```bash
npm run build
npm start                 # production build, the one that ships
```

For the Android half, use Chrome DevTools **port forwarding**
(`chrome://inspect` → Port forwarding → `3000` → `localhost:3000`) rather than
the LAN IP. On `localhost` the phone gets a secure context, so `crypto.subtle`
works and the served-sha256 row is meaningful; over plain `http://192.168.x.x`
that row degrades to "crypto.subtle unavailable" and only the byte count is
checked. An HTTPS tunnel works equally well.

Prerequisite: at least one plot with a grow profile whose crop is **tea**, and a
second whose crop is **not** tea (for T-16).

Record for every run: device, OS, browser + version, network condition,
session-init ms, inference ms, whether WASM initialised, observed state.

### A. Model loading

| # | Step | Expected observable behaviour |
| --- | --- | --- |
| T-01 | First visit, normal network, `?diag=1`, analyse a photo | "Card loaded: yes"; Model = the published name + version; Served bytes and Served sha256 both **PASS**; Runtime backend `wasm (numThreads=1)`; Input `[1, 3, 160, 160]` PASS; Output `[1, 6]` PASS; Session init a few hundred ms to a few seconds; a state appears. Panel header reads "all checks pass". |
| T-02 | Reload the page, analyse again | Same PASS rows. Session init should be **noticeably lower** (WASM + model served from cache). If it is not lower, note it — caching is not working. |
| T-03 | DevTools → Network → throttle to Slow 3G, hard-reload, analyse | Longer session init, no error. During the wait the page shows the loading skeleton, never a fabricated result. |
| T-04 | Go offline (DevTools offline / airplane mode) **before** the first analysis on a fresh profile, then analyse | State = **error**, message "The model could not be downloaded…". Reason row shows `load_failed` or `no_artifact`. It must **not** say uncertain. Weather/watering advice on `/grow` still renders. |
| T-05 | Restore the network and press "Try again" | Recovers to a normal result. (The session promise resets on failure so a transient outage is not permanent.) |
| T-06 | Rename `public/models/tea-disease-mnv3s.onnx` aside, rebuild, load the page | The card still loads, so the camera is offered, and analysing yields state = **error** / `load_failed`. Restore the file afterwards. |
| T-07 | Rename `public/models/tea-disease-mnv3s-card.json` aside, rebuild, load the page | **No camera at all.** The page shows "The model has not been published to this app yet" plus a link back to `/grow`. Restore afterwards. |

### B. Images

Use `C:/Users/HP/tea-data/` held-out test images for T-08 (any file under the
CS-D test split — the split is deterministic, see `ml/tea/teadata.py`).

| # | Step | Expected observable behaviour |
| --- | --- | --- |
| T-08 | A known held-out CS-D leaf image of a class you know | Most likely **confident**, and the class should be the one you know. If it abstains, that is acceptable and not a failure — record it. If it is confidently **wrong**, that is a finding: record the filename. |
| T-09 | A real photograph of any leaf taken with the phone camera | Any state is acceptable. What is checked: it completes, inference ms is recorded, and if confident the "not cross-validated" warning appears for blister blight / red rust. |
| T-10 | A deliberately blurry leaf photo | Expected **uncertain** — heading "Uncertain — retake the photo", the line explaining that the model declines ~65% of photos from unfamiliar farms, photo tips listed, and **no disease name anywhere on screen**. |
| T-11 | A very dark / underexposed leaf photo | Same expectation as T-10. |
| T-12 | Photograph a hand, a shoe, or the floor | Expected **uncertain**. A confident class here is the most serious possible finding — screenshot the panel including the calibrated confidence. |
| T-13 | Select a `.txt` renamed to `.jpg` | State = **error**, `bad_image` ("That file could not be read as an image"). Not uncertain. |
| T-14 | A very large photo (12 MP+) | Completes. Record inference ms; note if the tab reloads (memory pressure on a low-end phone). |
| T-15 | A landscape photo with the lesion near the left edge | The preview shows the square centre crop, so it is visibly clear the lesion is outside what the model sees. |
| T-16 | Open `/grow/diagnose` with the **non-tea** plot selected | No camera button exists. A warning naming the crop and a link back to `/grow`. There must be no way to submit a photo. |

### C. Prediction states

| # | Step | Expected observable behaviour |
| --- | --- | --- |
| T-17 | Confident result | A class name, a confidence %, the model version, the "confidence is not the chance it is right" caveat, and — for blister blight or red rust — the amber "could not be checked against any independent dataset" block. Panel: Abstention decision = `accepted (>= threshold)`, PASS. |
| T-18 | Uncertain result (from T-10/T-11/T-12) | No class anywhere in the advisory. Panel shows `abstained (< <threshold>)` and "Class withheld: yes (leaned …)" — the leaning class appears **only** in the diagnostics panel, never in the advisory. The percentage in the "you will see this often" line must equal 100 − the lowest cross-dataset coverage in the card (65% as published); if it differs, the UI is not reading the card. |
| T-19 | Inference error (from T-04/T-06) | Red "The leaf checker could not run" block with a "Try again" button, distinct in wording and colour from the amber uncertain block. **Field status and Conditions must still render above and below it** — a failed model does not take the watering advice down with it. |

### D. Invariants to eyeball while you are in there

| # | Step | Expected observable behaviour |
| --- | --- | --- |
| T-20 | Note the watering advice on `/grow` for the tea plot, then run several diagnoses of different classes, then return | The irrigation verdict and deficit are **identical**. A diagnosis never feeds the water balance. |
| T-21 | In a run where the evidence rows show a weather/conditions disagreement | The class heading is unchanged; the conditions row says the two disagree and the action line says to inspect and consult — it never substitutes the weather-favoured disease. |
| T-21b | On a 320px-wide screen, open "Why this advice" in සිංහල | Each row reads `SOURCE · kind` (e.g. "පස් සංවේදකය · මෙහිදී මැනූ") with no horizontal scrolling and no word broken mid-character. The disease name and pressure band in Conditions sit on one line or wrap cleanly, never overlapping. |
| T-22 | Compare the version in "Model 1.0.0" under the class heading with the panel's Model row and `public/models/tea-disease-mnv3s-card.json` | All three identical; panel's "Model version shown" = PASS. |
| T-23b | With a screen reader on, in සිංහල or தமிழ், read the "Why this advice" rows and the action line | The English sentences are announced with an **English** voice, not a Sinhala/Tamil one. They carry `lang="en"` because they are English by policy. The headings, labels and buttons around them stay in the page language. |
| T-23 | Switch language to සිංහල / தமிழ் | Every heading, button, state, error, band and disease name is in that language; the advisory SENTENCES stay English and the disclosure at the top says so. No screen shows a raw identifier such as `water_now` or `blister_blight`. |
| T-24 | With two or more plots: select the second on `/grow`, tap "Check the leaves" | `/grow/diagnose` opens on **that same plot**. Switching plots on the diagnosis page clears any leaf result rather than re-describing it against the new plot. |

---

## 4. Acceptance criteria → what closes each one

| # | Criterion | Closed by |
| --- | --- | --- |
| 1 | Browser loads the **published** model | T-01 Served bytes **and** sha256 PASS (needs a secure context; see Setup) |
| 2 | ONNX inference executes | T-01 — a state is produced with non-null inference ms and PASS tensor rows |
| 3 | Production preprocessing | T-01 panel's preprocessing row equals the card, and there is one code path (`preprocessFromImage`) |
| 4 | Same calibrated/abstention logic as the tests | T-17/T-18 — panel's threshold row equals `card.abstention.threshold`, decision rows PASS |
| 5 | Low-confidence ⇒ uncertain with **no class** | T-10, T-11, T-12, T-18 |
| 6 | Failure ⇒ **error**, not uncertain | T-04, T-06, T-13, T-19 |
| 7 | Non-tea crop cannot enter the flow | T-16 |
| 8 | No classification changes irrigation | T-20 |
| 9 | No weather changes the CNN class | T-21 |
| 10 | Displayed version/metadata matches the artifact | T-22 |

**The gate is passed only when T-01, T-12, T-16, T-19 and T-22 have all been
observed on a real Android phone and on a desktop browser.** File serving,
Python inference, unit tests and preprocessing parity do not substitute for any
of them.

---

## 5. After the manual run

Report anything that deviated. Whatever can be reproduced without a browser gets
a regression test in `test/teaDiagnostics.test.ts` or `test/growAudit.test.ts`
before the finding is closed. Record the device table below.

| Device | OS | Browser | Network | WASM init | Session init | Inference | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

---

## 6. Limitations this test does not touch

Unchanged, and not weakened by anything here:

* **No cross-dataset validation exists for blister blight or red rust.** Neither
  appears in any external test set in the audited corpus. A confident prediction
  of either is a lead, never a finding — the UI says so and must keep saying so.
* **Cross-domain confidence can remain overconfident.** Calibration was fitted on
  the CS-D validation split and does not survive domain shift; accuracy on
  accepted TLD-BD field images is 0.759 against 1.000 in-distribution. A
  passing browser test says the model ran, not that it is right.
* **The model is tea-specific.** `Camellia sinensis` only. It has no notion of
  any other crop and must not be offered for one.
* **Weather and risk evidence is not a diagnosis.** It is epidemiological
  pressure computed from conditions; it can agree, disagree or say nothing, and
  it never changes a class.
* **Sensor evidence is not model inference.** A measured root-zone reading and a
  CNN output are separate rows with separate provenance, and the advisory labels
  which is which.
