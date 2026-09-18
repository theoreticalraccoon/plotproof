"use client";

/**
 * Which sale is open, a way to switch, and a way to start the next one.
 *
 * Shown at the top of both /sell and /documents, so the officer always knows
 * WHICH consignment a document belongs to — the old app had one implicit sale
 * and no way to tell.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cloud, CloudOff, Loader2, Plus, Trash2 } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { isSaleComplete, saleTitle } from "@/lib/sale/model";
import {
  createSale,
  deleteSale,
  selectSale,
  useSaleBook,
  useSyncState,
} from "@/lib/sale/store";
import type { Sale } from "@/lib/sale/types";

export default function SaleBar({ sale, lang }: { sale: Sale | null; lang: Lang }) {
  const book = useSaleBook();
  const sync = useSyncState();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close the list on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex flex-wrap items-center gap-2" ref={ref}>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] border px-4 text-left"
          style={{ borderColor: "var(--glass-hairline)", background: "var(--bg-0)" }}
        >
          <span className="min-w-0">
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] faint">
              {t(lang, "sale_current")} · {book.sales.length}
            </span>
            <span className="block truncate text-[0.95rem] font-medium">
              {sale ? saleTitle(sale) : t(lang, "sale_none")}
            </span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className="shrink-0 faint" />
        </button>

        {open && (
          <ul
            role="listbox"
            aria-label={t(lang, "sale_switch")}
            className="glass-card absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] overflow-auto p-1.5"
          >
            {book.sales.map((s) => {
              const current = s.id === sale?.id;
              return (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    role="option"
                    aria-selected={current}
                    onClick={() => {
                      selectSale(s.id);
                      setOpen(false);
                    }}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-3 text-left"
                    style={{ background: current ? "var(--accent-soft)" : undefined }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.9rem]">{saleTitle(s)}</span>
                      <span className="block text-[0.72rem] faint">
                        {s.numbers.invoice} · {new Date(s.updatedAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-[0.7rem] font-medium"
                      style={{ color: isSaleComplete(s) ? "var(--accent)" : "var(--warn)" }}
                    >
                      {t(lang, isSaleComplete(s) ? "sale_ready" : "sale_draft")}
                    </span>
                  </button>
                  {confirmDelete === s.id ? (
                    <button
                      type="button"
                      className="min-h-[44px] rounded-lg px-2.5 text-[0.75rem] font-semibold"
                      style={{ color: "var(--danger)" }}
                      onClick={() => {
                        deleteSale(s.id);
                        setConfirmDelete(null);
                      }}
                    >
                      {t(lang, "sale_delete_confirm")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg faint hover:opacity-100"
                      aria-label={t(lang, "sale_delete_named", { name: saleTitle(s) })}
                      onClick={() => setConfirmDelete(s.id)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary min-h-[48px] inline-flex items-center gap-2"
        onClick={() => createSale({ carryForward: true })}
      >
        <Plus size={16} aria-hidden="true" />
        {t(lang, "sale_new")}
      </button>

      <SyncBadge state={sync} lang={lang} />
    </div>
  );
}

function SyncBadge({ state, lang }: { state: ReturnType<typeof useSyncState>; lang: Lang }) {
  const map = {
    local: { Icon: CloudOff, key: "sale_sync_local", color: "var(--fg-faint)" },
    saving: { Icon: Loader2, key: "sale_sync_saving", color: "var(--fg-faint)" },
    saved: { Icon: Cloud, key: "sale_sync_saved", color: "var(--accent)" },
    failed: { Icon: CloudOff, key: "sale_sync_failed", color: "var(--warn)" },
  }[state];
  return (
    <span
      className="inline-flex min-h-[48px] items-center gap-1.5 text-[0.75rem]"
      style={{ color: map.color }}
      role="status"
      aria-live="polite"
      title={t(lang, `${map.key}_detail`)}
    >
      <map.Icon size={14} aria-hidden="true" className={state === "saving" ? "animate-spin" : undefined} />
      {t(lang, map.key)}
    </span>
  );
}
