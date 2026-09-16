# Data model — as applied

> This file previously specified a larger schema (`analysis_runs`, `alerts`,
> `disputes`, versioned `country_profiles`) for the satellite-verdict and
> watchdog product. Those features were deleted (`PARKED.md`) and their tables
> were never applied. This describes what actually exists, plus the one design
> decision from that era still worth keeping.

Three storage layers, each with a different job.

| Layer | Holds | Why there |
|---|---|---|
| **IndexedDB** (Dexie, `lib/intake/db.ts`) | Field capture + grow-lane data | The field source of truth. Persists the instant something is captured, so a phone dying at plot 30 loses nothing |
| **Supabase Postgres** | Synced field records, per-user state | Durable, multi-device, row-level-security scoped |
| **localStorage** | Sale intent, per-document status, probe calibration | Small, synchronous, per-browser |

---

## Supabase — applied migrations

`supabase/migrations/`, applied in order. Six objects.

| Table | Migration | Purpose |
|---|---|---|
| `user_state` | `0001` | Per-user sale + document progress across devices |
| `farmers` | `0002` | Identity captured in the field |
| `plots` | `0002` | Boundary as a closed WGS84 ring (`jsonb`) |
| `attestations` | `0002` | Officer identity, farmer consent, signature, hash chain |
| `media` | `0002` | Photo/signature metadata; blobs purge locally after sync |
| `lot_verification` | `0003` | Backs the public `/verify/<id>` page |

Every row is owned by the authenticated account that synced it, and RLS
restricts all access to own rows.

### Geometry is stored as it was captured

`plots.ring` is `jsonb`: the closed WGS84 ring `[[lng,lat],…]`, first point equal
to last, exactly as the device recorded it. Not PostGIS geometry — promotion is a
later additive migration and nothing blocks it.

Area is computed **twice, on purpose**:

- **On device**, geodesically via turf (`lib/intake/geometry.ts`). Needs no
  projection choice and is correct in any UTM zone or hemisphere, which is what
  the live "does this match your claim?" check requires.
- **Authoritatively**, server-side, by reprojecting to an equal-area CRS.

### The decision worth keeping: which CRS names the hectares

Store WGS84 as the source of truth; compute hectares by reprojecting per-plot to
an **equal-area** CRS and recording which EPSG produced the number.

PostGIS `geography` would compute area on the spheroid with no projection choice
at all — simpler, and tempting. It loses on defensibility: it hides the choice,
and an auditor cannot see what produced the number on a legal document. An
explicit `ST_Area(ST_Transform(geom, area_crs_epsg)) / 10000` can be checked.

UTM was rejected for this: it is conformal, not equal-area. The error at 0.5 ha
is tiny, but it is the wrong tool to name on a document someone relies on.

`capture_method` (`imported | traced | corners | walked`) is recorded because a
traced polygon and a walked one deserve different confidence, and an auditor will
ask. `lib/intake/confidence.ts` turns it into a label and a rationale rather than
folding it into a score — inventing a combined number would be exactly the
overclaiming the caveats warn against.

---

## IndexedDB — `intake` database

Three schema versions, all additive.

**v1** — `farmers`, `plots`, `tiles` (offline basemap), `outbox`
**v2** — `media`, `attestations`
**v3** — the GROW lane:

| Table | Key | Holds |
|---|---|---|
| `growProfiles` | `plotId` | Crop, soil texture, rooting depth, irrigated |
| `weatherCache` | `[plotId+date]` | Daily Open-Meteo rows + `fetchedAt` |
| `sensorReadings` | `++seq` | Magicbit trace: raw ADC, calibrated VWC, temps |

v3 is keyed by `plotId` rather than folded into `LocalPlot` deliberately: the
field-capture record keeps exactly the shape it had when it was attested and
signed. The compound `[plotId+date]` key means re-fetching an overlapping range
updates in place, so the weather cache converges instead of growing.

**Writes are atomic.** Every save spans the entity table *and* the `outbox` in
one Dexie transaction, so a crash cannot leave a plot marked attested with a
missing photo. Hashing happens *before* the transaction, because WebCrypto
promises are not IndexedDB-transaction-safe.

**Grow data does not enter the outbox.** It is advisory and locally
recomputable, unlike an attested boundary. Putting it in the sync contract would
add server surface for no evidentiary gain.

---

## What is deliberately not modelled

- **`analysis_runs` / `alerts` / `disputes`** — the satellite verdict, standing
  monitoring and public-map features they served were deleted.
- **Versioned `country_profiles`** — designed for reproducing a historical
  deforestation verdict under the rules in force at the time. With no verdict to
  reproduce, `lib/compliance/catalog.ts` carries requirements as data with a
  `CATALOG_VERIFIED_AT` date and a staleness warning, which is the right size.
- **Tea model outputs** — inference runs in the browser and is not persisted.
  Storing a diagnosis would make it a record, and it is advice.
