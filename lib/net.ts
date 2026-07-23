/**
 * Network helper for the demo path: conference wifi is slow and flaky, so every
 * fetch gets a timeout, one retry on server/transport errors, and a
 * HUMAN-READABLE error, never a hung promise or a raw stack trace.
 */
export type NetErrorKind = "timeout" | "offline" | "server" | "client";

export class NetError extends Error {
  constructor(
    message: string,
    readonly kind: NetErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NetError";
  }
}

export interface FetchOpts {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = 12000, retries = 1 } = opts;
  let lastErr: NetError = new NetError("Request failed.", "client");

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: body != null ? { "content-type": "application/json" } : undefined,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) return (await res.json()) as T;

      const kind: NetErrorKind = res.status >= 500 ? "server" : "client";
      lastErr = new NetError(statusMessage(res.status), kind, res.status);
      // 503 analysis_unavailable is a stable condition, not a transient fault.
      if (kind === "server" && res.status !== 503 && attempt < retries) continue;
      throw lastErr;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof NetError) {
        if (e.kind === "server" && attempt < retries) {
          lastErr = e;
          continue;
        }
        throw e;
      }
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      lastErr = isAbort
        ? new NetError("The network is slow, that request timed out. Try again.", "timeout")
        : new NetError("Couldn't reach the server. Check the connection.", "offline");
      if (attempt < retries) continue;
      throw lastErr;
    }
  }
  throw lastErr;
}

function statusMessage(status: number): string {
  if (status === 404) return "Not found.";
  if (status === 401 || status === 403) return "Not authorized.";
  if (status >= 500) return "The server had a problem. Retrying…";
  return `Request failed (${status}).`;
}

/** Wake a cold serverless function ahead of time (fire-and-forget). */
export function warmup(path = "/api/health"): void {
  void fetch(path).catch(() => {});
}
