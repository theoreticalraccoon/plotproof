"use client";

/** The officer's sales, on this device and, when signed in, in their account. */
import { useSyncExternalStore } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "../supabase/client";
import {
  EMPTY_BOOK,
  bookOnSignIn,
  parseBook,
  removeSale,
  upsertSale,
  type SaleBook,
} from "./collection";
import { newSale, nextSaleFrom } from "./model";
import type { Sale } from "./types";

const KEY = "plotproof.sales.v1";
const LEGACY_INTENT_KEY = "plotproof.saleIntent";
const LEGACY_STATUS_KEY = "plotproof.docStatus";
const TABLE = "user_state";

const listeners = new Set<() => void>();
let cache: SaleBook | null = null;

function read(): SaleBook {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return EMPTY_BOOK;
  try {
    cache = parseBook(JSON.parse(localStorage.getItem(KEY) ?? "null")) ?? migrateLegacy();
  } catch {
    cache = EMPTY_BOOK;
  }
  return cache;
}

// One-time carry-over from the single-intent model, so an officer who had a sale open before
// this release does not find an empty workspace.
function migrateLegacy(): SaleBook {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_INTENT_KEY) ?? "null") as {
      productId?: string;
      destination?: Sale["destination"];
      organicClaim?: boolean;
      createdAt?: string;
    } | null;
    if (!raw?.productId) return EMPTY_BOOK;
    const sale = newSale(new Date(raw.createdAt ?? Date.now()), crypto.randomUUID());
    sale.productId = raw.productId;
    if (raw.destination) sale.destination = raw.destination;
    sale.organic = !!raw.organicClaim;
    return { owner: null, currentId: sale.id, sales: [sale] };
  } catch {
    return EMPTY_BOOK;
  }
}

function write(next: SaleBook, opts: { push?: boolean } = {}): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem(LEGACY_INTENT_KEY);
    localStorage.removeItem(LEGACY_STATUS_KEY);
  } catch {
    // Storage full or disabled. The in-memory copy keeps this tab working; the
    // sync badge will show it is not saved.
  }
  listeners.forEach((fn) => fn());
  if (opts.push !== false) schedulePush();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  // Another tab edited the same sales: pick it up rather than overwrite it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

const SERVER_BOOK: SaleBook = EMPTY_BOOK;

export function useSaleBook(): SaleBook {
  return useSyncExternalStore(subscribe, read, () => SERVER_BOOK);
}

export function useCurrentSale(): Sale | null {
  const book = useSaleBook();
  return book.sales.find((s) => s.id === book.currentId) ?? null;
}

// --- mutations ---------------------------------------------------------------

/** Start a sale. Carries the exporter forward from the current one if any. */
export function createSale(opts: { carryForward?: boolean } = {}): Sale {
  const book = read();
  const prev = book.sales.find((s) => s.id === book.currentId);
  const id = crypto.randomUUID();
  const sale = opts.carryForward && prev ? nextSaleFrom(prev, new Date(), id) : newSale(new Date(), id);
  write({ ...upsertSale(book, sale), currentId: id });
  return sale;
}

export function selectSale(id: string): void {
  const book = read();
  if (book.sales.some((s) => s.id === id)) write({ ...book, currentId: id }, { push: true });
}

// Apply an edit to a sale. Every document, the questionnaire and the sale list re-render from
// the one subscription.
export function updateSale(id: string, edit: (s: Sale) => Sale): void {
  const book = read();
  const existing = book.sales.find((s) => s.id === id);
  if (!existing) return;
  const next = { ...edit(existing), id, updatedAt: new Date().toISOString() };
  write(upsertSale(book, next));
}

export function deleteSale(id: string): void {
  write(removeSale(read(), id));
}

// --- account sync --------------------------------------------------------------

export type SyncState = "local" | "saving" | "saved" | "failed";
const syncListeners = new Set<() => void>();
let syncState: SyncState = "local";

function setSync(s: SyncState) {
  syncState = s;
  syncListeners.forEach((fn) => fn());
}

/** Whether the last change reached the account. Shown next to the sale. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      syncListeners.add(fn);
      return () => syncListeners.delete(fn);
    },
    () => syncState,
    () => "local" as SyncState,
  );
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(): void {
  if (!isSupabaseConfigured()) return;
  if (pushTimer) clearTimeout(pushTimer);
  setSync("saving");
  pushTimer = setTimeout(() => void pushNow(), 700);
}

async function pushNow(): Promise<void> {
  const sb = await getSupabaseBrowser();
  if (!sb) return setSync("local");
  const { data } = await sb.auth.getUser();
  if (!data.user) return setSync("local");
  const book = read();
  const { error } = await sb.from(TABLE).upsert({
    user_id: data.user.id,
    sales: { currentId: book.currentId, sales: book.sales },
    updated_at: new Date().toISOString(),
  });
  // A missing `sales` column (migration 0004 not applied) lands here.
  setSync(error ? "failed" : "saved");
  if (!error && book.owner !== data.user.id) {
    cache = { ...book, owner: data.user.id };
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      /* non-fatal */
    }
  }
}

/** Called once per sign-in by the auth provider. */
export async function syncSalesOnSignIn(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = await getSupabaseBrowser();
  if (!sb) return;
  let remote: SaleBook | null = null;
  try {
    const { data, error } = await sb.from(TABLE).select("sales").eq("user_id", userId).maybeSingle();
    if (!error && data?.sales) remote = parseBook({ owner: userId, ...(data.sales as object) });
  } catch {
    remote = null;
  }
  const merged = bookOnSignIn(read(), remote, userId);
  write(merged, { push: false });
  // Push back if this device held newer sales than the account.
  schedulePush();
}

/** On sign-out: the next person on this device starts with nothing. */
export function clearLocalSales(): void {
  cache = EMPTY_BOOK;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_INTENT_KEY);
    localStorage.removeItem(LEGACY_STATUS_KEY);
  } catch {
    /* non-fatal */
  }
  listeners.forEach((fn) => fn());
  setSync("local");
}
