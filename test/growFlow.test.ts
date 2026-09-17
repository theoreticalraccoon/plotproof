/**
 * The finished /grow flow. Run:
 *   node --experimental-strip-types test/growFlow.test.ts
 *
 * Covers the properties the final implementation is supposed to guarantee and
 * that nothing else can check: the evidence boundaries, the action hierarchy,
 * plot-selection persistence, and the rule that no engineering identifier
 * reaches a farmer's screen in any of the three languages.
 *
 * What it deliberately does NOT do is re-test the irrigation or risk
 * mathematics — those have their own suites and were not touched.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAdvisory } from "../lib/grow/tea/evidence.ts";
import { decide } from "../lib/grow/tea/predict.ts";
import {
  fallbackLang,
  localisedClassName,
  renderEvidence,
  resolveSlots,
} from "../lib/grow/tea/display.ts";
import { resolvePlotId } from "../lib/grow/selection.ts";
import { hasTranslation, t, LANGS, type Lang } from "../lib/i18n/strings.ts";
import { crossDatasetDeclineRate } from "../lib/grow/tea/card.ts";
import type { TeaModelCard } from "../lib/grow/tea/types.ts";
import type { DiseaseRisk, IrrigationAdvice, TeaDisease } from "../lib/grow/types.ts";

const card = JSON.parse(
  readFileSync(new URL("../public/models/tea-disease-mnv3s-card.json", import.meta.url), "utf8"),
) as TeaModelCard;

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const LANG_CODES = LANGS.map((l) => l.code);
const KEYS = card.taxonomy.classes.map((c) => c.key);

function logitsFor(key: string, margin: number): number[] {
  return KEYS.map((k) => (k === key ? margin : 0));
}

function risk(disease: TeaDisease, band: "low" | "moderate" | "high", score: number): DiseaseRisk {
  return { disease, score, band, drivers: [], favourableDays: band === "low" ? 1 : 9, windowDays: 14 };
}

function irrigation(
  anchorSource: IrrigationAdvice["anchorSource"],
  verdict: IrrigationAdvice["verdict"] = "water_soon",
): IrrigationAdvice {
  return {
    verdict,
    reasonKey: `irrigation_reason_${verdict}`,
    reasonSlots: { pct: 62 },
    recommendedMm: 12,
    recommendedLitres: 120_000,
    tawMm: 140,
    rawMm: 56,
    balance: [],
    anchorSource,
    sensorCorrected: anchorSource === "sensor",
  };
}

const OBSERVED = "2026-09-16";

// ================= no engineering identifier reaches the screen ===========

/**
 * Any run of 3+ lowercase/digit characters joined by underscores, i.e. the
 * shape of every enum key in this codebase (`blister_blight`, `water_now`,
 * `risk_band_high`). If one survives into a rendered sentence, a farmer is
 * reading source code.
 */
const IDENTIFIER = /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/;

/** An interpolation slot that was never filled, e.g. a literal `{pct}`. */
const SLOT = /\{[a-z]+\}/;

test("no evidence row leaks a raw identifier, in any language", () => {
  const scenarios = [
    // Confident fungal class whose own pressure is low while another is high:
    // exercises the conflict row, which carried `blister_blight` verbatim.
    {
      prediction: decide(logitsFor("brown_blight", 40), card),
      risks: [risk("brown_blight", "low", 0.1), risk("blister_blight", "high", 0.8)],
      irrigation: irrigation("sensor"),
    },
    // Pest class: no pathogen prior exists.
    {
      prediction: decide(logitsFor("red_spider_mite", 40), card),
      risks: [risk("blister_blight", "moderate", 0.5)],
      irrigation: irrigation("grid", "water_now"),
    },
    // Healthy under pressure.
    {
      prediction: decide(logitsFor("healthy", 40), card),
      risks: [risk("grey_blight", "high", 0.9)],
      irrigation: irrigation("balance", "no_action"),
    },
    // Abstained: the standalone environmental row.
    {
      prediction: decide(logitsFor("red_rust", 0.3), card),
      risks: [risk("brown_blight", "moderate", 0.6)],
      irrigation: irrigation("grid", "waterlogged"),
    },
    // Model error: no image verdict at all.
    {
      prediction: { state: "error", reason: "load_failed" } as const,
      risks: [risk("blister_blight", "high", 0.9)],
      irrigation: irrigation("sensor"),
    },
  ];

  for (const s of scenarios) {
    const advisory = buildAdvisory({ ...s, observedThrough: OBSERVED });
    for (const lang of LANG_CODES) {
      for (const e of advisory.evidence) {
        const text = renderEvidence(lang, e);
        assert.ok(
          !IDENTIFIER.test(text),
          `[${lang}] ${e.messageKey} rendered an identifier: ${text}`,
        );
      }
      const action = t(lang, advisory.actionKey, advisory.actionSlots);
      assert.ok(!IDENTIFIER.test(action), `[${lang}] action leaked: ${action}`);
    }
  }
});

