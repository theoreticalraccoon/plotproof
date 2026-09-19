/** The seam between the pure evidence layer and the rendered sentence. */
// Relative, and from `strings` rather than the `@/lib/i18n` barrel: the barrel is a client
// module that pulls in React, which would make this file untestable under plain Node.
import { hasTranslation, t, type Lang } from "../../i18n/strings.ts";
import type { EvidenceItem } from "./types";

/** Translate the slots that carry i18n keys, leave the rest alone. */
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

/** A disease/pest name in the reader's language, or the card's English name. */
export function localisedClassName(lang: Lang, classKey: string, cardDisplayName: string): string {
  const key = `tea_class_${classKey}`;
  const translated = t(lang, key);
  return translated === key ? cardDisplayName : translated;
}

/** Props marking a run of text that is knowingly in English on a non-English page. */
export function fallbackLang(lang: Lang, key: string): { lang?: "en" } {
  if (lang === "en") return {};
  return hasTranslation(lang, key) ? {} : { lang: "en" };
}
