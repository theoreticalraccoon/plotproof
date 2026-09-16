# Tea dataset audit — before the training loop

Audited 2026-09-16, before any training code. Every number here is reproduced by:

```bash
python scripts/audit_tea_datasets.py --csd <csd-dir> --ewu <ewu-dir>
```

which writes `models/tea/audit-results.json`. Licences are in `provenance.json`;
the class contract is in `taxonomy.json` and `lib/grow/teaClasses.ts`.

Findings are recorded as **Problem → Evidence → Impact → Decision**.

---

## 1. CS-D contains 9,000 photographs, not 80,329 images

**Problem.** CS-D is published only in augmented form, and the augmentation
grouping is undocumented. Split it at random and every test image has eight
near-identical siblings sitting in training.

**Evidence.** 80,329 JPEGs, all 256×256 RGB, zero unreadable in a 1,800-image
sample. For every one of the six classes, an image's nearest neighbour — by a
rotation- and flip-invariant colour histogram, chosen because CS-D's flips
defeat a perceptual hash — sits at index delta **exactly 1500** for 96.5–96.8%
of images, and at a multiple of 1500 for **99.5–99.9%**. Mean nearest-neighbour
similarity is **0.9986–0.9988**: siblings are all but identical.

An earlier version of this test sampled indices 1–1200, narrower than the
stride, and found nothing. Widening the window past 1500 produced the result
immediately. Worth remembering: a null result from a window smaller than the
period you are hunting is not evidence of absence.

**Impact.** The effective dataset is **9,000 independent photographs** (1,500
per class × 6), an **8.93× inflation**. A model validated on a random image
split would score near-perfectly by memorising augmented siblings — the exact
failure mode that produces the 99%-accuracy tea papers.

**Decision.** Recover the grouping and split on it:
`groupId = ((imageIndex − 1) mod 1500) + 1`, per class. Group sizes confirm it —
every class is exactly 1,500 groups of 9, except Healthy (829 of 9, 671 of 8,
summing to its 12,829).

---

## 2. CS-D ships 671 fewer images than its paper claims

**Problem.** The Data in Brief article states 81,000 augmented images. The
archive holds 80,329.

**Evidence.** Five classes are exactly 13,500. Healthy is 12,829. The entire
671-image shortfall is in one class.

**Impact.** Minor numerically, but it means the published description is not a
reliable source for dataset facts, and it introduces a mild class imbalance
where the paper implies perfect balance.

**Decision.** Use measured counts everywhere. Never cite the paper's 81,000.

---

## 3. teaLeafBD — the planned cross-dataset partner — has no images at all

**Problem.** The whole cross-dataset validation design rested on teaLeafBD as an
independent held-out set from a different country, photographers and devices.

**Evidence.** The Mendeley record `10.17632/744vznw5k2` — the record whose
CC BY 4.0 licence we verified — contains **no image files in any version**.
Versions 1, 2 and 3 return zero entries from the Mendeley file API. Version 4
contains one file: a 187 KB `read_me.pdf`. That PDF describes a seven-folder
structure with 5,278 JPEGs at 1200×1600 and gives per-class counts, none of
which exist in the repository.

**Impact.** The single strongest honesty asset in the plan — "trained on Assam,
tested on Bangladesh" — cannot be built as designed. A Kaggle mirror exists, but
taking images from it would break the provenance chain: the CC BY 4.0 grant we
verified attaches to the Mendeley record, and a mirror's contents and licence
would each need independent verification.

**Decision.** Drop teaLeafBD. Its documented counts are transcribed into
`manifest.json` for the record and explicitly marked unverified against pixels.
Replace it with EWU, which is already licence-cleared, and identify TLD-BD as a
field-condition candidate.

---

## 4. The EWU dataset's own train/val/test split leaks

**Problem.** EWU ships a Roboflow split that looks ready to use.

**Evidence.** Roboflow's own export log states augmentation created *"2 versions
of each source image"* by random flips, and the split is random. Grouping the
5,180 images by their Roboflow source stem gives **3,060 distinct source
photographs** (1.69 images each). Of those stems, **101 (3.3%) appear in more
than one split**, affecting **295 images (5.7%)**.

**Impact.** Any score computed on the shipped split is inflated by siblings
crossing the boundary.

**Decision.** Discard the shipped split; re-split by source stem with the same
group-hash rule used for CS-D.