test("every translatable slot resolves to real prose, never back to its key", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 40), card),
    risks: [risk("brown_blight", "low", 0.1), risk("blister_blight", "high", 0.8)],
    irrigation: irrigation("sensor"),
    observedThrough: OBSERVED,
  });
  let checked = 0;
  for (const e of advisory.evidence) {
    for (const name of e.translatedSlots ?? []) {
      for (const lang of LANG_CODES) {
        const resolved = resolveSlots(lang, e.slots, e.translatedSlots)[name];
        assert.notEqual(resolved, e.slots[name], `[${lang}] ${name} did not resolve`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, "expected at least one translatable slot to exist");
});

// ================= evidence boundaries ===================================

test("weather never rewrites the class, and the disagreement is reported", () => {
  const prediction = decide(logitsFor("brown_blight", 40), card);
  assert.equal(prediction.state, "confident");
  const advisory = buildAdvisory({
    prediction,
    risks: [risk("brown_blight", "low", 0.05), risk("blister_blight", "high", 0.92)],
    irrigation: irrigation("grid"),
    observedThrough: OBSERVED,
  });
  // The class is untouched...
  assert.equal(advisory.prediction, prediction);
  assert.equal(
    advisory.prediction.state === "confident" ? advisory.prediction.classKey : null,
    "brown_blight",
  );
  // ...and the conflict is stated rather than resolved.
  assert.equal(advisory.conflict, true);
  assert.equal(advisory.actionKey, "tea_action_conflict");
  assert.ok(advisory.evidence.some((e) => e.messageKey === "tea_ev_env_conflict"));
});

test("a pest class gets no pathogen prior", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("helopeltis", 40), card),
    risks: [risk("blister_blight", "high", 0.95)],
    irrigation: null,
    observedThrough: OBSERVED,
  });
  assert.ok(advisory.evidence.some((e) => e.messageKey === "tea_ev_env_no_model_pest"));
  // And no fungal window is attached to it under any other message.
  assert.equal(advisory.evidence.some((e) => e.messageKey === "tea_ev_env_supports"), false);
});

test("the soil row names its evidence tier and never merges into the disease case", () => {
  const tiers = [
    ["sensor", "tea_ev_soil_measured", "sensor"],
    ["grid", "tea_ev_soil_modelled", "weather"],
    ["balance", "tea_ev_soil_balance", "weather"],
  ] as const;
  for (const [anchor, key, source] of tiers) {
    const advisory = buildAdvisory({
      prediction: decide(logitsFor("healthy", 40), card),
      risks: [],
      irrigation: irrigation(anchor),
      observedThrough: OBSERVED,
    });
    const row = advisory.evidence.find((e) => e.messageKey === key);
    assert.ok(row, `${anchor} tier should emit ${key}`);
    assert.equal(row.source, source);
    assert.equal(row.stance, "observation");
  }
});

test("missing data stays missing: no weather means no environmental claim", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 40), card),
    risks: [],
    irrigation: null,
    observedThrough: null,
  });
  // One image row and nothing else. A zero-score risk would be an invention.
  assert.deepEqual(
    advisory.evidence.map((e) => e.source),
    ["image"],
  );
  assert.equal(advisory.conflict, false);
});

// ================= action hierarchy ======================================

