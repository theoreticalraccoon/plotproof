Claude Code build prompt — the ML service

Paste below the line into a Claude Code session opened in the Python service directory. This is the model half of the project; the web app is a separate prompt and a separate session.


What this service is

I'm building a platform that verifies whether smallholder farm plots were deforested after a regulatory cutoff date, producing PDF evidence packs for EU Deforestation Regulation compliance. It has to work across Asia-Pacific — Sri Lanka, Indonesia, Vietnam at minimum — with no country-specific tuning.

You are building only the imagery and model service. The web app already exists and calls this over HTTP. I'm working solo, part-time, and this piece has about three weeks. Submission is late August.

Optimise for something I can finish, validate, and explain to a judge. Not for accuracy at the cost of comprehensibility.

The contract with the web app

The service is called with a plot and returns a verdict. Match this interface exactly — the web app is already built against a stub of it.

In: plot ID, WGS84 polygon, country code, commodity, applicable cutoff date.

Out: verdict (clear / flagged / insufficient_data), confidence 0–1, forest fraction time series with a date per entry, estimated clearing date range if flagged, cleared hectares, per-date cloud cover and sensor used, paths to rendered before/after imagery tiles, model version string.

Analysis is a queued job, not a synchronous call. Return a job ID immediately, write results when done.

The imagery tiles matter as much as the numbers — they go straight into the PDF, so render them properly: true colour, polygon overlaid, acquisition date burned in, consistent scale between the before and after pair.

Data sources

All free, all global, no partnership needed. Check current access terms before building against any of them; hosting and licensing have shifted recently for several.


Sentinel-2 L2A — optical, 10 m, ~5-day revisit. Via Copernicus Data Space or Microsoft Planetary Computer STAC.
Sentinel-1 GRD — C-band radar, sees through cloud. Not optional. Across tropical Asia-Pacific the optical record has gaps of months, and an optical-only system quietly fails over most of the region it claims to serve.
Hansen Global Forest Change (UMD/GLAD) — annual global forest loss, 2000–present, 30 m. Training labels and validation baseline.
ESA WorldCover and/or Dynamic World — 10 m global land cover, for baseline forest state.
JRC Global Forest Cover — built as the EUDR 2020 baseline.
RADD alerts where available — radar disturbance alerts for humid tropics, useful as an independent cross-check.


Do not train on EuroSat. It's temperate European imagery and a model fine-tuned on it will misread tropical canopy. This is the single most important instruction in this document.

Training set construction — where the real work is

Sample chips globally from Sentinel-2, label them from Hansen and WorldCover, and stratify the sample by ecoregion so tropical moist forest, dry deciduous, mangrove, montane and plantation are each represented in meaningful volume. Weight the sample toward Asia-Pacific but don't restrict to it; broader coverage improves generalisation and costs nothing but download time.

The hardest problem in this project is plantation versus natural forest. Mature rubber and oil palm look like forest to a naive classifier — closed canopy, high NDVI. If the model can't separate them, every verdict over Indonesian or Sri Lankan smallholdings is unreliable, because clearing natural forest to plant rubber is precisely the thing the regulation targets. Mine plantation-labelled pixels deliberately, oversample them, and evaluate this distinction as a separate reported metric. Texture and planting-row regularity are the signal; radar helps here more than optical.

Hold out entire geographic regions for validation, not random chips. Random splits leak — adjacent pixels are near-identical and will flatter the score badly.

Label noise is real: Hansen is 30 m and you're predicting at 10 m, its "loss" includes legal harvest and fire, and its annual timing is coarse. Don't chase a score that implies cleaner labels than you have.

Model

U-Net semantic segmentation, per-pixel forest probability. Not a chip classifier.

The reason is plot size. Half a hectare at 10 m is about 50 pixels. A classifier emitting one label per chip tells you nothing about a 50-pixel farm inside it. The mask gets clipped back to the true polygon to compute what fraction of this specific plot was forest on this specific date.

