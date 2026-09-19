"use client";

/** The information-asymmetry breaker. */
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { loadPrices, type CommodityPrices, type PriceIntelligence } from "@/lib/prices/types";
import { t, useLang } from "@/lib/i18n";

interface Props {
  productId: string;
  quantityKg?: number;
}

export default function PriceCard({ productId, quantityKg }: Props) {
  const lang = useLang();
  const [data, setData] = useState<PriceIntelligence | null | "loading">("loading");

  useEffect(() => {
    void loadPrices().then(setData);
  }, []);

  if (data === "loading") return null;
  if (!data) return null; // no artifact published: show nothing rather than a guess

  const key = data.productMap[productId];
  const c: CommodityPrices | undefined = key ? data.commodities[key] : undefined;
  if (!c) {
    return (
      <div className="glass p-3 text-xs muted">{t(lang, "price_none")}</div>
    );
  }

  // Staleness gate: a reference price older than 3 months must never be shown as "your price
  // today". Say what we have and that it is out of date, only.
  const [ly, lm] = c.latest.month.split("-").map(Number);
  const now = new Date();
  const ageMonths = (now.getFullYear() - ly) * 12 + (now.getMonth() + 1 - lm);
  if (ageMonths > 3) {
    return (
      <div className="glass p-3 text-xs" style={{ color: "var(--warn)" }}>
        {t(lang, "price_stale", { month: c.latest.month })}
      </div>
    );
  }

  const value = quantityKg && quantityKg > 0 ? quantityKg * c.latest.price : null;
  const next = c.forecast[0];

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2">
        <TrendingUp size={15} style={{ color: "var(--accent)" }} />
        <h2 className="text-xs font-semibold uppercase tracking-wide faint">
          {t(lang, "price_title")}
        </h2>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">
          ${c.latest.price.toFixed(2)}
          <span className="text-sm font-normal muted"> /kg</span>
        </span>
        <span className="text-sm muted">
          {c.label} · {c.latest.month}
        </span>
      </div>

      <Sparkline points={c.history.map((h) => h.price)} />

      <p className="mt-2 text-sm muted">
        {t(lang, "price_context", { pct: Math.round(c.context.pctile5y) })}
        {c.context.yoyChangePct != null &&
          ` ${t(lang, "price_yoy", {
            dir: c.context.yoyChangePct >= 0 ? "+" : "",
            yoy: c.context.yoyChangePct.toFixed(1),
          })}`}
      </p>

      {value != null && (
        <p className="mt-1.5 text-sm">
          {t(lang, "price_your_qty", {
            kg: quantityKg!,
            value: value.toLocaleString("en-US", { maximumFractionDigits: 0 }),
          })}
        </p>
      )}

      {next && (
        <p className="mt-1.5 text-xs muted tabular-nums">
          {t(lang, "price_forecast", {
            month: next.month,
            low: next.low.toFixed(2),
            high: next.high.toFixed(2),
          })}{" "}
          <span className="faint">
            ({c.model.name}, backtest MAPE {c.model.backtestMape1m}% vs naive{" "}
            {c.model.naiveMape1m}%)
          </span>
        </p>
      )}

      <p className="mt-2 text-xs faint">
        {t(lang, "price_caveat")} · {data.source.name} ({data.source.license})
      </p>
    </div>
  );
}

/** Tiny dependency-free 24-month sparkline. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 220;
  const h = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mt-1.5 block"
      aria-label="24-month price history"
      role="img"
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}