test("the action reflects the evidence actually available", () => {
  const cases: [string, ReturnType<typeof buildAdvisory>][] = [
    [
      "tea_action_confirm",
      buildAdvisory({
        prediction: decide(logitsFor("brown_blight", 40), card),
        risks: [risk("brown_blight", "high", 0.8)],
        irrigation: irrigation("sensor"),
        observedThrough: OBSERVED,
      }),
    ],
    [
      "tea_action_conflict",
      buildAdvisory({
        prediction: decide(logitsFor("brown_blight", 40), card),
        risks: [risk("brown_blight", "low", 0.05), risk("blister_blight", "high", 0.9)],
        irrigation: irrigation("sensor"),
        observedThrough: OBSERVED,
      }),
    ],
    [
      // Uncertain image under concerning conditions must NOT diagnose from
      // weather. It asks for a better photo; the pressure is reported separately.
      "tea_action_retake",
      buildAdvisory({
        prediction: decide(logitsFor("blister_blight", 0.3), card),
        risks: [risk("blister_blight", "high", 0.95)],
        irrigation: irrigation("grid"),
        observedThrough: OBSERVED,
      }),
    ],
    [
      "tea_action_error",
      buildAdvisory({
        prediction: { state: "error", reason: "load_failed" },
        risks: [risk("blister_blight", "high", 0.95)],
        irrigation: irrigation("grid"),
        observedThrough: OBSERVED,
      }),
    ],
    [
      "tea_action_healthy",
      buildAdvisory({
        prediction: decide(logitsFor("healthy", 40), card),
        risks: [risk("blister_blight", "low", 0.05)],
        irrigation: null,
        observedThrough: OBSERVED,
      }),
    ],
    [
      // Healthy leaf, high pressure: never "you are disease-free".
      "tea_action_healthy_watch",
      buildAdvisory({
        prediction: decide(logitsFor("healthy", 40), card),
        risks: [risk("blister_blight", "high", 0.95)],
        irrigation: null,
        observedThrough: OBSERVED,
      }),
    ],
  ];
  for (const [expected, advisory] of cases) assert.equal(advisory.actionKey, expected);
});

test("an uncertain image still reports environmental pressure, without naming a diagnosis", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("blister_blight", 0.3), card),
    risks: [risk("blister_blight", "high", 0.95)],
    irrigation: irrigation("grid"),
    observedThrough: OBSERVED,
  });
  assert.equal(advisory.prediction.state, "uncertain");
  // The pressure row exists...
  assert.ok(advisory.evidence.some((e) => e.messageKey === "tea_ev_env_standalone"));
  // ...and the image row explicitly declines rather than leaning on it.
  assert.ok(advisory.evidence.some((e) => e.messageKey === "tea_ev_image_uncertain"));
  // The class the model leaned toward must not appear in any rendered sentence.
  for (const lang of LANG_CODES) {
    const rendered = advisory.evidence.map((e) => renderEvidence(lang, e)).join(" ");
    assert.ok(!/Blister blight/i.test(rendered.replace(t(lang, "risk_disease_blister_blight"), "")));
  }
});

test("healthy is never phrased as a guarantee", () => {
  for (const lang of LANG_CODES) {
    for (const key of ["tea_action_healthy", "tea_action_healthy_watch"]) {
      const s = t(lang, key).toLowerCase();
      for (const forbidden of ["disease-free", "guarantee", "no disease", "healthy plot"]) {
        assert.ok(!s.includes(forbidden), `[${lang}] ${key} implies certainty: ${s}`);
      }
    }
  }
});

// ================= cross-dataset limitation ==============================

test("blister blight and red rust are never marked externally validated", () => {
  for (const key of ["blister_blight", "red_rust"]) {
    const p = decide(logitsFor(key, 40), card);
    assert.equal(p.state, "confident");
    assert.equal(
      p.state === "confident" ? p.crossDatasetValidated : true,
      false,
      `${key} must not claim cross-dataset validation`,
    );
  }
});

// ================= plot selection ========================================

test("plot selection survives navigation and degrades honestly", () => {
  const plots = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(resolvePlotId(plots, "b"), "b", "a remembered plot wins");
  assert.equal(resolvePlotId(plots, null), "a", "no memory falls back to the first");
  assert.equal(resolvePlotId(plots, "gone"), "a", "a deleted plot falls back, not to nothing");
  assert.equal(resolvePlotId([], "b"), null, "an empty list never fabricates an id");
});

// ================= i18n completeness =====================================

/**
 * Keys the finished flow renders as labels, states, errors, buttons, names or
 * accessible text. These must exist in every language: falling back to English
 * for a BUTTON is a different thing from falling back for an advisory sentence,
 * which is disclosed on screen and deliberate.
 */
