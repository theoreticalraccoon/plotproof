"use client";

/** One field of a sale, rendered from its definition in `lib/sale/fields.ts`. */
import { useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { PRODUCTS } from "@/lib/compliance/catalog";
import { DESTINATIONS, marketFor } from "@/lib/geo/countries";
import { applyField, getPath, type FieldDef } from "@/lib/sale/fields";
import { incotermsFor } from "@/lib/sale/model";
import { updateSale } from "@/lib/sale/store";
import type { Sale } from "@/lib/sale/types";

const DEPS = { marketFor, incotermsFor };

export default function SaleField({
  def,
  sale,
  lang,
  errorKey,
  forceError,
}: {
  def: FieldDef;
  sale: Sale;
  lang: Lang;
  /** i18n key of this field's current problem, if any. */
  errorKey?: string;
  /** Show the error even if untouched (after the officer asked to see gaps). */
  forceError?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const [touched, setTouched] = useState(false);
  const value = getPath(sale, def.path);
  const set = (v: unknown) => updateSale(sale.id, (s) => applyField(s, def.path, v, DEPS));
  const showError = !!errorKey && (touched || forceError);
  const describedBy = [def.hintKey ? hintId : "", showError ? errId : ""].filter(Boolean).join(" ") || undefined;

  const label = (
    <span className="label flex items-baseline gap-1.5">
      {t(lang, def.labelKey)}
      {def.required && (
        <span aria-hidden="true" style={{ color: "var(--danger)" }}>
          *
        </span>
      )}
    </span>
  );

  const common = {
    id,
    "aria-invalid": showError || undefined,
    "aria-describedby": describedBy,
    "aria-required": def.required || undefined,
    onBlur: () => setTouched(true),
    className: "field",
  };

  let control: React.ReactNode;
  switch (def.kind) {
    case "textarea":
      control = (
        <textarea
          {...common}
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={def.placeholder}
        />
      );
      break;
    case "number":
    case "integer":
      control = (
        <NumberInput
          common={common}
          value={value as number}
          integer={def.kind === "integer"}
          onCommit={set}
        />
      );
      break;
    case "date":
      control = (
        <input {...common} type="date" value={(value as string) ?? ""} onChange={(e) => set(e.target.value)} />
      );
      break;
    case "select": {
      // Incoterms are filtered by ship mode, so the list never offers a term the mode makes
      // invalid.
      const options =
        def.path === "incoterm" ? incotermsFor(sale.shipMode) : (def.options ?? []);
      control = (
        <select {...common} value={(value as string) ?? ""} onChange={(e) => set(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {def.optionKeyPrefix ? t(lang, `${def.optionKeyPrefix}${o.toLowerCase()}`) : o}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "country":
      control = (
        <select {...common} value={(value as string) ?? ""} onChange={(e) => set(e.target.value)}>
          <option value="">{t(lang, "sale_choose_country")}</option>
          {(["EU", "UK", "US"] as const).map((m) => (
            <optgroup key={m} label={t(lang, `market_${m.toLowerCase()}`)}>
              {DESTINATIONS.filter((d) => d.market === m).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      );
      break;
    case "toggle":
      return (
        <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
            checked={!!value}
            onChange={(e) => set(e.target.checked)}
            aria-describedby={def.hintKey ? hintId : undefined}
          />
          <span>
            <span className="text-[0.92rem] font-medium">{t(lang, def.labelKey)}</span>
            {def.hintKey && (
              <span id={hintId} className="mt-0.5 block text-[0.8rem] faint">
                {t(lang, def.hintKey)}
              </span>
            )}
          </span>
        </label>
      );
    case "product":
      return (
        <fieldset className="sm:col-span-2">
          <legend className="label">
            {t(lang, def.labelKey)}{" "}
            <span aria-hidden="true" style={{ color: "var(--danger)" }}>
              *
            </span>
          </legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2" role="radiogroup">
            {PRODUCTS.map((p) => {
              const on = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set(p.id)}
                  className="flex min-h-[48px] items-center justify-between gap-3 rounded-[var(--radius-sm)] border px-3.5 py-2.5 text-left text-[0.9rem] transition-colors"
                  style={{
                    borderColor: on ? "var(--accent)" : "var(--glass-hairline)",
                    background: on ? "var(--accent-soft)" : "var(--bg-0)",
                  }}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-[0.72rem] faint">
                      HS {p.hsCode}
                      {p.eudrCovered ? ` · ${t(lang, "sale_eudr_crop")}` : ""}
                    </span>
                  </span>
                  {on && <Check size={16} aria-hidden="true" style={{ color: "var(--accent)" }} />}
                </button>
              );
            })}
          </div>
          {showError && (
            <p id={errId} className="mt-1.5 text-[0.8rem]" style={{ color: "var(--danger)" }}>
              {t(lang, errorKey!)}
            </p>
          )}
        </fieldset>
      );
    default:
      control = (
        <input
          {...common}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => set(e.target.value)}
          placeholder={def.placeholder}
        />
      );
  }

  return (
    <div className={def.wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="block">
        {label}
      </label>
      {control}
      {def.hintKey && (
        <p id={hintId} className="mt-1 text-[0.78rem] faint">
          {t(lang, def.hintKey)}
        </p>
      )}
      {showError && (
        <p id={errId} className="mt-1 text-[0.8rem]" style={{ color: "var(--danger)" }}>
          {t(lang, errorKey!)}
        </p>
      )}
    </div>
  );
}

/** A number field that lets the officer type. */
function NumberInput({
  common,
  value,
  integer,
  onCommit,
}: {
  common: Record<string, unknown>;
  value: number;
  integer: boolean;
  onCommit: (n: number) => void;
}) {
  const show = (n: number) => (n ? String(n) : "");
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);

  // Follow edits made elsewhere (the document editor, another tab) unless the officer is
  // mid-typing here.
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);

  return (
    <input
      {...common}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        (common.onBlur as () => void)?.();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (raw !== "" && !(integer ? /^\d*$/ : /^\d*\.?\d*$/).test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? 0 : Number(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
    />
  );
}
