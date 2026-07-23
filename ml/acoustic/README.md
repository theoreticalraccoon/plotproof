# Acoustic ML — the model behind the acoustic monitoring preview

This replaces the satellite U-Net as the project's ML component. The council's
objection to the U-Net was that it could not be trained or evaluated honestly.
This can: real public benchmark, the dataset's own cross-validation protocol,
and every published number is a measured one.

**Task.** Classify short audio windows into the app's three event classes
(`lib/acoustic/types.ts`): `chainsaw`, `heavy_vehicle`, `other`.

**Architecture.** YAMNet (AudioSet-pretrained, frozen) → mean+max pooled
embeddings → small dense head. Exported end-to-end (waveform → probabilities)
as a ~4 MB TFLite model.

**Data.** [ESC-50](https://github.com/karolpiczak/ESC-50): 2,000 labelled
environmental clips, 5 predefined folds. Evaluation is leave-one-fold-out over
those folds — never a random split. Note the license: **CC BY-NC 3.0**, so this
exact model is research/demo only; production needs field recordings or a
permissively licensed dataset (FSD50K).

## Files

| File | What |
|---|---|
| `PlotProof_Acoustic_ML.ipynb` | The whole pipeline: download → EDA → embeddings → 5-fold CV → threshold selection → export. Upload to [Colab](https://colab.research.google.com) (File → Upload notebook) and Runtime → Run all. |
| `gateway_infer.py` | Mic → TFLite → POST to the app's `/api/acoustic/ingest` (bearer-authenticated). Runs on a laptop or Raspberry Pi. |

## Workflow

1. Run the notebook in Colab (~20–30 min). It downloads two artifacts:
   `plotproof_acoustic.tflite` and `acoustic-metrics.json`.
2. Commit `acoustic-metrics.json` to `public/models/acoustic-metrics.json` and
   deploy — the acoustic page renders the model card from it. Until that file
   exists the page says "no trained model published yet", which is the truth.
3. Put the `.tflite` next to `gateway_infer.py` on a machine with a microphone,
   set `INGEST_URL`, `ACOUSTIC_INGEST_TOKEN`, `NODE_LAT`, `NODE_LNG`, and run
   it. Detections appear on the acoustic page and in plot evidence packs.

## Honesty contract

- The model card ships the cross-validated numbers and their caveats; the site
  never displays a number that wasn't measured.
- `heavy_vehicle` is an engine/machinery proxy (ESC-50 has no logging truck).
- ESC-50 clips are clean and close-mic'd; field performance is unvalidated
  until real field audio exists. The card says so on screen.