---

## 5. Blister blight exists in exactly one dataset

**Problem.** Blister blight (*Exobasidium vexans*) is the defining up-country
Ceylon tea disease, the class the product most needs, and the one
`lib/grow/risk.ts` is built around.

**Evidence.** Five tea datasets examined — CS-D, teaLeafBD (documented classes),
EWU, TLD-BD, TeaLeafDiseaseBD. **Only CS-D contains blister blight.** The other
four cover algal leaf spot, brown blight, grey blight, helopeltis, red spider,
red rust, green mirid bug and looper — but not blister blight.

**Impact.** The most important class in the model is the one that can never be
cross-dataset validated. Any blister-blight number will be in-distribution only,
on data from Assam, for a disease we are claiming to detect in Sri Lanka.

**Decision.** Keep the class — dropping it would gut the product — and mark it
`crossDatasetTestable: false` in the taxonomy, enforced by a test. Every
blister-blight figure must be labelled in-distribution wherever it appears. This
is the model card's headline caveat, not a footnote.

---

## 6. Only three classes can be cross-dataset tested at all

**Problem.** CS-D and EWU overlap far less than their six-class counts suggest.

**Evidence.** Confident correspondences: **healthy**, **brown blight**,
**helopeltis** (CS-D's `Tea_Mosquito_Bug` is the same insect — *Helopeltis
theivora*, whose universal common name in South Asian tea is "tea mosquito
bug"). CS-D's blister blight and EWU's grey blight, algal leaf spot and red leaf
spot have no counterpart in the other.

**Impact.** The generalisation estimate covers 3 of 6 active classes, and two of
those three are "healthy" and a pest.

**Decision.** Report the cross-dataset number on those three classes and state
the coverage plainly rather than presenting it as a whole-model figure. Download
TLD-BD next for a real in-field held-out set with estate-level metadata.

---

## 7. Red rust, algal leaf spot and red leaf spot — evidence conflicts

**Problem.** These three names may denote one condition, two, or three.

**Evidence.** *For merging:* plant-pathology sources treat "red rust" as the
name for *Cephaleuros* infection specifically on tea and coffee, and list
*C. parasiticus* as a synonym of *C. virescens* — which would make red rust and
algal leaf spot the same disease. *Against merging:* the EWU annotators ship
"Algal Leaf Spot" and "Red Leaf Spot" as separate classes within one dataset,
and the unrelated TeaLeafDiseaseBD team independently ship "Algal Leaf Spot" and
"Red Rust" as separate classes. Two annotation teams both saw distinguishable
presentations.

**Impact.** A wrong merge is unrecoverable once a model is trained on it; the
classes cannot be pulled apart afterwards.

**Decision.** **Do not merge.** Class IDs 3, 7 and 8 stay distinct. The cost is
that 7 and 8 remain inactive in v1 — which they would be anyway, since neither
appears in CS-D. The literature describes taxonomy; the annotators describe
pixels, and the model learns pixels.

---

## 8. Two of the six active classes are pests, not pathogens

**Problem.** The CNN's label space is not the risk engine's label space, and
merging them silently would attach a fungal infection prior to an insect.

**Evidence.** CS-D's six classes include `Red_Spider_Mite` (*Oligonychus
coffeae*, a mite) and `Tea_Mosquito_Bug` (*Helopeltis theivora*, an insect).
`lib/grow/risk.ts` models three **fungal** pathogens with weather-driven
infection windows. Neither pest has one, and neither should.

**Impact.** Fusion would otherwise up- or down-weight a red-spider-mite
prediction using a blister-blight infection window that says nothing about mites.

**Decision.** `riskEngineKey` on every class is the explicit bridge, `null`
where none exists — meaning *"no environmental prior exists"*, not *"prior is
neutral"*. Enforced by tests: no pest may carry a prior, and only the risk
engine's three pathogens may.

---

## 9. Every dataset lives in a different visual domain

**Problem.** Cross-dataset scores will be depressed by domain shift, not only by
genuine failure to generalise, and it is tempting to report the pessimistic
number as if it were purely the latter.

**Evidence.**

