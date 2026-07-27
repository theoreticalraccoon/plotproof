# Graph Report - .  (2026-07-27)

## Corpus Check
- 165 files · ~83,001 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1075 nodes · 2283 edges · 73 communities (61 shown, 12 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Public Disputes & Explore API
- Acoustic Monitoring Page
- Login & Document Checklist
- Auth & Offline Sync
- Sell Flow & Catalog
- Document Generators
- Landing Page & Motion
- Change Detection (Python)
- Intake Page & Privacy
- Analysis Client
- TypeScript Config
- Product Scope Rationale
- Plot List & Confidence
- Root Layout & Shell
- Evidence Pack Page
- CSV Import Panel
- Monitoring & Alerts Rationale
- Attestation Design Rationale
- Monitoring Engine
- Public Map & Tiles
- NPM Dependencies
- Dev Dependencies
- Analysis Service Core
- Satellite Imagery Loading
- Monitoring Repository
- Deploy & Go-Live Rationale
- Plot Geometry Utilities
- Attestation Integrity Hashing
- Imagery Rendering (Python)
- Documents Hub Page
- In-Memory Monitoring Store
- Analysis Service Cache
- Radar (Sentinel-1) Processing
- Farmer Intake Design Rationale
- U-Net Training Plan Rationale
- Radar Alignment Script
- Acoustic Exhibit & Deploy Rationale
- Alert Delivery Transport
- Price Intelligence UI
- Country Profile Schema Rationale
- Plot Grid & Timeseries
- STAC Satellite Search
- EUDR Dates & Policy Rationale
- Geometry & Caching Decisions
- Trace Map & Local Save
- Acoustic ML Rationale
- Model Evaluation Rationale
- Monitoring Cron Routes
- Analysis API Routes
- Analysis Service HTTP Server
- MCP Server Config
- Acoustic Gateway Script
- NPM Scripts
- Package Metadata
- Tech Stack Setup Rationale
- Field Data Migration
- Smooth Scroll
- Design QA Checklist
- Design Tokens
- Next.js Config
- Supabase SSR Package
- Supabase JS Package
- PostCSS Config
- Sampling Regions Data
- User State Migration
- Vercel Cron Config
- Spacing Scale Tokens
- NumPy Dependency

## God Nodes (most connected - your core abstractions)
1. `useLang()` - 43 edges
2. `t()` - 42 edges
3. `db()` - 30 edges
4. `Cache` - 23 edges
5. `detect_change()` - 18 edges
6. `useToast()` - 17 edges
7. `Grid` - 17 edges
8. `compilerOptions` - 17 edges
9. `SellPage()` - 16 edges
10. `analyze_plot()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `SyncTransport interface (drainable outbox, stub swaps to Supabase)` --semantically_similar_to--> `Analysis: separate Python service, queued, S2 fused with S1, stub-first contract`  [INFERRED] [semantically similar]
  DECISIONS.md → PROJECT.md
- `TraceMap()` --indirect_call--> `result()`  [INFERRED]
  components/intake/TraceMap.tsx → test/monitoring.test.ts
- `Motion: GSAP Flip shared-element page transition (expo.inOut, 500-800ms)` --conceptually_related_to--> `D-013: deploy readiness + demo-path hardening`  [AMBIGUOUS]
  design-system/plotproof/MASTER.md → DECISIONS.md
- `pyproj>=3.6 (CRS transforms, WGS84<->UTM, equal-area for hectares)` --semantically_similar_to--> `Decision A: geometry(Polygon,4326) store + per-country equal-area reprojection`  [INFERRED] [semantically similar]
  service/requirements.txt → SCHEMA.md
- `ExplorePage()` --calls--> `countryName()`  [EXTRACTED]
  app/explore/page.tsx → lib/public/format.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Equal-area hectare computation across the stack (client, server schema, Python service)** — decisions_geodesic_area, schema_geometry_decision, project_crs_correctness, svc_reqs_pyproj [INFERRED 0.85]
- **Swappable in-memory/stub stores gated on the same Supabase schema sign-off** — decisions_sync_transport, decisions_monitoringrepo, decisions_publicfeature_deidentified, decisions_buildexhibit, project_analysis_feature, schema_open_questions [EXTRACTED 1.00]
- **Project-wide honesty ethos: never invent law, never overclaim, state caveats plainly** — decisions_insufficient_data_verdict, decisions_coo_honesty, ml_acoustic_readme_honesty_contract, ml_prices_readme_honesty_contract, svc_decisions_s013_eval_harness, project_evidence_pack_spec [EXTRACTED 1.00]

## Communities (73 total, 12 thin omitted)

### Community 0 - "Public Disputes & Explore API"
Cohesion: 0.06
Nodes (51): GET(), POST(), GET(), ExplorePage(), Feature, FeatureCard(), FeatureProps, Panel (+43 more)

### Community 1 - "Acoustic Monitoring Page"
Cohesion: 0.06
Nodes (33): AcousticModelCard, AcousticPage(), DEMO_PLOT, fmt(), GET(), GET(), POST(), Skeleton() (+25 more)

### Community 2 - "Login & Document Checklist"
Cohesion: 0.09
Nodes (42): destination(), LoginPage(), Mode, Home(), Back(), DocGroup(), IssuerTag(), StatusPill() (+34 more)

### Community 3 - "Auth & Offline Sync"
Cohesion: 0.11
Nodes (28): SyncBar(), AuthContext, AuthContextValue, AuthProvider(), AuthResult, OutboxItem, formatBytes(), localMediaBytes() (+20 more)

### Community 4 - "Sell Flow & Catalog"
Cohesion: 0.12
Nodes (25): ORIGINS, SellPage(), DOCUMENT_TYPES, MarketMeta, MARKETS, PRODUCTS, classify(), tokens() (+17 more)

### Community 5 - "Document Generators"
Cohesion: 0.17
Nodes (21): CertificateOfOriginPage(), InvoicePage(), PACKAGE_TYPES, PackingListPage(), DocBreadcrumb(), NoIntent(), CopyButton(), getProduct() (+13 more)

### Community 6 - "Landing Page & Motion"
Cohesion: 0.10
Nodes (20): WIZARD_STEPS, Counter(), Magnetic(), Reveal(), ScrollReveal(), StaggerGroup(), StaggerItem(), durations (+12 more)

### Community 7 - "Change Detection (Python)"
Cohesion: 0.15
Nodes (26): date, _as_date(), ChangeResult, _clear_confidence(), detect_change(), FfObs, _flag_confidence(), forest_fraction() (+18 more)

### Community 8 - "Intake Page & Privacy"
Cohesion: 0.08
Nodes (16): DangerZone(), IntakePage(), Tab, TraceMap, metadata, metadata, ActionButton(), Status (+8 more)

### Community 9 - "Analysis Client"
Cohesion: 0.16
Nodes (18): AnalysisClient, HttpAnalysisClient, fakeResult(), fakeSeries(), fakeTile(), hashString(), mulberry32(), parseJobId() (+10 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx (+19 more)

### Community 11 - "Product Scope Rationale"
Cohesion: 0.09
Nodes (24): Both ML anchors kept: deforestation detection + HS-code/requirements intelligence, First generated document: commercial invoice (/documents/invoice), Requirements-as-data catalog: products/markets/documents, applies(ctx), Certificate-of-origin honesty: generates a marked DRAFT, not an issued cert, Deliberate cuts for the deadline (Hansen/RADD/JRC over from-scratch model, EU-first depth, stubs kept), D-015: document generator set completed + scope discipline, Shared DocumentChecklist component (sell wizard + hub), Documents hub (/documents): durable return point re-resolving the checklist (+16 more)

### Community 12 - "Plot List & Confidence"
Cohesion: 0.16
Nodes (16): CONFIDENCE_DOT, PlotList(), SYNC_STYLE, captureConfidence, ConfidenceLevel, IntakeDB, listFarmers(), listPlots() (+8 more)

### Community 13 - "Root Layout & Shell"
Cohesion: 0.11
Nodes (13): fraunces, hanken, metadata, ScrollProgress(), AppShell(), NO_FOOTER, PageTransition(), COLORS (+5 more)

### Community 14 - "Evidence Pack Page"
Cohesion: 0.16
Nodes (15): centroid(), downloadDds(), EvidencePackPage(), IntegritySeal(), JobState, sleep(), verdictSentence(), db() (+7 more)

### Community 15 - "CSV Import Panel"
Cohesion: 0.17
Nodes (18): Field, FIELDS, ImportPanel(), RowResult, ColumnMapping, isRecord(), MappedRow, mapRows() (+10 more)

### Community 16 - "Monitoring & Alerts Rationale"
Cohesion: 0.12
Nodes (21): Alert delivery: email/webhook, delivery status, acknowledge action, alert history, Disputes are training labels: stance+reason mapped to model confusions, Per-document status: localStorage keyed by sale identity, X-of-N progress bar, D-010: standing monitoring cadence (satellite revisit + cloud bound), MonitoringRepo: in-memory per-process store, Supabase swap seam, New-clearing detection (fires on clear->flagged or later clearing window), D-011: free public layer (open map + crowd labels), PublicFeature: de-identified by design (no farmer/plot identity) (+13 more)

### Community 17 - "Attestation Design Rationale"
Cohesion: 0.12
Nodes (20): D-009: attestation layer + photo storage on a full phone, Capture method to confidence label (traced/walked/imported), not a number, D-006: the one moment the farmer touches the phone (attestation only), Photo storage strategy: compress, never touch gallery, purge-after-sync, PII caveat: national ID numbers/photos need consent, encryption, per-country opt-out, Atomic save: photo+signature+attestation+outbox in one Dexie transaction, Seed: bundled plots.csv import through the save-gate, Optional polish: server-side PDF, LLM translation, more capture methods (+12 more)

### Community 18 - "Monitoring Engine"
Cohesion: 0.17
Nodes (14): AnalysisResult, getAlertTransport(), Detection, detectNewClearing(), isDue(), observedThrough(), checkSubscription(), RecheckResult (+6 more)

### Community 19 - "Public Map & Tiles"
Cohesion: 0.16
Nodes (15): MapFeature, Props, CachedTile, buildTileUrl(), cacheDistrict(), cachedTileObjectUrl(), CacheProgress, ESRI_WORLD_IMAGERY (+7 more)

### Community 20 - "NPM Dependencies"
Cohesion: 0.11
Nodes (19): dexie, framer-motion, leaflet, lucide-react, next, dependencies, dexie, framer-motion (+11 more)

### Community 21 - "Dev Dependencies"
Cohesion: 0.11
Nodes (19): devDependencies, postcss, tailwindcss, @tailwindcss/postcss, @types/leaflet, @types/node, @types/papaparse, @types/react (+11 more)

### Community 22 - "Analysis Service Core"
Cohesion: 0.16
Nodes (16): analyze_plot(), _area_ha(), forest_prob_proxy(), _get_scenes(), _pick_before_after(), ndarray, Analyse one plot end to end and return the ML.md contract payload (camelCase, as, Geodesic plot area in hectares (correct on the ellipsoid, no projection choice). (+8 more)

### Community 23 - "Satellite Imagery Loading"
Cohesion: 0.18
Nodes (16): Resampling, grid_from_center(), load_scene_arrays(), observe(), ndarray, Windowed reads, resampling to a fixed plot grid, SCL cloud/shadow masking, and p, Warp one remote asset onto the fixed grid, reading only the needed window., Return {asset: array} for a scene, from the on-disk cache when present and     o (+8 more)

### Community 24 - "Monitoring Repository"
Cohesion: 0.18
Nodes (12): Verdict, Wgs84Polygon, daysAgo(), getMonitoringRepo(), NOTE: in-memory state is per-process. Fine for `next dev`/`next start` and for, seedAlerts(), seedSubs(), square() (+4 more)

### Community 25 - "Deploy & Go-Live Rationale"
Cohesion: 0.19
Nodes (15): D-016: completion pass (languages, document status, real imagery, deploy packaging), Deploy packaging for both halves: service/Dockerfile + DEPLOY.md coverage, Honest remainder: deploy execution, trained U-Net, Supabase persistence, real coords, sign-offs, Real satellite imagery in evidence pack: poll API rewrites tile URLs, The analysis service: docker build/run, deploy to Railway/Render/Fly/Cloud Run, Verify a deploy: curl /api/health, /api/public/flagged, walk the two demo paths, Final go-live checklist (stage-by-stage), Stage 0: prep - push repo, verify .env not committed (+7 more)

### Community 26 - "Plot Geometry Utilities"
Cohesion: 0.28
Nodes (12): areaDivergence(), autoOrderRing(), closeRing(), computeAreaHa(), dedupeConsecutive(), findOverlaps(), isSelfIntersecting(), safePolygon() (+4 more)

### Community 27 - "Attestation Integrity Hashing"
Cohesion: 0.32
Nodes (13): attestationContentHash(), AttestationHashInput, AttestationIntegrity, canonicalJson(), INTEGRITY_ALGO, ringSha256(), sha256Hex(), verifyAttestationIntegrity() (+5 more)

### Community 28 - "Imagery Rendering (Python)"
Cohesion: 0.24
Nodes (13): DateObservation, Grid, alignment_figure(), before_after_tile(), contact_sheet(), _display_rgb(), _edges_from_rgb(), _plot_outline_pixels() (+5 more)

### Community 29 - "Documents Hub Page"
Cohesion: 0.31
Nodes (10): DocumentsPage(), Props, getStatuses(), intentKey(), progressSummary(), readAll(), setStatus(), StatusMap (+2 more)

### Community 30 - "In-Memory Monitoring Store"
Cohesion: 0.21
Nodes (3): InMemoryMonitoringRepo, MonitoringRepo, Alert

### Community 31 - "Analysis Service Cache"
Cohesion: 0.23
Nodes (6): Path, Cache, key_hash(), ndarray, Aggressive on-disk cache. The brief's hardest rule for this phase: never downloa, Short stable hash of the identifying parts (not security-sensitive).

### Community 32 - "Radar (Sentinel-1) Processing"
Cohesion: 0.24
Nodes (11): _clean(), lee_filter(), observe_s1(), ndarray, Sentinel-1 onto the same grid as the optical stack.  Terrain correction is NOT d, RTC gamma-0 is linear power (small positives). Mark nodata and any     non-physi, Classic Lee speckle filter on linear power. SAR speckle is multiplicative,     s, S1Observation (+3 more)

### Community 33 - "Farmer Intake Design Rationale"
Cohesion: 0.17
Nodes (13): Basemap = Esri World Imagery, offline tile pre-cache, DEMO_COOP / DEMO_COUNTRY hardcoded placeholders pending auth, Local store = source of truth (IndexedDB via Dexie, outbox), D-007: farmer & plot intake design (officer entry effortless), Layer 1: scan national ID card (per-country machine-readable channel), Leaflet vanilla (not react-leaflet) for offline tile layer, Layer 2: manual, minimal, assisted intake with live validation, D-008: plot intake build (import + tracing first) (+5 more)

### Community 34 - "U-Net Training Plan Rationale"
Cohesion: 0.19
Nodes (13): Stage 4: train the real U-Net model (replace NDVI proxy), Acoustic ML replaces the satellite U-Net as the project's ML component (per council objection), Data sources: Sentinel-2, Sentinel-1, Hansen GFC, ESA WorldCover/Dynamic World, JRC, RADD, Do not train on EuroSat (temperate imagery misreads tropical canopy), Order of work: STAC->S1->chips->train->series->tiles->eval->HTTP contract, U-Net semantic segmentation, per-pixel forest probability, 10-channel input, S-001: imagery source = Microsoft Planetary Computer (swappable via stac.py), S-008: Step-1 band set (B02/B03/B04/B08 + SCL), SWIR deferred (+5 more)

### Community 35 - "Radar Alignment Script"
Cohesion: 0.26
Nodes (12): load_s1_arrays(), {vv, vh} warped onto the optical grid, cache-first (a warm run does no I/O)., _bbox(), _bbox_key(), _get_optical(), _get_s1(), main(), _nearest_s1() (+4 more)

### Community 36 - "Acoustic Exhibit & Deploy Rationale"
Cohesion: 0.20
Nodes (12): buildExhibit(): events near a plot -> PDF acoustic exhibit section, D-013: deploy readiness + demo-path hardening, Environment variables table (Supabase, ANALYSIS_SERVICE_URL, CRON_SECRET, etc.), First deploy: vercel login / vercel / vercel --prod, or GitHub import, Stability notes: error boundaries, cold starts, in-memory stores reset on cold start, Two deployables: Next.js web app (Vercel) + Python analysis service (container host), Style: Liquid Glass - flowing glass, morphing, translucent, iridescent, Motion: GSAP Flip shared-element page transition (expo.inOut, 500-800ms) (+4 more)

### Community 37 - "Alert Delivery Transport"
Cohesion: 0.21
Nodes (8): alertPayload(), AlertTransport, DeliveryResult, email, StubEmailTransport, webhook, WebhookTransport, AlertChannel

### Community 38 - "Price Intelligence UI"
Cohesion: 0.31
Nodes (7): PriceCard(), Props, CommodityPrices, ForecastPoint, loadPrices(), PriceIntelligence, PricePoint

### Community 39 - "Country Profile Schema Rationale"
Cohesion: 0.29
Nodes (10): D-003: national forest definition governed by plot's physical country, D-004: insufficient_data is a first-class verdict, still generates a PDF, Change detection lives outside the model (plain inspectable Python), Country profiles as data: cutoff, forest definition, commodities, language, analysis_runs table: profile snapshot, verdict fields, imagery jsonb, countries table: ISO code, name, current_version_id, Decision B: country profiles are immutable versioned rows (reproducibility), country_profile_versions table: cutoff, canopy/area/height, area_crs_epsg (+2 more)

### Community 40 - "Plot Grid & Timeseries"
Cohesion: 0.31
Nodes (9): build_grid(), Reproject the WGS84 plot into the reference CRS, buffer it, and snap a     metre, _all_arrays_cached(), _bbox(), main(), End-to-end entry point for Step 1: one plot, one country, rendered so you can lo, Reference CRS for the fixed grid: the first scene's proj:epsg, or read it     fr, _resolve_ref_crs() (+1 more)

### Community 41 - "STAC Satellite Search"
Cohesion: 0.27
Nodes (7): _client(), STAC search against the configured source, behind a thin interface so the source, Live STAC search. Sorted by acquisition date ascending (client-side, so we     d, Live search of the Sentinel-1 RTC collection. RTC is already terrain     correct, Scene, search_s1_rtc(), search_scenes()

### Community 42 - "EUDR Dates & Policy Rationale"
Cohesion: 0.25
Nodes (9): D-002: cutoff date means two fields, not one, Deforestation-free cutoff date (31 Dec 2020, fixed), D-001: EUDR two dates (cutoff vs compliance deadline), Council of the EU: deforestation regulation revision sign-off, EC trade: EUDR delay to Dec 2026 news, European Parliament: adopts changes to postpone and simplify EUDR, Operator compliance deadlines (Dec 2026 / Jun 2027, Reg 2025/2650), The problem: EUDR proof-of-origin excludes smallholders lacking paperwork (+1 more)

### Community 43 - "Geometry & Caching Decisions"
Cohesion: 0.22
Nodes (9): Client-side geodesic area via turf (hectares, no projection needed), Practical constraints: aggressive caching, CRS testing across UTM zones/hemispheres, Global correctness: WGS84 store, per-plot equal-area reprojection for hectares, Decision A: geometry(Polygon,4326) store + per-country equal-area reprojection, S-005: SCL cloud/shadow masking, magenta visualization, per-plot valid-fraction, S-007: content-addressed cache; warm run makes zero network calls, Caching: .cache/stac + .cache/scenes keyed by content, second run touches network zero times, matplotlib>=3.8 (time-series contact sheet + NDVI trace rendering) (+1 more)

### Community 44 - "Trace Map & Local Save"
Cohesion: 0.50
Nodes (7): createOfflineTileLayer(), DEFAULT_CENTER, TraceMap(), existingRings(), nowIso(), saveFarmer(), savePlot()

### Community 45 - "Acoustic ML Rationale"
Cohesion: 0.29
Nodes (8): D-012: acoustic ground truth ingest (ESP32/LoRa, stretch feature), Modelled LoRa chain: node->gateway->webhook, idempotent on (devEui,fCnt), ESC-50 dataset: 2000 clips, 5 folds, leave-one-fold-out CV, CC BY-NC 3.0, gateway_infer.py: mic -> TFLite -> POST /api/acoustic/ingest, Honesty contract: model card ships only measured cross-validated numbers, PlotProof_Acoustic_ML.ipynb: full pipeline, Colab, ~20-30 min, YAMNet (frozen, AudioSet-pretrained) -> pooled embeddings -> dense head, TFLite export, Acoustic ground truth: ESP32 chainsaw/vehicle classifier over LoRa (stretch)

### Community 46 - "Model Evaluation Rationale"
Cohesion: 0.36
Nodes (8): Evaluation reported honestly per country/forest-type, never one global average, The plantation-vs-natural-forest problem (hardest problem in the project), Region hold-out validation, never random-chip splits (leakage), Training set construction: global stratified sampling by ecoregion, S-010: curated stratified regions + Hansen/WorldCover labels; plantation = stratum not pixel label, S-013: evaluation harness (eval.py), honest weakness assessment, no real predictions yet, Labelled training set build (run_build_chips.py, QA grid), Evaluation run (eval.py, test_eval.py, synthetic demo only)

### Community 47 - "Monitoring Cron Routes"
Cohesion: 0.52
Nodes (4): POST(), GET(), recheckPlot(), requireBearer()

### Community 48 - "Analysis API Routes"
Cohesion: 0.53
Nodes (4): absolutiseTiles(), GET(), POST(), getAnalysisClient()

### Community 50 - "MCP Server Config"
Cohesion: 0.33
Nodes (5): GITHUB_PERSONAL_ACCESS_TOKEN, npx, 21st, shadcn-ui, @jpisnice/shadcn-ui-mcp-server

### Community 51 - "Acoustic Gateway Script"
Cohesion: 0.53
Nodes (5): derive_dev_eui(), load_threshold(), main(), post_event(), PlotProof acoustic gateway: microphone -> TFLite classifier -> /api/acoustic/ing

### Community 52 - "NPM Scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, start, test, typecheck

### Community 53 - "Package Metadata"
Cohesion: 0.40
Nodes (4): description, name, private, version

### Community 54 - "Tech Stack Setup Rationale"
Cohesion: 0.40
Nodes (5): Stack: Next.js/TS/Tailwind/Vercel, Postgres+PostGIS/Supabase, Leaflet, PDF gen, S-002: Python 3.13 venv (not 3.12/3.14) for wheel-reliable geospatial stack, S-004: one fixed grid per run, warp every scene onto it via WarpedVRT, Setup: Python 3.13 venv, requirements install, rasterio bundles GDAL, rasterio>=1.4 (windowed COG reads, bundles GDAL)

### Community 55 - "Field Data Migration"
Cohesion: 0.60
Nodes (4): public.attestations, public.farmers, public.media, public.plots

### Community 56 - "Smooth Scroll"
Cohesion: 0.50
Nodes (3): SmoothScroll(), lenis, lenis

## Ambiguous Edges - Review These
- `D-013: deploy readiness + demo-path hardening` → `Motion: GSAP Flip shared-element page transition (expo.inOut, 500-800ms)`  [AMBIGUOUS]
  design-system/plotproof/MASTER.md · relation: conceptually_related_to
- `The solution: satellite change detection -> timestamped PDF evidence pack` → `Style: Liquid Glass - flowing glass, morphing, translucent, iridescent`  [AMBIGUOUS]
  design-system/plotproof/MASTER.md · relation: conceptually_related_to
- `Stack: Next.js/TS/Tailwind/Vercel, Postgres+PostGIS/Supabase, Leaflet, PDF gen` → `rasterio>=1.4 (windowed COG reads, bundles GDAL)`  [AMBIGUOUS]
  PROJECT.md · relation: conceptually_related_to

## Knowledge Gaps
- **210 isolated node(s):** `21st`, `npx`, `@jpisnice/shadcn-ui-mcp-server`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `DEMO_PLOT` (+205 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `D-013: deploy readiness + demo-path hardening` and `Motion: GSAP Flip shared-element page transition (expo.inOut, 500-800ms)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `The solution: satellite change detection -> timestamped PDF evidence pack` and `Style: Liquid Glass - flowing glass, morphing, translucent, iridescent`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Stack: Next.js/TS/Tailwind/Vercel, Postgres+PostGIS/Supabase, Leaflet, PDF gen` and `rasterio>=1.4 (windowed COG reads, bundles GDAL)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `SmoothScroll()` connect `Smooth Scroll` to `Root Layout & Shell`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `lenis` connect `Smooth Scroll` to `NPM Dependencies`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Smooth Scroll`, `Supabase SSR Package`, `Supabase JS Package`, `Package Metadata`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Cache` (e.g. with `DateObservation` and `Grid`) actually correct?**
  _`Cache` has 3 INFERRED edges - model-reasoned connections that need verification._