const MUST_TRANSLATE = [
  "grow_title", "grow_lede", "grow_pick_plot", "grow_no_plots", "grow_no_plots_cta",
  "grow_setup_title", "grow_save_profile", "grow_edit_profile", "grow_irrigated",
  "grow_needs_profile", "grow_needs_profile_cta", "grow_disease_tea_only",
  "grow_crop_tea", "grow_crop_rubber", "grow_crop_coconut", "grow_crop_cinnamon",
  "grow_soil_sand", "grow_soil_sandy_loam", "grow_soil_loam", "grow_soil_clay_loam", "grow_soil_clay",
  "weather_title", "weather_loading", "weather_unavailable", "weather_cached", "weather_retry",
  "weather_grid_note", "weather_observed_through", "weather_rain_7d", "weather_temp_mean",
  "weather_wetness", "weather_sunshine",
  "irrigation_title", "irrigation_no_action", "irrigation_water_soon", "irrigation_water_now",
  "irrigation_waterlogged", "irrigation_anchor_sensor", "irrigation_anchor_grid",
  "irrigation_anchor_balance", "irrigation_taw_label", "irrigation_raw_label",
  "irrigation_mm", "irrigation_mm_used", "irrigation_method",
  "risk_title", "risk_lede", "risk_band_low", "risk_band_moderate", "risk_band_high",
  "risk_days", "risk_why", "risk_basis", "risk_not_diagnosis", "risk_check_leaves",
  "risk_no_spray_advice", "risk_caveats_title",
  "risk_disease_blister_blight", "risk_disease_brown_blight", "risk_disease_grey_blight",
  "tea_title", "tea_lede", "tea_take_photo", "tea_formats", "tea_analyse", "tea_analysing",
  "tea_analysing_note", "tea_retake", "tea_check_another", "tea_try_again",
  "tea_preview_alt", "tea_preview_note",
  "tea_section_field", "tea_section_leaf", "tea_section_conditions", "tea_section_why",
  "tea_why_lede", "tea_kind_measured", "tea_kind_estimated", "tea_kind_calculated",
  "tea_kind_inferred", "tea_src_image", "tea_src_environment", "tea_src_sensor", "tea_src_weather",
  "tea_state_uncertain", "tea_state_error", "tea_uncertain_body", "tea_photo_tips_title",
  "tea_confidence", "tea_confidence_caveat", "tea_model_version", "tea_not_cross_validated",
  "tea_other_possibilities", "tea_limitations_title", "tea_no_pesticide", "tea_crop_unsupported",
  "tea_error_no_artifact", "tea_error_load_failed", "tea_error_bad_image",
  "tea_error_inference_failed", "tea_error_still_useful", "tea_guidance_in_english",
  "tea_action_title",
];

test("every label, state, error and name is translated in all three languages", () => {
  const missing: string[] = [];
  for (const lang of LANG_CODES) {
    for (const key of MUST_TRANSLATE) {
      // t() returns the key itself when nothing matches; for si/ta it returns
      // the English string when only English exists. Both are caught by
      // comparing against English for the non-English languages.
      const v = t(lang, key);
      if (v === key) missing.push(`${lang}:${key} (absent everywhere)`);
      else if (lang !== "en" && v === t("en", key)) missing.push(`${lang}:${key} (English fallback)`);
    }
  }
  assert.deepEqual(missing, [], `untranslated: ${missing.join(", ")}`);
});

test("no rendered string is left with an unfilled {slot}", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 40), card),
    risks: [risk("brown_blight", "low", 0.1), risk("blister_blight", "high", 0.8)],
    irrigation: irrigation("sensor"),
    observedThrough: OBSERVED,
  });
  for (const lang of LANG_CODES) {
    for (const e of advisory.evidence) {
      const s = renderEvidence(lang, e);
      assert.ok(!SLOT.test(s), `[${lang}] unfilled slot in ${e.messageKey}: ${s}`);
    }
    const action = t(lang, advisory.actionKey, advisory.actionSlots);
    assert.ok(!SLOT.test(action), `[${lang}] unfilled slot in action: ${action}`);
  }
});

// ================= class names ===========================================

test("class names localise where reviewed and fall back to the card otherwise", () => {
  for (const c of card.taxonomy.classes) {
    // English always comes from the card: the dictionary deliberately has no
    // English tea_class_* entry, so the card stays the single source of truth.
    assert.equal(localisedClassName("en", c.key, c.displayName), c.displayName);
    for (const lang of ["si", "ta"] as Lang[]) {
      const name = localisedClassName(lang, c.key, c.displayName);
      assert.notEqual(name, `tea_class_${c.key}`, `${lang} leaked the key for ${c.key}`);
      assert.ok(name.length > 0);
    }
  }
});

// ================= abstention is explained, not just enforced ============

