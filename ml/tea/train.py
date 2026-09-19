"""Train the tea-leaf classifier. CS-D only; EWU and TLD-BD are never touched here."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from PIL import Image
from torchvision import transforms
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldsim import SPEC as FIELD_SPEC, FieldSimulator  # noqa: E402
from teadata import Taxonomy, load_csd  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "models" / "tea"

SEED = 1337
IMG_SIZE = 224
# ImageNet statistics: the backbone is pretrained, so its inputs must be normalised the way it was
# trained.
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]


def seed_everything(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(False)  # cudnn-only knob; CPU path is already deterministic


# -------------------------------------------------------------------------- transforms
# --------------------------------------------------------------------------

def build_transforms(img_size: int = IMG_SIZE) -> tuple[transforms.Compose, transforms.Compose, dict]:
    """Field-oriented augmentation for training; deterministic for evaluation."""
    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(img_size, scale=(0.55, 1.0), ratio=(0.8, 1.25)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),        # a leaf has no canonical "up"
        transforms.RandomRotation(30),
        transforms.ColorJitter(brightness=0.35, contrast=0.3, saturation=0.3, hue=0.04),
        transforms.RandomApply([transforms.GaussianBlur(3, sigma=(0.1, 1.5))], p=0.2),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.1)),  # occlusion by a finger or another leaf
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(int(img_size * 256 / 224)),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ])
    spec = {
        "image_size": img_size,
        "resize_shorter_side_to": int(img_size * 256 / 224),
        "crop": "center",
        "channel_order": "RGB",
        "scale": "divide by 255, then normalise",
        "mean": MEAN,
        "std": STD,
        "augmentation_train": [
            f"RandomResizedCrop({img_size}, scale=0.55-1.0, ratio=0.8-1.25)",
            "RandomHorizontalFlip", "RandomVerticalFlip", "RandomRotation(30)",
            "ColorJitter(brightness=0.35, contrast=0.3, saturation=0.3, hue=0.04)",
            "RandomApply(GaussianBlur(3, sigma=0.1-1.5), p=0.2)",
            "RandomErasing(p=0.15, scale=0.02-0.1)",
        ],
    }
    return train_tf, eval_tf, spec


# -------------------------------------------------------------------------- dataset
# --------------------------------------------------------------------------

class TeaDataset(Dataset):
    """Image-level view of a list of Samples."""

    def __init__(self, samples, tf, samples_per_group: int | None = None, seed: int = SEED,
                 field_sim: "FieldSimulator | None" = None, field_prob: float = 0.0):
        self.all = samples
        self.tf = tf
        self.spg = samples_per_group
        self.seed = seed
        self.items = samples
        # The field simulation (ml/tea/fieldsim.py) runs BEFORE the tensor pipeline, because it is
        # a photographic transformation of the scene, not a tensor augmentation.
        self.field_sim = field_sim
        self.field_prob = field_prob
        self.epoch = 0
        if samples_per_group:
            self.resample(0)

    def resample(self, epoch: int) -> None:
        self.epoch = epoch
        if not self.spg:
            return
        rng = random.Random(self.seed + epoch)
        by_group: dict = {}
        for s in self.all:
            by_group.setdefault((s.source_label, s.group), []).append(s)
        picked = []
        for _, members in by_group.items():
            picked.extend(members if len(members) <= self.spg else rng.sample(members, self.spg))
        rng.shuffle(picked)
        self.items = picked

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i):
        s = self.items[i]
        with Image.open(s.path) as im:
            img = im.convert("RGB")
        if self.field_sim is not None and self.field_prob > 0:
            # Seeded from (epoch, index) rather than global state: DataLoader workers each fork
            # their own RNG, and a run has to be reproducible.
            rng = random.Random((self.seed * 1_000_003) ^ (self.epoch * 7919) ^ i)
            if rng.random() < self.field_prob:
                img = self.field_sim.apply(img, rng)
        return self.tf(img), s.model_index


def build_model(num_classes: int) -> nn.Module:
    """MobileNetV3-Small, ImageNet-pretrained, new classifier head."""
    m = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    in_f = m.classifier[3].in_features
    m.classifier[3] = nn.Linear(in_f, num_classes)
    return m


@torch.no_grad()
def evaluate(model, loader, device) -> tuple[float, float, np.ndarray, np.ndarray]:
    model.eval()
    logits_all, y_all = [], []
    for x, y in loader:
        out = model(x.to(device))
        logits_all.append(out.cpu().numpy())
        y_all.append(y.numpy())
    logits = np.concatenate(logits_all)
    y = np.concatenate(y_all)
    pred = logits.argmax(1)
    acc = float((pred == y).mean())
    from sklearn.metrics import f1_score
    macro_f1 = float(f1_score(y, pred, average="macro", zero_division=0))
    return acc, macro_f1, logits, y


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", required=True)
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=48)
    ap.add_argument("--lr", type=float, default=6e-4)
    ap.add_argument("--weight-decay", type=float, default=1e-4)
    ap.add_argument("--samples-per-group", type=int, default=2)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--img-size", type=int, default=IMG_SIZE,
                    help="Training/eval resolution. Lower trades accuracy for CPU time.")
    ap.add_argument("--field-prob", type=float, default=0.5,
                    help="Fraction of training images rendered as field photographs "
                         "(ml/tea/fieldsim.py). 0 disables the simulation.")
    ap.add_argument("--field-backgrounds", type=int, default=192)
    ap.add_argument("--field-donors", type=int, default=160)
    ap.add_argument("--smoke", action="store_true", help="tiny config to prove the pipeline runs")
    ap.add_argument("--out", default=str(OUT_DIR))
    a = ap.parse_args()

    seed_everything()
    device = torch.device("cpu")
    tax = Taxonomy()
    train_tf, eval_tf, prep_spec = build_transforms(a.img_size)

    samples = load_csd(a.csd, tax)
    tr = [s for s in samples if s.split == "train"]
    va = [s for s in samples if s.split == "val"]
    assert not any(s.split == "test" for s in (tr + va)), "test data reached the training path"

    if a.smoke:
        rng = random.Random(SEED)
        # Keep whole groups even in the smoke run, so the smoke test exercises the real grouping
        # code rather than a shortcut around it.
        groups = sorted({(s.source_label, s.group) for s in tr})
        keep = set(rng.sample(groups, 120))
        tr = [s for s in tr if (s.source_label, s.group) in keep]
        vgroups = sorted({(s.source_label, s.group) for s in va})
        vkeep = set(rng.sample(vgroups, 60))
        va = [s for s in va if (s.source_label, s.group) in vkeep]
        a.epochs = 1

    # Two simulators, each with donors from its own split.
    train_sim = val_sim = None
    if a.field_prob > 0:
        t0 = time.time()
        train_sim = FieldSimulator([s.path for s in tr], size=a.img_size,
                                   backgrounds=a.field_backgrounds, donors=a.field_donors, seed=SEED)
        val_sim = FieldSimulator([s.path for s in va], size=a.img_size,
                                 backgrounds=max(32, a.field_backgrounds // 3),
                                 donors=max(32, a.field_donors // 3), seed=SEED + 1)
        print(f"field simulation: p={a.field_prob} "
              f"train donors={len(train_sim.donors)} backgrounds={len(train_sim.backgrounds)}; "
              f"val donors={len(val_sim.donors)} ({time.time() - t0:.0f}s to build)", flush=True)

    train_ds = TeaDataset(tr, train_tf, samples_per_group=a.samples_per_group,
                          field_sim=train_sim, field_prob=a.field_prob)
    val_ds = TeaDataset(va, eval_tf, samples_per_group=a.samples_per_group,
                        field_sim=val_sim, field_prob=a.field_prob)

    train_ld = DataLoader(train_ds, batch_size=a.batch_size, shuffle=True,
                          num_workers=a.workers, persistent_workers=a.workers > 0)
    val_ld = DataLoader(val_ds, batch_size=a.batch_size, shuffle=False,
                        num_workers=a.workers, persistent_workers=a.workers > 0)

    model = build_model(len(tax.active)).to(device)
    # Label smoothing slightly discourages the over-confidence that near-duplicate training data
    # invites, which matters because the model is calibrated later.
    crit = nn.CrossEntropyLoss(label_smoothing=0.05)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=a.weight_decay)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, a.epochs))

    print(f"device=cpu threads={torch.get_num_threads()} classes={tax.keys}")
    print(f"train groups={len({(s.source_label, s.group) for s in tr})} images/epoch={len(train_ds)}")
    print(f"val   groups={len({(s.source_label, s.group) for s in va})} images/epoch={len(val_ds)}")

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    ckpt_path = out / ("tea-smoke.pt" if a.smoke else "tea-mnv3s-best.pt")

    history, best = [], -1.0
    for epoch in range(a.epochs):
        train_ds.resample(epoch)
        model.train()
        t0, run, seen, correct = time.time(), 0.0, 0, 0
        for i, (x, y) in enumerate(train_ld):
            x, y = x.to(device), y.to(device)
            opt.zero_grad(set_to_none=True)
            out_logits = model(x)
            loss = crit(out_logits, y)
            loss.backward()
            opt.step()
            run += loss.item() * y.size(0)
            seen += y.size(0)
            correct += int((out_logits.argmax(1) == y).sum())
            if i % 25 == 0:
                rate = seen / max(1e-9, time.time() - t0)
                print(f"  e{epoch} {i:>4}/{len(train_ld)} loss={run/seen:.4f} "
                      f"acc={correct/seen:.4f} {rate:.0f} img/s", flush=True)
        sched.step()

        vacc, vf1, _, _ = evaluate(model, val_ld, device)
        rec = {"epoch": epoch, "train_loss": run / seen, "train_acc": correct / seen,
               "val_acc": vacc, "val_macro_f1": vf1, "seconds": round(time.time() - t0, 1),
               "lr": sched.get_last_lr()[0]}
        history.append(rec)
        print(f"  EPOCH {epoch}: train_acc={rec['train_acc']:.4f} "
              f"val_acc={vacc:.4f} val_macro_f1={vf1:.4f} ({rec['seconds']}s)", flush=True)

        # Selection on macro-F1 only. Validation is the ONLY signal used here; no test set is
        # loaded anywhere in this file.
        if vf1 > best:
            best = vf1
            torch.save({"model": model.state_dict(), "epoch": epoch, "val_macro_f1": vf1,
                        "val_acc": vacc, "classes": tax.keys, "class_ids": tax.active_ids,
                        "taxonomy_version": tax.version, "seed": SEED,
                        "preprocessing": prep_spec, "arch": "mobilenet_v3_small",
                        "field_simulation": {"probability": a.field_prob, "steps": FIELD_SPEC}
                        if a.field_prob > 0 else None}, ckpt_path)
            print(f"  saved checkpoint (best val_macro_f1={best:.4f})", flush=True)

    (out / ("train-history-smoke.json" if a.smoke else "train-history.json")).write_text(
        json.dumps({"config": vars(a), "seed": SEED, "preprocessing": prep_spec,
                    "field_simulation": {"probability": a.field_prob, "steps": FIELD_SPEC}
                    if a.field_prob > 0 else None,
                    "class_keys": tax.keys, "history": history,
                    "best_val_macro_f1": best}, indent=2), encoding="utf-8")
    print(f"\nbest val_macro_f1={best:.4f}  checkpoint={ckpt_path}")


if __name__ == "__main__":
    main()
