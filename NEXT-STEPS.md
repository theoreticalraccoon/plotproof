# Next steps

Current as of 2026-09-17.

## Immediately next (blocking release)

**Run the real-device browser smoke test.** The tea classifier is trained,
evaluated, published, integrated, audited and now fully wired into the finished
`/grow` advisory — but `classifyLeaf` ->
onnxruntime-web has never been observed executing in a browser. Files serving,
Python inference, unit tests and preprocessing parity do not substitute for it.

The checklist, the traced runtime path and the acceptance criteria are in
[BROWSER-SMOKE-TEST.md](BROWSER-SMOKE-TEST.md). It needs a human with an Android
phone and a desktop browser; `?diag=1` on `/grow/diagnose` exposes the model
version, runtime backend, tensor shapes, timings, calibrated confidence and
abstention decision needed to record the result. Until it is run, the feature is
not releasable.

**Fusion — superseded, deliberately.** `lib/grow/tea/evidence.ts` now does this
job and does NOT combine the two into a single score. The audit's position stands:
a posterior would hide the disagreement, and the disagreement is the honest
signal. Revisit only with a reason to overturn that. The original intent, kept
for the record: combine the CNN's visual evidence with
the weather risk engine as a calibrated posterior, not an average. The
justification is concrete: the CNN is trained on Assam and carries a transfer
gap; the risk engine is computed from local weather and carries none. Consult
`riskEngineKey` — it is `null` for both pests, meaning *no environmental prior
exists*, not *prior is neutral*. A red-spider-mite prediction must not be
reweighted by a fungal infection window.

**Then `/models`** — one page listing every model with its metric *and its
baseline*, dataset provenance, and known failure modes. Cheap to build and the
single highest-leverage page for the submission category.

**Native-speaker translation review.** Every Sinhala and Tamil string in the
GROW lane was written by a language model and has had no human review. The table
is in [models/tea/TRANSLATION-REVIEW.md](models/tea/TRANSLATION-REVIEW.md) (126
strings, regenerate with `python scripts/translation_review.py`). Safety and
action rows first. This does not block the browser gate, but it should not ship
to a real farmer unreviewed.

## Blocked on a decision

- **Magicbit soil sensor.** The Dexie tables (`sensorReadings`,
  `growProfiles`) and the three-tier anchoring ladder already exist and work; a
  real probe would move `/grow` from "grid" to "sensor". Needs the hardware
  plugged in and a two-point calibration.
- **Sinhala LLM assistant** — needs an API key and a per-query cost decision.
- **Colombo auction spice prices** — needs a real PDF digitisation pass.

## Only a human can do these

**Capture one real plot.** Zero real plots exist. Every feature is a hypothesis
until one farmer and one officer have touched it. Take a phone to a farm, trace a
boundary, attest with the farmer, then open `/verify/<id>`. Write down where the
officer hesitates, whether the map is readable in sunlight, and what the farmer
asks. That list is worth more than anything in the backlog.

**Photograph Sri Lankan tea leaves.** The classifier is trained entirely on
Assam imagery and there is no Sri Lankan tea in any public dataset examined. Even
200 labelled local leaves would convert the largest caveat on the model card into
a measurement.

**One exporter or cooperative conversation.** Ask where their smallholder plot
geolocation will come from when EUDR filing starts, whether an attested boundary
would be usable evidence, what it would take to trust it, and who already offers
them this.

## Done

- GROW lane: Open-Meteo, FAO-56 irrigation, disease risk engine, `/grow`.
- Tea classifier v1.0.0: licence cleared at source, corpora audited, leakage gate,
  trained, calibrated, three-tier evaluation, published artifact.
- Watchdog layers removed; the stale monitoring cron and dead env vars with them.
- Supabase live; captured plots sync and `/verify/<id>` is a real URL.