test("the published decline rate is derived from the card's worst cross-dataset set", () => {
  const rate = crossDatasetDeclineRate(card);
  assert.ok(rate !== null, "the published card must carry coverage_by_test_set");
  const cov = card.abstention.coverage_by_test_set!;
  const crossCoverages = Object.entries(cov)
    .filter(([n]) => /cross-dataset/i.test(n))
    .map(([, v]) => v.coverage);
  assert.ok(crossCoverages.length >= 1);
  // The WORST cross-dataset set, not an average, and never the in-distribution
  // one — which answers 95% of the time and would flatter the figure away.
  assert.equal(rate, 1 - Math.min(...crossCoverages));
  assert.ok(rate! > 0.5, "on unseen farms the model declines more often than it answers");
  const inDist = Object.entries(cov).find(([n]) => !/cross-dataset/i.test(n));
  if (inDist) assert.ok(1 - inDist[1].coverage < rate!);
});

test("a card without coverage yields no rate rather than a fabricated one", () => {
  const stripped = { ...card, abstention: { ...card.abstention, coverage_by_test_set: undefined } };
  assert.equal(crossDatasetDeclineRate(stripped), null);
  const empty = { ...card, abstention: { ...card.abstention, coverage_by_test_set: {} } };
  assert.equal(crossDatasetDeclineRate(empty), null);
});

test("the abstention explanation frames declining as caution, not failure", () => {
  for (const lang of LANG_CODES) {
    const s = t(lang, "tea_uncertain_expected", { pct: 65 });
    assert.ok(s.includes("65"), `[${lang}] the rate must appear`);
    assert.ok(!SLOT.test(s), `[${lang}] unfilled slot: ${s}`);
  }
  // English is the one whose sense we can assert here.
  const en = t("en", "tea_uncertain_expected", { pct: 65 }).toLowerCase();
  assert.ok(en.includes("often"), "must say this is expected, not exceptional");
  assert.ok(/not a fault|careful/.test(en), "must say it is caution rather than breakage");
});

// ================= English fallbacks are marked, not hidden ==============

test("knowingly-English text is marked lang=en for screen readers", () => {
  // An advisory sentence has no si/ta entry by policy, so a Sinhala page renders
  // English. Unmarked, a Sinhala voice pronounces it — WCAG 3.1.2.
  assert.equal(hasTranslation("si", "tea_action_confirm"), false, "policy: stays English");
  assert.deepEqual(fallbackLang("si", "tea_action_confirm"), { lang: "en" });
  assert.deepEqual(fallbackLang("ta", "tea_action_confirm"), { lang: "en" });
  // A translated string must NOT be mislabelled as English.
  assert.equal(hasTranslation("si", "tea_state_uncertain"), true);
  assert.deepEqual(fallbackLang("si", "tea_state_uncertain"), {});
  // English pages never carry the attribute at all.
  assert.deepEqual(fallbackLang("en", "tea_action_confirm"), {});
});

test("every evidence string is either translated or marked, never neither", () => {
  const advisory = buildAdvisory({
    prediction: decide(logitsFor("brown_blight", 40), card),
    risks: [risk("brown_blight", "low", 0.1), risk("blister_blight", "high", 0.8)],
    irrigation: irrigation("sensor"),
    observedThrough: OBSERVED,
  });
  for (const lang of ["si", "ta"] as Lang[]) {
    for (const e of advisory.evidence) {
      const marked = fallbackLang(lang, e.messageKey).lang === "en";
      const translated = hasTranslation(lang, e.messageKey);
      assert.ok(marked !== translated, `[${lang}] ${e.messageKey}: marking must match reality`);
    }
  }
});

// ================= no dead i18n keys ====================================

test("retired keys are gone from every dictionary", () => {
  const retired = [
    "grow_area",
    "irrigation_anchor_label",
    "tea_crop_unsupported_short",
    "tea_evidence_title",
    "tea_state_confident",
  ];
  for (const dead of retired) {
    for (const lang of LANG_CODES) {
      assert.equal(hasTranslation(lang, dead), false, `[${lang}] ${dead} should be retired`);
    }
  }
});

test("the source label names a source, not the kind of claim", () => {
  // "Measured" as the sensor SOURCE label rendered as "Measured · measured here"
  // beside the kind chip. The source says where a line came from, the kind says
  // what sort of claim it is, and neither should repeat the other.
  for (const lang of LANG_CODES) {
    assert.notEqual(
      t(lang, "tea_src_sensor").toLowerCase(),
      t(lang, "tea_kind_measured").toLowerCase(),
      `[${lang}] source and kind labels must not be the same word`,
    );
  }
});

console.log(`\n${passed} passed`);
