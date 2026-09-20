"use client";

/** Keeps one account's data on this device away from the next account. */
import { clearIntakeData } from "../intake/db";
import { clearLocalSales } from "../sale/store";
import { clearAccountKeys, readText, writeText } from "./local";

const OWNER_KEY = "plotproof.deviceOwner";
// Where /intake recorded the owner before this module existed.
const LEGACY_OWNER_KEY = "plotproof.intakeOwner";
// Sales carry their own owner stamp and are reconciled by syncSalesOnSignIn.
const SALES_KEYS = ["plotproof.sales.v1"];
export const DEVICE_CLEARED_EVENT = "plotproof:device-cleared";

/** Wipes everything account-scoped: sales, field records, grow data and small stores. */
export async function clearAccountData(): Promise<void> {
  clearLocalSales();
  try {
    clearAccountKeys();
  } catch {
    // Storage blocked: nothing was persisted there either.
  }
  await clearIntakeData().catch(() => {});
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DEVICE_CLEARED_EVENT));
}

/**
 * Call when the signed-in account is known. If this device last held a different account's data,
 * or an anonymous session's, it is cleared first. Sales are left to their own sign-in merge.
 */
export async function claimDevice(userId: string | null): Promise<void> {
  const current = userId ?? "anon";
  const last = readText(OWNER_KEY) ?? readText(LEGACY_OWNER_KEY);
  if (last === current) return;
  if (last !== null) {
    try {
      clearAccountKeys(SALES_KEYS);
    } catch {
      /* non-fatal */
    }
    await clearIntakeData().catch(() => {});
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DEVICE_CLEARED_EVENT));
  }
  writeText(OWNER_KEY, current);
  writeText(LEGACY_OWNER_KEY, null);
}

/** On sign-out: the next person on this device starts with nothing. */
export async function releaseDevice(): Promise<void> {
  await clearAccountData();
  writeText(OWNER_KEY, "anon");
}
