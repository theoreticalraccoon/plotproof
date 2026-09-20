// Officer identity. PLACEHOLDER until magic-link auth lands: the officer names themselves once
// and it's kept in localStorage, stamped onto every attestation automatically.
export interface OfficerIdentity {
  id: string;
  name: string;
}

import { readJson, writeJson } from "../device/local";

const KEY = "plotproof.officer";

export function getOfficer(): OfficerIdentity | null {
  return readJson<OfficerIdentity | null>(KEY, null);
}

export function setOfficer(name: string): OfficerIdentity {
  const existing = getOfficer();
  const identity: OfficerIdentity = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim(),
  };
  writeJson(KEY, identity);
  return identity;
}
