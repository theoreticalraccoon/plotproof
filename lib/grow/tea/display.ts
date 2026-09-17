/**
 * The seam between the pure evidence layer and the rendered sentence.
 *
 * `lib/grow/tea/evidence.ts` never calls `t()` — it is pure so it can be tested
 * under Node — so it emits i18n keys as slot values and names them in
 * `translatedSlots`. Somebody has to resolve those before interpolation, and
 * doing it here rather than inside a component keeps it testable and keeps
 * every renderer consistent.
 */
// Relative, and from `strings` rather than the `@/lib/i18n` barrel: the barrel
// is a client module that pulls in React, which would make this file
// untestable under plain Node. `strings.ts` is a pure dictionary.
import { t, type Lang } from "../../i18n/strings.ts";
import type { EvidenceItem } from "./types";

/**
 * Translate the slots that carry i18n keys, leave the rest alone.
 *
 * A slot listed in `translatedSlots` whose key is missing from every dictionary
 * would come back as the raw key (`t()` falls back to the key itself), which is
 * exactly the identifier leak this mechanism exists to stop — so an unresolved
 * key is left visible rather than hidden, and `test/growFlow.test.ts` fails on
 * it. A silent leak is the failure mode; a loud one is a bug report.
 */
export function resolveSlots(
  lang: Lang,
  slots: Record<string, string | number>,
  translatedSlots: readonly string[] | undefined,
): Record<string, string | number> {
  if (!translatedSlots || translatedSlots.length === 0) return slots;
  const out: Record<string, string | number> = { ...slots };
  for (const name of translatedSlots) {
    const v = out[name];
    if (typeof v === "string") out[name] = t(lang, v);
  }
  return out;
}

/** One evidence row, already localised. */
export function renderEvidence(lang: Lang, e: EvidenceItem): string {
  return t(lang, e.messageKey, resolveSlots(lang, e.slots, e.translatedSlots));
}

/**
 * A disease/pest name in the reader's language, or the card's English name.
 *
 * English deliberately has NO `tea_class_*` entries: the published card is the
 * source of truth for class display names, and duplicating them into the
 * dictionary would let the two drift the first time the model is retrained. A
 * Sinhala or Tamil entry, once reviewed, overrides for that language only; with
 * none present `t()` returns the key unchanged and we fall through to the card.
 */
export function localisedClassName(lang: Lang, classKey: string, cardDisplayName: string): string {
  const key = `tea_class_${classKey}`;
  const translated = t(lang, key);
  return translated === key ? cardDisplayName : translated;
}
