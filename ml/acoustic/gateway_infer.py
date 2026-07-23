"""PlotProof acoustic gateway: microphone -> TFLite classifier -> /api/acoustic/ingest.

Runs on anything with a mic and Python (laptop now, Raspberry Pi at a LoRa
gateway later). Listens in 4-second windows, classifies each with the model
trained in PlotProof_Acoustic_ML.ipynb, and POSTs real detections to the app's
existing authenticated ingest endpoint. Two consecutive over-threshold windows
are required before an event is sent, and each class has a cooldown, so one
passing motorbike does not become ten alerts.

The model uses SELECT_TF_OPS (YAMNet's audio frontend), so this needs the full
`tensorflow` package, not tflite_runtime:

    pip install tensorflow sounddevice numpy

Environment:
    INGEST_URL              e.g. https://plotproof.example/api/acoustic/ingest
    ACOUSTIC_INGEST_TOKEN   bearer token configured on the deployment
    NODE_LAT, NODE_LNG      where this sensor is (required once per new devEui:
                            the app auto-provisions unknown nodes from it)
    DEV_EUI                 optional; a stable fake LoRaWAN id is derived from
                            the hostname if unset
    CHAINSAW_THRESHOLD      optional; defaults to the value in acoustic-metrics.json
"""
from __future__ import annotations

import hashlib
import json
import os
import socket
import sys
import time
import urllib.request
from datetime import datetime, timezone

import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "plotproof_acoustic.tflite")
METRICS_PATH = os.path.join(os.path.dirname(__file__), "acoustic-metrics.json")
CLASSES = ["chainsaw", "heavy_vehicle", "other"]
SAMPLE_RATE = 16000
WINDOW_S = 4.0
CONSECUTIVE_REQUIRED = 2
COOLDOWN_S = 60.0
HEAVY_VEHICLE_THRESHOLD = 0.85  # proxy class: keep it strict


def load_threshold() -> float:
    env = os.environ.get("CHAINSAW_THRESHOLD")
    if env:
        return float(env)
    try:
        with open(METRICS_PATH, encoding="utf-8") as f:
            return float(json.load(f)["cv"]["chainsaw"]["threshold"])
    except (OSError, KeyError, ValueError):
        print("no acoustic-metrics.json next to the model; using threshold 0.9")
        return 0.9


def derive_dev_eui() -> str:
    env = os.environ.get("DEV_EUI")
    if env:
        return env
    digest = hashlib.sha256(socket.gethostname().encode()).hexdigest()
    return digest[:16].upper()


def post_event(url: str, token: str, payload: dict) -> None:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        body = res.read().decode()
        print(f"  -> ingest {res.status}: {body[:120]}")


def main() -> None:
    url = os.environ.get("INGEST_URL")
    token = os.environ.get("ACOUSTIC_INGEST_TOKEN")
    lat, lng = os.environ.get("NODE_LAT"), os.environ.get("NODE_LNG")
    if not url or not token:
        sys.exit("Set INGEST_URL and ACOUSTIC_INGEST_TOKEN first.")
    if not lat or not lng:
        sys.exit("Set NODE_LAT and NODE_LNG (the app provisions this node from them).")

    import sounddevice as sd
    import tensorflow as tf

    interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
    in_idx = interpreter.get_input_details()[0]["index"]
    out_idx = interpreter.get_output_details()[0]["index"]
    n_samples = int(SAMPLE_RATE * WINDOW_S)
    interpreter.resize_tensor_input(in_idx, [n_samples])
    interpreter.allocate_tensors()

    chainsaw_threshold = load_threshold()
    thresholds = {"chainsaw": chainsaw_threshold, "heavy_vehicle": HEAVY_VEHICLE_THRESHOLD}
    dev_eui = derive_dev_eui()
    location = {"lat": float(lat), "lng": float(lng)}
    print(f"node {dev_eui} at {location}, chainsaw threshold {chainsaw_threshold:.3f}")
    print(f"listening in {WINDOW_S:.0f}s windows; Ctrl-C to stop")

    streak: dict[str, int] = {"chainsaw": 0, "heavy_vehicle": 0}
    last_sent: dict[str, float] = {"chainsaw": 0.0, "heavy_vehicle": 0.0}
    f_cnt = int(time.time()) % 100_000  # monotonic-enough frame counter for dedup

    while True:
        audio = sd.rec(n_samples, samplerate=SAMPLE_RATE, channels=1, dtype="float32")
        sd.wait()
        wav = np.clip(audio[:, 0], -1.0, 1.0)

        interpreter.set_tensor(in_idx, wav)
        interpreter.invoke()
        probs = interpreter.get_tensor(out_idx)
        p = dict(zip(CLASSES, (float(x) for x in probs)))
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        print(f"[{ts}] chainsaw {p['chainsaw']:.2f}  heavy_vehicle {p['heavy_vehicle']:.2f}  other {p['other']:.2f}")

        for cls, threshold in thresholds.items():
            if p[cls] < threshold:
                streak[cls] = 0
                continue
            streak[cls] += 1
            if streak[cls] < CONSECUTIVE_REQUIRED or time.time() - last_sent[cls] < COOLDOWN_S:
                continue
            f_cnt += 1
            payload = {
                "devEui": dev_eui,
                "eventClass": cls,
                "confidence": round(p[cls], 3),
                "detectedAt": datetime.now(timezone.utc).isoformat(),
                "location": location,
                "fCnt": f_cnt,
                "gatewayId": f"gateway-{socket.gethostname()}",
            }
            print(f"  {cls} confirmed ({streak[cls]} windows), posting")
            try:
                post_event(url, token, payload)
                last_sent[cls] = time.time()
                streak[cls] = 0
            except Exception as err:  # network hiccup: keep listening, retry next hit
                print(f"  ingest failed, will retry on next detection: {err}")


if __name__ == "__main__":
    main()
