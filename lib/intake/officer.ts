/**
 * Officer identity. PLACEHOLDER until magic-link auth lands: the officer names
 * themselves once and it's kept in localStorage, stamped onto every attestation
 * automatically. When Supabase auth arrives this is replaced by the signed-in
 * user (officers table, SCHEMA.md §D) — attestation code won't change, only its
 * source of identity.
 */
export interface OfficerIdentity {
  id: string;
  name: string;
}

const KEY = "plotproof.officer";

export function getOfficer(): OfficerIdentity | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OfficerIdentity;
  } catch {
    return null;
  }
}

export function setOfficer(name: string): OfficerIdentity {
  const existing = getOfficer();
  const identity: OfficerIdentity = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim(),
  };
  localStorage.setItem(KEY, JSON.stringify(identity));
  return identity;
}
