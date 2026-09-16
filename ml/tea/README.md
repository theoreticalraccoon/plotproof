# Tea leaf condition classifier

The vision half of the GROW lane. A farmer photographs a leaf; the model returns
a condition or — deliberately often — says it is not sure.

It is the half of the disease system that carries a **transfer gap**. It is
trained entirely on Assam imagery and deployed in Sri Lanka. The weather-driven
risk engine in `lib/grow/risk.ts` carries no such gap, because it is computed
from the plot's own conditions. That asymmetry is the whole argument for fusing
them rather than shipping the classifier alone.

## The two numbers that matter

| | Accuracy | Macro-F1 | ECE |
|---|---:|---:|---:|
| **Test 1** — CS-D internal, in-distribution | **0.9975** | 0.9975 | 0.0006 |
| **Test 2** — EWU cross-dataset (detached leaf) | **0.7061** | 0.7346 | 0.1972 |
| **Test 3** — TLD-BD cross-dataset (field) | **0.6999** | 0.7959 | 0.2447 |

> In-distribution accuracy 99.75%. Cross-dataset accuracy ~70%. The second pair
> is our honest estimate for a farm the model has never seen. Published tea-disease
> papers report the first number and stop.

**These are never averaged.** They measure three different things and a mean of
them describes none.

## Pipeline

| Step | Command |
|---|---|
| 1. Leakage gate (must pass first) | `python ml/tea/check_leakage.py --csd <d> --ewu <d> --tld <d>` |
| 2. Smoke train | `python ml/tea/train.py --csd <d> --smoke` |
| 3. Train | `python ml/tea/train.py --csd <d> --img-size 160 --samples-per-group 1 --epochs 14` |
| 4. Calibrate + evaluate | `python ml/tea/evaluate.py --csd <d> --ewu <d> --tld <d>` |
| 5. Export artifact | `python ml/tea/export.py` |
| 6. Inference smoke | `python ml/tea/smoke_infer.py --csd <d> --tld <d>` |

Datasets are fetched from the DOIs pinned in `models/tea/provenance.json`; they
are never committed. `models/tea/dataset-audit.md` records what is wrong with
each of them.

## Files

| File | What |
|---|---|
| `teadata.py` | Loader, deterministic split, dataset-label → canonical-class mapping |
| `check_leakage.py` | Six pre-training checks. Exits non-zero on any failure |
| `train.py` | MobileNetV3-Small, field augmentation, selection on validation macro-F1 |
| `evaluate.py` | Temperature scaling + abstention on validation, then the three test sets once each |
| `export.py` | ONNX + the published model card |
| `smoke_infer.py` | Runs the *published* artifact, preprocessing from the card's own constants |

## Honesty contract

- **Test sets are touched once**, after the model is frozen. Model selection,
  temperature and the abstention threshold all come from validation only.
- **No cross-dataset evidence exists for blister blight or red rust.** Neither
  appears in any external dataset in the audited corpus. Their only numbers come
  from Test 1, which shares CS-D's domain. Blister blight is simultaneously the
  most important class in the product and the least externally verifiable, and
  the model card says so.
- **Classes come from `models/tea/taxonomy.json`**, never from folder names.
  Two of the six are pests, not pathogens, and `riskEngineKey` is the explicit
  bridge to the risk engine — `null` means *no environmental prior exists*, not
  *prior is neutral*.
- **The card is the only source of truth for the UI.** Class names,
  preprocessing constants, threshold, metrics and caveats are all data. Nothing
  is duplicated into a component.
- **No artifact → the feature renders nothing.** Same contract as
  `public/models/prices.json`.

## Things that went wrong, kept because they generalise

**The split unit is a photograph, not an image.** CS-D publishes 80,329 images
generated from 9,000 photographs, and documents no grouping. It was recovered
empirically (nearest neighbour at index delta exactly 1500). Splitting on images
would have produced ~99% "accuracy" that was memorisation of augmented siblings.

**The first abstention rule never fired.** It took the lowest threshold reaching
95% accuracy-on-accepted, but validation accuracy is 0.9964 at threshold 0.0, so
it selected 0.0. The lesson is not the bug: an abstention threshold exists to
catch inputs unlike the training distribution, and a validation set contains no
such inputs by construction. It cannot answer "where does accuracy fall below
95%?" because it never does. The replacement asks a question validation *can*
answer — the 5% quantile of in-distribution confidence.

**The first published artifact was a 0.29 MB graph stub.** torch 2.14's exporter
put the weights in a sibling `.onnx.data` file. It loaded fine locally next to
its sidecar and failed the instant it was loaded from `public/models/` alone.
Caught only because `smoke_infer.py` loads the *published* file rather than the
checkpoint. `export.py` now passes `external_data=False` and refuses to publish
a file too small to hold its own parameters.

## Known limitations

Full list in the model card. The ones that bite hardest:

- Trained entirely on Assam imagery; no Sri Lankan tea in any training image.
- Calibration does not survive domain shift. ECE is 0.0006 in-distribution and
  0.20–0.24 cross-dataset — the model stays confident while becoming wrong.
  Abstention absorbs much of this (EWU accuracy 0.706 → 0.957 on accepted) but
  not all: confidently-wrong cross-domain predictions do occur.
- Open-set handling rests on the threshold alone. There is no trained
  "not a tea leaf" class, because a representative negative set for
  *everything that is not a tea leaf* cannot be sampled honestly.
- Training images are 256×256, publisher-resized and median-filtered. The model
  has never seen a full-resolution photograph.