| Dataset | Domain |
| --- | --- |
| CS-D | 256×256, publisher-resized and median-filtered, augmented ×9 |
| EWU | 640×640 stretched (aspect ratio destroyed), **detached leaves**, three distinct filename families suggesting three merged sub-collections |
| TLD-BD | 480×640, genuine in-field, two named estates |
| TeaLeafDiseaseBD | **black studio background** |

**Impact.** A model trained on median-filtered 256×256 Assam crops and tested on
aspect-distorted 640×640 detached leaves is being asked to cross two shifts at
once. A low score does not cleanly mean "bad at tea disease".

**Decision.** Report the cross-dataset number with the domain difference stated
next to it. Reject TeaLeafDiseaseBD entirely — a black-background set would
measure background shift and teach a background we never see in the field.

---

## 10. CS-D carries no field, date or device metadata

**Problem.** The plan called for a field-held-out split, mirroring `ML.md`'s
standing rule that random splits leak and whole regions must be held out.

**Evidence.** The paper describes seven Assam estates, seven months and three
phone models. None of it survives into the published archive — the files are
`ClassName1.jpg … ClassName13500.jpg` with no accompanying metadata.

**Impact.** Geographic and temporal hold-outs are impossible on CS-D. The
strongest available unit is the source photograph.

**Decision.** Group-held-out is the ceiling for CS-D; say so rather than
implying a geographic split. Download TLD-BD for a genuine estate-held-out
split, since it publishes per-estate GPS coordinates.

---

## Summary of what changes from the approved plan

| Planned | Actual | Why |
| --- | --- | --- |
| Train CS-D, test teaLeafBD | Train CS-D, test EWU (3 classes) | teaLeafBD publishes no images |
| Field-held-out split | Source-group-held-out split | CS-D has no field metadata |
| Cross-dataset number for the model | Cross-dataset number for 3 of 6 classes | Only three confident correspondences |
| Blister blight validated | Blister blight in-distribution only | Single-source, no alternative exists |

---

# TLD-BD audit (added 2026-09-16)

Downloaded and audited specifically to answer one question: **can TLD-BD support
a genuine estate-held-out evaluation?** Its Mendeley record names two estates
with GPS coordinates, which would make it the only candidate capable of a
geographic hold-out.

**The answer is no.** Findings 11–15 below.

Reproduce with:

```bash
python scripts/audit_tea_datasets.py --tld "<...>/Tea Compressed Data" --out models/tea/audit-tld.json
```

## What it actually contains

2,008 images (record says 2,007), **zero unreadable**, six class folders.
The archive holds *two* sets the record does not mention: `Tea Compressed Data`
(the 2,008 usable images) and `Tea Original Data` (full-resolution 4032×3024
originals, the bulk of the 2.9 GB).

| Class | Images | → canonical | Active in v1? |
| --- | ---: | --- | --- |
| healthy | 436 | `healthy` (0) | **yes** |
| looper_infested | 332 | `looper` (10) | no |
| helopeltis | 321 | `helopeltis` (5) | **yes** |
| red_spider | 316 | `red_spider_mite` (4) | **yes** |
| gray_blight | 302 | `grey_blight` (6) | no |
| algal_leaf | 301 | `algal_leaf_spot` (7) | no |

Class imbalance ratio 1.45 — the mildest of any dataset audited.

---

## 11. No GPS. The estate hold-out is impossible

**Problem.** The entire reason for downloading TLD-BD was the two named estates
with published coordinates — M.R. Khan (24.27257, 91.75938) and Finlay
(24.30334, 91.74249).

**Evidence.** **0 of 400 sampled images carry EXIF GPSInfo.** Zero in the
compressed set, zero in the originals sampled. Crucially this is not a
re-encoding artifact: the same images retain `DateTimeOriginal` (99.8%), `Make`
and `Model`, so EXIF survived the publisher's compression intact. GPS is absent
because it was never recorded, not because it was stripped.

Nor is the estate recoverable any other way: images are organised into folders
by **class**, exactly as the record says, with no estate directory, no manifest,
and no estate token in any filename.

**Impact.** The two estates exist only in prose. No image can be attributed to
one. A geographic hold-out cannot be constructed at any level.

**Decision.** Abandon the estate-held-out evaluation. TLD-BD is in the same
position as CS-D on this point, for a different reason.

---

## 12. The capture dates contradict the published record

**Problem.** The Mendeley record states collection over eight days,
9–16 December 2024.

