/**
 * Geolocation that never throws and always explains itself. A denied or
 * unavailable fix must degrade into a clear message, not a silent no-op or an
 * unhandled error, and capture must continue regardless (tracing needs no GPS).
 */
export type LocateResult =
  | { status: "ok"; lng: number; lat: number; accuracyM: number }
  | { status: "denied" | "unavailable" | "timeout" | "unsupported"; message: string };

export function getPosition(
  opts: { timeoutMs?: number; highAccuracy?: boolean } = {},
): Promise<LocateResult> {
  const { timeoutMs = 8000, highAccuracy = true } = opts;
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "unsupported", message: "This device can't provide a location." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          status: "ok",
          lng: p.coords.longitude,
          lat: p.coords.latitude,
          accuracyM: p.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ status: "denied", message: "Location permission denied." });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          resolve({ status: "unavailable", message: "Location is unavailable right now." });
        } else {
          resolve({ status: "timeout", message: "Getting a location took too long." });
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 30000 },
    );
  });
}
