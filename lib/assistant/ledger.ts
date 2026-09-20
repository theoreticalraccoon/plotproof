/** Per-account question limits. Two adapters: the Supabase ledger in production, memory in local development. */
import { limitDecision } from "./protocol.ts";

export type LimitOutcome = "ok" | "rate_limited" | "limits_unavailable";

export interface UsageLedger {
  /** Checks the limits and, if the request may go ahead, records it before the model is called. */
  take(account: string): Promise<LimitOutcome>;
}

export function memoryLedger(now: () => number = Date.now): UsageLedger {
  const hits = new Map<string, number[]>();
  return {
    async take(account) {
      const t = now();
      const recent = (hits.get(account) ?? []).filter((x) => t - x < 86_400_000);
      if (limitDecision(recent, t) === "rate_limited") return "rate_limited";
      hits.set(account, [...recent, t]);
      return "ok";
    },
  };
}

/** The slice of a Supabase client the ledger uses. */
interface LedgerTable {
  from(table: "chat_usage"): {
    select(cols: string): { eq(c: string, v: string): { gte(c: string, v: string): PromiseLike<{ data: { created_at: string }[] | null; error: { message: string } | null }> } };
    insert(row: { user_id: string }): PromiseLike<{ error: { message: string } | null }>;
  };
}

// Fails closed: if the ledger cannot be read or written, no question is sent unmetered.
export function supabaseLedger(sb: LedgerTable, now: () => number = Date.now): UsageLedger {
  return {
    async take(account) {
      const t = now();
      const { data, error } = await sb
        .from("chat_usage")
        .select("created_at")
        .eq("user_id", account)
        .gte("created_at", new Date(t - 86_400_000).toISOString());
      if (error) {
        console.error("[assistant] usage ledger unavailable:", error.message);
        return "limits_unavailable";
      }
      const times = (data ?? []).map((r) => new Date(r.created_at).getTime());
      if (limitDecision(times, t) === "rate_limited") return "rate_limited";
      // Recorded before the model is called, so an abandoned answer still counts.
      const { error: insertError } = await sb.from("chat_usage").insert({ user_id: account });
      if (insertError) {
        console.error("[assistant] could not record usage:", insertError.message);
        return "limits_unavailable";
      }
      return "ok";
    },
  };
}