**Evidence.** EXIF `DateTimeOriginal` on 2,008 images gives **two days:
2023-08-20 (1,518 images) and 2023-08-21 (485)** — sixteen months earlier than
stated, and two days rather than eight.

**Impact.** Two consequences. First, the published metadata is not reliable, so
nothing in it should be cited without checking the files. Second, even a
*temporal* hold-out — the fallback when geography fails — yields only two
groups, and they are confounded with class (see 13).

**Decision.** Trust EXIF over the record; the camera wrote it at capture. Record
the discrepancy rather than quietly using the EXIF dates.

---

## 13. Camera device is confounded with class

**Problem.** Two devices took these photos, and they did not photograph the
classes evenly.

**Evidence.**

| Class | iPhone 7 | Samsung SM-A217F |
| --- | ---: | ---: |
| gray_blight | **100%** | 0% |
| red_spider | **100%** | 0% |
| algal_leaf | 99% | 0% |
| healthy | 81% | 19% |
| helopeltis | 70% | 29% |
| looper_infested | 48% | 52% |

Capture date is confounded the same way: `gray_blight` and `looper_infested`
appear only on 2023-08-20, while 75% of `red_spider` is on 2023-08-21.

**Impact.** Three classes are effectively single-device. A model can pick up
sensor noise, colour science and JPEG quantisation tables instead of the lesion —
a shortcut that would inflate any score computed on this dataset. It also rules
out device or date as a clean split axis, since splitting on either would remove
whole classes from one side.

**Decision.** Use TLD-BD **only as a held-out test set, never for training**.
As a test set the confound is tolerable — it makes the test harder, not
dishonest. As training data it would teach the camera.

---

## 14. Real capture-session grouping exists, and it is usable

**Problem.** Group-level dedup needs a source unit, and TLD-BD has no explicit one.

**Evidence.** Filenames are camera shutter sequences (`IMG_1966.JPG`). Consecutive
numbers form **483 runs across 2,008 images, mean 4.2 images per run** — bursts
of the same leaf from slightly different angles. Near-duplicate structure is far
milder than CS-D: mean nearest-neighbour similarity **0.9706** (CS-D: 0.9988),
with 6.8% above 0.999.

A second duplication mechanism: `IMG_E####.JPG` is iOS's *edited copy* of
`IMG_####.JPG`. **38 such pairs** exist within the same class — the same
photograph stored twice.

**Impact.** Genuine diversity, unlike CS-D's 8.93× augmentation. But shutter-run
siblings and edited/original pairs must still be kept together.

**Decision.** Group by consecutive shutter run, treating `IMG_E####` as the same
group as `IMG_####`. Since TLD-BD is test-only, this affects de-duplication of
the test set rather than a train/test boundary.

---

## 15. Dimensions are not uniform, contrary to the record

**Problem.** The record says images are "compressed to 480x640 pixels".

**Evidence.** The dominant size is **640×480 (landscape)**, not 480×640. Both
orientations appear, plus odd sizes (471×640, 477×640, 438×640) and one
**4000×3000** image sitting in the compressed `healthy` folder.

**Impact.** Minor, but a fixed-size loader assuming 480×640 portrait would
silently distort most of the set.

**Decision.** Resize with aspect handling; do not assume orientation. Flag the
4000×3000 outlier during preprocessing rather than letting it through.

---

## 16. TLD-BD still adds one class of cross-dataset coverage

**Problem.** Having lost the estate hold-out, is TLD-BD worth keeping at all?

**Evidence.** Its labels map through the existing taxonomy with **no changes
required** — all six folder names already resolve via `teaClassFromSourceLabel`.
Overlap with the six active v1 classes: **healthy (436), helopeltis (321),
red_spider_mite (316) = 1,073 images**.

`red_spider_mite` is **not** in the EWU overlap. So TLD-BD extends cross-dataset
coverage from 3 of 6 active classes to **4 of 6**, and does it with genuine
in-field imagery rather than EWU's detached leaves.

Its other three classes (grey blight, algal leaf spot, looper) map to **inactive
reserved IDs** and stay inactive: none is in CS-D, so none can be trained.

**Impact.** The claimed benefit is gone; a smaller, real one remains.

**Decision.** Keep TLD-BD in a **downgraded role** — a second cross-dataset test
set, test-only, never training, never model selection. Do **not** activate any
new class on the strength of it.
