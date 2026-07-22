import type { AnalysisRequest, JobHandle, JobPoll } from "./types";

/**
 * The single interface every downstream feature is built against. Two
 * implementations: `StubAnalysisClient` (fake verdicts, no service needed) and
 * `HttpAnalysisClient` (calls the real Python service once it exists). Swap
 * implementations via `getAnalysisClient()`, callers never branch on which.
 */
export interface AnalysisClient {
  /** Enqueue analysis for one plot. Returns immediately with a job handle. */
  submit(req: AnalysisRequest): Promise<JobHandle>;
  /** Check a job. Returns pending, the result, or a failure. */
  poll(jobId: string): Promise<JobPoll>;
}

/**
 * Real HTTP client. Thin fetch wrapper over the queued-job contract. Endpoint
 * shapes are provisional and will be confirmed against the service in its own
 * session; keeping them here means the web app already speaks the real protocol.
 */
export class HttpAnalysisClient implements AnalysisClient {
  constructor(private readonly baseUrl: string) {}

  async submit(req: AnalysisRequest): Promise<JobHandle> {
    const res = await fetch(`${this.baseUrl}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      throw new Error(`analysis submit failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as JobHandle;
  }

  async poll(jobId: string): Promise<JobPoll> {
    const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`);
    if (!res.ok) {
      throw new Error(`analysis poll failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as JobPoll;
  }
}
