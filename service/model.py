"""The model — deliberately the boring, explainable choice.

One sentence for a judge: "a U-Net with an ImageNet-pretrained ResNet-34 encoder
that outputs, for every 10 m pixel, the probability it was forest."

10 input channels (6 Sentinel-2 bands + NDVI + NDMI + Sentinel-1 VV + VH), 1 output
channel (a forest logit). No attention, no bespoke fusion — ML.md's rule, because a
bespoke design is a liability to defend. `segmentation-models-pytorch` adapts the
ImageNet-pretrained 3-channel stem to 10 channels; the deeper pretrained weights are
reused unchanged. That is the "pretrained where the channel count allows" compromise.
"""
from __future__ import annotations

import segmentation_models_pytorch as smp
import torch.nn as nn


def build_model(
    in_channels: int = 10,
    encoder_name: str = "resnet34",
    encoder_weights: str | None = "imagenet",
) -> nn.Module:
    return smp.Unet(
        encoder_name=encoder_name,
        encoder_weights=encoder_weights,
        in_channels=in_channels,
        classes=1,
        activation=None,  # raw logits; apply sigmoid at inference for probability
    )
