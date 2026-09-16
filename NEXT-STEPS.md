# Next steps

Current as of 2026-09-16.

## Immediately next (code)

**Wire the tea classifier into `/grow/diagnose`.** The model is trained,
evaluated and published; nothing consumes it yet. Requirements, all of which are
already data in `public/models/tea-disease-mnv3s-card.json` and must not be
retyped into a component:

1. Load the ONNX lazily — only on that route, never in the main bundle (it is
   6 MB).
2. Preprocess from the card's own constants (`image_size`, `mean`, `std`).
   Reuse `processPhoto` from `lib/intake/image.ts` for capture.
3. **Honour the abstention threshold (0.9976).** Below it the answer is
   "uncertain — retake the photo", never a class. Without this the model is ~70%
   accurate on real field photos while sounding certain.
4. Never describe blister blight or red rust as cross-dataset validated.
5. No artifact → render nothing, per the `PriceCard` contract.

**Then fusion — `lib/grow/fusion.ts`.** Combine the CNN's visual evidence with
the weather risk engine as a calibrated posterior, not an average. The
justification is concrete: the CNN is trained on Assam and carries a transfer
gap; the risk engine is computed from local weather and carries none. Consult
`riskEngineKey` — it is `null` for both pests, meaning *no environmental prior
exists*, not *prior is neutral*. A red-spider-mite prediction must not be
reweighted by a fungal infection window.

**Then `/models`** — one page listing every model with its metric *and its
baseline*, dataset provenance, and known failure modes. Cheap to build and the
single highest-leverage page for the submission category.

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
