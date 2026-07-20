# Training the forest-probability U-Net

**The model in one sentence:** a U-Net with an ImageNet-pretrained ResNet-34 encoder
that outputs, for every 10 m pixel, the probability it was forest.

- **In:** `[10, 256, 256]` — B02 B03 B04 B08 B11 B12, NDVI, NDMI, S1 VV, VH.
- **Out:** `[1, 256, 256]` — forest probability (sigmoid of the logit).
- **Modality dropout** blanks the optical *or* the radar group at random during
  training, so the model degrades gracefully when a date has only one sensor; the
  same mechanism records which sensors produced a prediction (`dataset.sensors_present`).
- **Validation holds out whole regions** (the `split` set when chips were built),
  never random chips.

## Where it runs
Training runs on a **single consumer GPU or free Colab** — not in the data-prep
sandbox (no GPU there). Locally you can only run the plumbing check:

```bash
python -m pip install -r requirements-train.txt
python train.py --smoke      # random data, 2 epochs, CPU — proves the pipeline runs
```

## Real training (Colab)
1. New Colab notebook → Runtime → **GPU** (T4 is enough for ResNet-34 @ 256²).
2. Upload the `chips/` folder (or rebuild it there with the data pipeline) and
   `model.py dataset.py train.py requirements-train.txt`.
3. Run:
   ```bash
   !pip install -q -r requirements-train.txt
   !python train.py --chips ./chips --epochs 40 --batch 8
   ```
4. Best checkpoint (by held-out-region IoU) is written to `forest_unet.pt`. The run
   also prints per-stratum IoU and the fused / optical-only / radar-only breakdown.

## Prerequisites before a *real* run (see DECISIONS.md S-011)
This pipeline is complete and verified to run, but the chips it consumes are not yet
training-ready:
1. **Chips must be 10-channel.** The current builder saves 4 optical bands; extend it
   to 6 bands + save `radar.npy` (S1 VV/VH, already co-registered by Step 2). The
   dataset expects `bands.npy (6,H,W)` + `radar.npy (2,H,W)` + `label.npy`.
2. **Tighten the cloud gate + label rule.** The QA grid showed thin-cloud leakage and
   dry-deciduous label noise (Hansen vs WorldCover disagreement). Fix before scaling.
3. **Scale the volume.** ~20 chips is a plumbing sample, not a training set — raise
   `config.CHIPS_PER_REGION` and add regions until each stratum has real volume.
4. **Plantation is a sampling stratum, not a pixel label** — a per-pixel plantation
   mask (e.g. Descals oil-palm) is still needed to actually break the plantation-vs-
   natural-forest confusion the QA grid made visible.
