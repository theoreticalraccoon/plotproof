/**
 * Per-user persistence. Mirrors the farmer's two pieces of client state, the
 * current sale intent (lib/compliance/intent.ts) and per-document progress
 * (lib/compliance/status.ts), into a single `user_state` row so a signed-in
 * user keeps their work across devices. Deliberately generic (opaque jsonb
 * blobs) so it never has to understand the shapes it stores.
 *
 * Everything no-ops when Supabase isn't configured, when no one is signed in,
 * or when the `user_state` table doesn't exist yet, so the app keeps working as
 * a local-only prototype at every stage of setup.
 */
import { getSupabaseBrowser, isSupabaseConfigured } from "./client";

const INTENT_KEY = "plotproof.saleIntent";
const STATUS_KEY = "plotproof.docStatus";
const TABLE = "user_state";

interface RemoteState {
  sale_intent: unknown | null;
  doc_status: unknown | null;
}

function readLocal(): RemoteState {
  if (typeof localStorage === "undefined") return { sale_intent: null, doc_status: null };
  const parse = (k: string) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  return { sale_intent: parse(INTENT_KEY), doc_status: parse(STATUS_KEY) };
}

function writeLocal(s: RemoteState): void {
  if (typeof localStorage === "undefined") return;
  if (s.sale_intent != null) localStorage.setItem(INTENT_KEY, JSON.stringify(s.sale_intent));
  if (s.doc_status != null) localStorage.setItem(STATUS_KEY, JSON.stringify(s.doc_status));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced upsert of the current local state to the signed-in user's row. */
export function pushUserState(): void {
  if (!isSupabaseConfigured()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const sb = await getSupabaseBrowser();
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    if (!data.user) return;
    const local = readLocal();
    await sb
      .from(TABLE)
      .upsert({
        user_id: data.user.id,
        sale_intent: local.sale_intent,
        doc_status: local.doc_status,
        updated_at: new Date().toISOString(),
      })
      .then(() => undefined, () => undefined); // table may not exist yet; ignore
  }, 600);
}

/**
 * On sign-in: show ONLY this account's data. Local storage is always cleared
 * first, so on a shared device one account never inherits another's leftover
 * work, and a brand-new account starts on a genuinely clean slate. Then the
 * account's saved state (if any) is written back down. Returns true so the
 * caller knows local storage changed.
 *
 * Note: we deliberately do NOT migrate anonymous local work up, the app gates
 * data creation behind auth, so there is no anonymous work to keep, and auto-
 * migrating would risk pushing a previous user's data into a new account.
 */
export async function syncOnLogin(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = await getSupabaseBrowser();
  if (!sb) return false;
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("sale_intent, doc_status")
      .eq("user_id", userId)
      .maybeSingle();
    clearLocalState(); // clean slate first, regardless of what the query returned
    if (!error && data && (data.sale_intent || data.doc_status)) {
      writeLocal({ sale_intent: data.sale_intent, doc_status: data.doc_status });
    }
    return true;
  } catch {
    return false;
  }
}

/** On sign-out, drop the local sale state so the next person starts clean. */
export function clearLocalState(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(INTENT_KEY);
  localStorage.removeItem(STATUS_KEY);
}
