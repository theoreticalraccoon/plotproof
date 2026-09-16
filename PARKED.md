# Parked — deliberately not being built

Each item lives here with the reason, so scope creep has to argue with a document
instead of a mood. Last reviewed 2026-09-16.

## Deleted, with the reason

| Thing | Deleted | Why |
|---|---|---|
| In-house satellite deforestation model | 2026-07-27 | Could not be trained or validated honestly by one developer. JRC TMF + Global Forest Watch are cited instead of inventing a verdict. **Superseded** — the ML spine is now the GROW lane (see `ML.md`). |
| Acoustic chainsaw classifier | 2026-09-16 | Hardware never existed, its ingest routes went with the watchdog layers, and ESC-50 is CC BY-NC so the weights were unshippable regardless. The licence problem is why `models/tea/provenance.json` now exists. |
| Public deforestation map (`/explore`) | 2026-09-16 | Built on the pre-pivot watchdog premise. In-memory store that could not survive a serverless cold start. |
| Standing monitoring + alerts | 2026-09-16 | Same premise, same storage problem. Its daily cron was pointing at a deleted route. |
| `teaLeafBD` as cross-dataset partner | 2026-09-16 | Its CC BY 4.0 Mendeley record contains **no images** in any version. Licence clean; nothing to license. |
| `TeaLeafDiseaseBD` (13,085 images) | 2026-09-16 | Every leaf on a black studio background. As a test set it would measure background shift; as training data it would teach a background we never see. |

Everything above is in git history.

## Not started, and why

| Idea | Why parked |
|---|---|
| Activating grey blight / algal leaf spot / red leaf spot / looper | Declared as reserved class IDs in `models/tea/taxonomy.json` but absent from CS-D, so none can be trained. Presence in a test set is not a reason to activate a class. |
| Merging red rust with algal leaf spot | The pathology literature says one *Cephaleuros* disease; two unrelated annotation teams shipped them separate. A wrong merge is unrecoverable after training. |
| Estate-held-out evaluation | TLD-BD names two estates with GPS in its prose, but 0 of 4,016 files carry EXIF GPS. No geographic hold-out is possible on any audited corpus. |
| A trained "not a tea leaf" class | A representative negative set for *everything that is not a tea leaf* cannot be sampled honestly. Open-set handling rests on the abstention threshold, and the model card says so. |
| Crowdsourced Ceylon spice price index | Needs transaction liquidity; with zero real users the crowd is an empty set. |
| Carbon-market eligibility per plot | Needs baselines, registries, additionality proof. |
| QR provenance on retail packaging | Needs the buyer side and real lots first. |
| Marketplace / payments / logistics | A solo developer cannot manufacture liquidity. The verification link is the executable slice instead. |
| Sri Lanka EDB / Colombo auction spice prices | Wanted — would fill the cinnamon/pepper/cardamom gap the World Bank data cannot. Sources are PDF bulletins, so this needs a real digitisation pass, not a scrape hack. |
| Sinhala LLM form assistant | Wanted; blocked on an API-key and per-query-cost decision. |

## Known competitors

Koltiva, Meridia, Farmforce, TraceX sell verified smallholder geodata to
exporters as enterprise products. PlotProof's lane, if it takes one: farmer and
co-op-owned records, Sinhala-first, free at the point of capture, offline-first
on cheap Android — the supply side of the same market, owned by the supply side.
