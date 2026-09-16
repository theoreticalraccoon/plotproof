"use client";

/**
 * Two questions that set every number on the GROW page: what is growing, and
 * what the soil is.
 *
 * Kept to two because they are the only two the water balance genuinely needs
 * and cannot infer. Crop gives Kc and rooting depth (FAO-56 Table 12/22); soil
 * texture gives field capacity and wilting point (Table 19). Asking for
 * anything more would be collecting data we do not use — the same discipline
 * the four-question sell flow follows.
 *
 * Soil is a tile grid with a field test in the helper text, not a dropdown of
 * soil-science terms, because a farmer knows their soil by how it behaves in a
 * hand, not by its USDA class.
 */
import { useState } from "react";
import { t, type Lang } from "@/lib/i18n";
import type { GrowCrop, GrowProfile, SoilTexture } from "@/lib/grow/types";

const CROPS: GrowCrop[] = ["tea", "rubber", "coconut", "cinnamon"];
const SOILS: SoilTexture[] = ["sand", "sandy_loam", "loam", "clay_loam", "clay"];

export default function ProfileForm({
  plotId,
  initial,
  lang,
  onSave,
}: {
  plotId: string;
  initial: GrowProfile | null;
  lang: Lang;
  onSave: (p: GrowProfile) => void;
}) {
  const [crop, setCrop] = useState<GrowCrop>(initial?.crop ?? "tea");
  const [soil, setSoil] = useState<SoilTexture>(initial?.soilTexture ?? "loam");
  const [irrigated, setIrrigated] = useState(initial?.irrigated ?? false);

  return (
    <form
      className="glass-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          plotId,
          crop,
          soilTexture: soil,
          irrigated,
          updatedAt: new Date().toISOString(),
        });
      }}
    >
      <h2 className="text-[1.15rem] font-semibold">{t(lang, "grow_setup_title")}</h2>
      <p className="mt-2 text-[0.88rem] muted" style={{ maxWidth: "52ch" }}>
        {t(lang, "grow_setup_lede")}
      </p>

      <fieldset className="mt-5">
        <legend className="label">{t(lang, "grow_crop")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CROPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCrop(c)}
              aria-pressed={crop === c}
              className={crop === c ? "chip chip-active" : "chip"}
            >
              {t(lang, `grow_crop_${c}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">{t(lang, "grow_soil")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SOILS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSoil(s)}
              aria-pressed={soil === s}
              className={soil === s ? "chip chip-active" : "chip"}
            >
              {t(lang, `grow_soil_${s}`)}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[0.8rem] faint" style={{ maxWidth: "50ch" }}>
          {t(lang, "grow_soil_help")}
        </p>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="label">{t(lang, "grow_irrigated")}</legend>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setIrrigated(true)}
            aria-pressed={irrigated}
            className={irrigated ? "chip chip-active" : "chip"}
          >
            {t(lang, "grow_yes")}
          </button>
          <button
            type="button"
            onClick={() => setIrrigated(false)}
            aria-pressed={!irrigated}
            className={!irrigated ? "chip chip-active" : "chip"}
          >
            {t(lang, "grow_no")}
          </button>
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary mt-6">
        {t(lang, "grow_save_profile")}
      </button>
    </form>
  );
}