Input per timestep, roughly [10, 256, 256] float32:


Optical: B2, B3, B4, B8, B11, B12 — the two SWIR bands are where forest and non-forest separate most cleanly, don't drop them for a prettier RGB stack
Derived: NDVI, NDMI as channels
Radar: Sentinel-1 VV and VH backscatter, terrain-corrected and speckle-filtered, resampled to the same grid


Output: [1, 256, 256] forest probability.

256 px at 10 m is 2.56 km across, which buffers a smallholding generously. A CNN needs surrounding context; a chip cropped tight to a plot boundary is unclassifiable.

Handle missing modalities explicitly. Some dates have radar only, some optical only. Train with modality dropout so the model degrades gracefully rather than producing garbage when a channel is absent — and record which sensor produced each verdict, because it goes in the PDF.

Use a standard encoder with pretrained weights where the channel count allows, and a plain decoder. Resist architectural cleverness. A judge will ask what the model does and "U-Net, forest probability per pixel" is an answer; a bespoke attention-fusion design is a liability I'd have to defend.

Change detection lives outside the model

The network outputs masks. The temporal decision logic is separate, ordinary Python, and inspectable.

Build the per-plot forest-fraction time series, then apply the country profile's forest definition — canopy cover threshold, minimum area, minimum tree height differ by country and are configuration, never constants. Detect a sustained drop, requiring persistence across multiple subsequent observations so a single cloudy or hazy scene can't trigger a false flag. Estimate the clearing window from the last clear-forest and first clear-cleared dates.

Keep this outside the network deliberately. It's the part an auditor will question, and it needs to be readable rather than buried in weights.

Evaluation — report it honestly, per country

Precision and recall against Hansen, broken out per country and per forest type, never as one global average. A single headline number hides exactly the regional weakness a judge will probe, and a suspiciously uniform score reads as untested.

Also report: performance by plot size bucket, optical-only versus fused, and the plantation-versus-natural-forest confusion matrix specifically.

Below roughly 0.2 ha the plot is at the edge of what 10 m imagery resolves. Return insufficient_data rather than a confident verdict, and say so in the output. That caveat is a credibility asset in front of judges, not a weakness.

Practical constraints

Cache every downloaded scene aggressively — re-downloading the same tile during iteration will waste more of my three weeks than any modelling decision.

Get one plot's full time series rendering correctly, end to end, in each of the three countries before touching the model. Most of the pain in this project is in STAC queries, cloud masking, CRS handling and band alignment, not in training. Sentinel-1 preprocessing in particular is more work than people expect.

Coordinate reference systems: plots span multiple UTM zones and both hemispheres. Store WGS84, reproject per-plot to an appropriate equal-area projection for hectare calculations, and test with plots in at least four widely separated zones including one south of the equator. Area computed in the wrong CRS is a silently wrong number on a legal document.

Training should fit on a single consumer GPU or free Colab. If a design needs more, it's the wrong design for this project.

Order of work


STAC query, download, cache, cloud mask. One plot, one country, verified visually.
Same for Sentinel-1, including terrain correction and speckle filtering. Verify alignment against optical.
Chip extraction and the labelled training set. Inspect samples by eye before training anything.
Train, with region-held-out validation from the start.
Forest-fraction series, change detection, verdict logic.
Imagery tile rendering for the PDF.
Per-country evaluation and the metrics table.
Wire to the HTTP contract, replace the web app's stub.


How to work with me

Ask what you need to know before writing code — which STAC endpoint, which three countries, whether I have plot coordinates yet. Then propose the data pipeline and wait for sign-off.

Flag anything that won't finish in three part-time weeks as soon as you see it and say what you'd cut. If the fused model is going badly by the end of week two, tell me to ship optical-only with an honest caveat rather than shipping nothing.

I'll be returning to this code after gaps of days. Comment the non-obvious parts, especially CRS transforms, band indices, and date handling. Keep a DECISIONS.md. End each session by telling me where I left off and the next concrete step.