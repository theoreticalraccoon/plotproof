# -*- coding: utf-8 -*-
"""Generate models/tea/TRANSLATION-REVIEW.md from lib/i18n/strings.ts.

    python scripts/translation_review.py            # write the file
    python scripts/translation_review.py --check    # fail if it is out of date

WHY THIS IS GENERATED: the review table has to list what the dictionary
ACTUALLY contains, and a hand-maintained copy of ~130 strings x 3 languages goes
stale the first time anyone edits a string. Generating it means the table cannot
disagree with the app, and `--check` in the regression suite means it cannot be
forgotten.

It also runs the mechanical checks a reviewer should not have to do by eye:
missing translations, interpolation-slot mismatches (a dropped `{pct}` renders a
sentence with a hole in it), and terminology drift for the terms where an
inconsistent rendering would change what a farmer understands.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
STRINGS = REPO / "lib" / "i18n" / "strings.ts"
OUT = REPO / "models" / "tea" / "TRANSLATION-REVIEW.md"

PREFIXES = ("grow_", "weather_", "irrigation_", "risk_", "tea_")
ENTRY = re.compile(r'^[ ]{2}([a-z0-9_]+):\s*(?:\n\s*)?"((?:[^"\\]|\\.)*)"\s*,', re.M)
SLOT = re.compile(r"\{([a-z]+)\}")

# Where each key appears, so a reviewer can picture the screen. Prefix match,
# longest first.
CONTEXT = [
    ("tea_action_", "Advisory - what to do next (action a farmer takes)"),
    ("tea_ev_", "Advisory - one evidence line under 'Why this advice'"),
    ("tea_error_", "Leaf assessment - error state"),
    ("tea_tip_", "Leaf assessment - photo guidance when uncertain"),
    ("tea_kind_", "Advisory - provenance chip beside an evidence line"),
    ("tea_src_", "Advisory - source label beside an evidence line"),
    ("tea_section_", "Advisory - section heading"),
    ("tea_class_", "Leaf assessment - disease/pest name (English comes from the model card)"),
    ("tea_state_", "Leaf assessment - outcome heading"),
    ("tea_uncertain", "Leaf assessment - abstention explanation"),
    ("tea_confidence", "Leaf assessment - confidence figure and its caveat"),
    ("tea_not_cross_validated", "Leaf assessment - external-validation warning (SAFETY)"),
    ("tea_no_pesticide", "Advisory - pesticide disclaimer (SAFETY)"),
    ("tea_crop_unsupported", "Leaf assessment - non-tea crop is refused"),
    ("tea_limitations", "Advisory - model card limitations"),
    ("tea_guidance_in_english", "Page header - discloses the English fallback"),
    ("tea_", "Leaf page - label, button or body copy"),
    ("risk_driver_", "Conditions - the 'why' behind a pressure score"),
    ("risk_disease_", "Conditions - disease name"),
    ("risk_band_", "Conditions - pressure band"),
    ("risk_not_diagnosis", "Conditions - pressure is not a diagnosis (SAFETY)"),
    ("risk_no_spray_advice", "Conditions - pesticide disclaimer (SAFETY)"),
    ("risk_", "Conditions - label or body copy"),
    ("irrigation_reason_", "Field status - why this watering verdict"),
    ("irrigation_anchor_", "Field status - which evidence set the soil state (HONESTY)"),
    ("irrigation_apply", "Field status - quantity to apply (ACTION)"),
    ("irrigation_", "Field status - label or verdict"),
    ("weather_", "Weather strip / field status - label or failure notice"),
    ("grow_soil_", "Profile form - soil texture option"),
    ("grow_crop_", "Profile form - crop option"),
    ("grow_", "Grow page - label, button or body copy"),
]

# Terms whose rendering must not drift between strings, because an inconsistent
# rendering changes what the farmer thinks the app is telling them.
TERMS = {
    "leaf wetness": ["weather_wetness", "risk_driver_leaf_wetness"],
    "disease pressure (not diagnosis)": ["risk_title", "risk_not_diagnosis", "risk_lede"],
    "soil sensor": ["tea_src_sensor", "irrigation_anchor_sensor"],
    "uncertain": ["tea_state_uncertain", "tea_uncertain_body", "tea_uncertain_expected"],
}


def dict_body(src: str, name: str) -> str:
    i = src.index("const %s: Dict = {" % name)
    j = src.index("\n};", i)
    return src[i:j]


def parse(src: str, name: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in ENTRY.finditer(dict_body(src, name))}


def context_for(key: str) -> str:
    for prefix, label in CONTEXT:
        if key.startswith(prefix):
            return label
    return "—"


def cell(v: str | None) -> str:
    if v is None:
        return "_(falls back to English)_"
    return v.replace("|", "\\|")


def build() -> str:
    src = STRINGS.read_text(encoding="utf-8")
    en, si, ta = (parse(src, n) for n in ("en", "si", "ta"))

    keys = sorted(
        {k for k in en if k.startswith(PREFIXES)}
        | {k for k in si if k.startswith(PREFIXES)}
        | {k for k in ta if k.startswith(PREFIXES)}
    )

    rows, slot_issues, fallbacks = [], [], []
    for k in keys:
        e, s, tm = en.get(k), si.get(k), ta.get(k)
        # A class name has no English entry ON PURPOSE: the card is the source of
        # truth for it. Say so rather than reporting a hole.
        english = e if e is not None else "_(from the model card)_"
        if s is None and tm is None and e is not None:
            fallbacks.append(k)
            continue
        for lang, val in (("si", s), ("ta", tm)):
            if val is None or e is None:
                continue
            if set(SLOT.findall(e)) != set(SLOT.findall(val)):
                slot_issues.append(
                    f"`{k}` [{lang}]: English has {sorted(set(SLOT.findall(e)))}, "
                    f"{lang} has {sorted(set(SLOT.findall(val)))}"
                )
        rows.append((k, english, cell(s), cell(tm), context_for(k)))

    out: list[str] = []
    w = out.append
    w("# Tea / GROW translation review\n")
    w("**Status: NOT REVIEWED BY A NATIVE SPEAKER.**\n")
    w(
        "Every Sinhala and Tamil string below was written by a language model and has\n"
        "had no human review. They are in the product because an untranslated button is\n"
        "worse than an imperfect one, not because their quality has been established.\n"
        "This file exists so a reviewer can work through them, and so nobody mistakes\n"
        "their presence for their correctness.\n"
    )
    w("Regenerate with `python scripts/translation_review.py`.\n")
    w("## How to review\n")
    w(
        "- **Meaning first.** A row is a failure if the Sinhala or Tamil would lead a\n"
        "  farmer to do something different from the English, even if it reads well.\n"
        "- **Rows marked (SAFETY) or (ACTION) are the priority.** Those are the\n"
        "  disclaimers and the instructions someone acts on in a field.\n"
        "- **Leave `{slots}` exactly as they are.** `{pct}`, `{disease}`, `{date}` and\n"
        "  the rest are substituted at runtime; renaming or dropping one puts a hole in\n"
        "  the sentence.\n"
        "- **Do not translate the English-fallback strings** in the list at the end\n"
        "  without reading the policy note there first.\n"
    )

    w("\n## Mechanical checks\n")
    if slot_issues:
        w("**Interpolation mismatches — these are bugs, fix before review:**\n")
        for m in slot_issues:
            w(f"- {m}")
        w("")
    else:
        w("- Interpolation slots: **all match English.**\n")
    w("- Terminology to keep consistent (a reviewer should check these read alike):\n")
    for term, ks in TERMS.items():
        present = [k for k in ks if k in si or k in ta]
        w(f"  - *{term}* — {', '.join('`%s`' % k for k in present) or 'n/a'}")

    w(f"\n## Strings to review ({len(rows)})\n")
    w("| key | English | Sinhala | Tamil | context | native review needed |")
    w("| --- | --- | --- | --- | --- | --- |")
    for k, e, s, tm, ctx in rows:
        w(f"| `{k}` | {e} | {s} | {tm} | {ctx} | yes |")

    w(f"\n## Deliberately English in every language ({len(fallbacks)})\n")
    w(
        "These are **not** missing translations. Per D-016 the app does not\n"
        "machine-translate a sentence a farmer acts on: a mistranslated treatment or\n"
        "watering instruction is worse than an English one. `tea_guidance_in_english`\n"
        "tells the reader this, in their own language, at the top of the page, and the\n"
        "renderer marks these runs `lang=\"en\"` so a screen reader does not pronounce\n"
        "English with a Sinhala or Tamil voice.\n"
    )
    w("A reviewer may translate these, but only as reviewed prose, never in bulk.\n")
    w("| key | English | context |")
    w("| --- | --- | --- |")
    for k in fallbacks:
        w(f"| `{k}` | {en[k].replace('|', chr(92) + '|')} | {context_for(k)} |")

    w("")
    return "\n".join(out)


def main() -> None:
    text = build()
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != text:
            print("TRANSLATION-REVIEW.md is out of date. Run: python scripts/translation_review.py")
            sys.exit(1)
        print("TRANSLATION-REVIEW.md is current.")
        return
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
