/** Pure operations over the set of sales. */
import { normalizeSale } from "./model.ts";
import type { Sale } from "./types";

export interface SaleBook {
  /** Supabase user id the local copy belongs to; null when signed out. */
  owner: string | null;
  currentId: string | null;
  sales: Sale[];
}

export const EMPTY_BOOK: SaleBook = { owner: null, currentId: null, sales: [] };

/** Newest first, the order the sale list shows. */
export function sortSales(sales: Sale[]): Sale[] {
  return [...sales].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertSale(book: SaleBook, sale: Sale): SaleBook {
  const rest = book.sales.filter((s) => s.id !== sale.id);
  return { ...book, sales: sortSales([sale, ...rest]) };
}

export function removeSale(book: SaleBook, id: string): SaleBook {
  const sales = book.sales.filter((s) => s.id !== id);
  const currentId = book.currentId === id ? (sortSales(sales)[0]?.id ?? null) : book.currentId;
  return { ...book, sales, currentId };
}

/** Combine this device's copy with the account's copy. */
export function mergeBooks(local: Sale[], remote: Sale[]): Sale[] {
  const byId = new Map<string, Sale>();
  for (const s of [...remote, ...local]) {
    const have = byId.get(s.id);
    if (!have || s.updatedAt > have.updatedAt) byId.set(s.id, s);
  }
  return sortSales([...byId.values()]);
}

/** Decide what the device should hold once `userId` signs in. */
export function bookOnSignIn(local: SaleBook, remote: SaleBook | null, userId: string): SaleBook {
  const remoteSales = remote?.sales ?? [];
  const sales = local.owner === userId ? mergeBooks(local.sales, remoteSales) : sortSales(remoteSales);
  const wanted = local.owner === userId ? local.currentId : remote?.currentId ?? null;
  const currentId = sales.some((s) => s.id === wanted) ? wanted : (sales[0]?.id ?? null);
  return { owner: userId, currentId, sales };
}

/** Defensive parse of anything that claims to be a book. */
export function parseBook(raw: unknown): SaleBook | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SaleBook>;
  if (!Array.isArray(r.sales)) return null;
  const sales = r.sales
    .filter((s): s is Sale => !!s && typeof s === "object" && typeof (s as Sale).id === "string")
    .map(normalizeSale);
  return {
    owner: typeof r.owner === "string" ? r.owner : null,
    currentId: typeof r.currentId === "string" ? r.currentId : null,
    sales: sortSales(sales),
  };
}
