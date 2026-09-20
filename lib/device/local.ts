/** Small JSON values in localStorage. Every read and write survives blocked or full storage. */

/** Keys that describe the device, not the account, so they survive a change of account. */
export const DEVICE_KEYS: ReadonlySet<string> = new Set(["plotproof.lang", "plotproof.deviceOwner"]);

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : ((JSON.parse(raw) as T) ?? fallback);
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be stored (private mode, quota). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readText(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the value just does not persist.
  }
}

/** Removes every PlotProof key that belongs to an account. New stores are covered by default. */
export function clearAccountKeys(
  keep: readonly string[] = [],
  storage: Pick<Storage, "length" | "key" | "removeItem"> = localStorage,
): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith("plotproof.") && !DEVICE_KEYS.has(k) && !keep.includes(k)) doomed.push(k);
  }
  doomed.forEach((k) => storage.removeItem(k));
}
