> **CURRENT PREMISE (pivot, see DECISIONS.md D-014 / D-015).** This brief below is
> the *original* problem statement and is kept for history. The product has since
> pivoted: it now helps a **farmer sell their harvest directly to EU/UK/US buyers
> and keep the margin**, by resolving the whole documentation/certification wall
> (which papers are needed, and generating the ones we can) and suggesting
> shipping. The deforestation engine described below survives as the evidence
> behind **one** of those documents — the EUDR proof. Where this brief and the
> pivot disagree, the pivot (and DECISIONS.md) wins. The front door is now `/sell`,
> not plot intake.

---

The problem

The EU Deforestation Regulation requires anyone placing rubber, coffee, cocoa, palm oil, timber, cattle or soy on the EU market to prove the goods did not come from land deforested after a cutoff date. Proof means submitting GPS geolocation for every plot of origin, plus evidence that the land was not forest cleared after the cutoff.

That obligation lands on exporters. Exporters buy from cooperatives. Cooperatives buy from smallholders — thousands of farmers on plots of half a hectare or less, scattered across Indonesia, Vietnam, Papua New Guinea, the Philippines, Sri Lanka, Laos and Cambodia.

A large plantation handles this by hiring a GIS consultancy. A cooperative with 400 smallholder rubber tappers cannot afford that and has no idea where to start. Nobody has ever recorded the boundaries of those plots. There is no map.

The consequence is the thing worth caring about: smallholders get cut out of EU supply chains for lack of paperwork, not for deforesting anything. The farmers least responsible for deforestation are the ones least able to prove it. A regulation designed to protect forests ends up concentrating trade in the hands of large operators who can afford compliance.

EUDR dates (verified 2026-07-18; sources and detail in DECISIONS.md D-001): the deforestation-free cutoff is 31 December 2020 and is fixed — the delays did not move it, and it is the date every plot is assessed against. Compliance obligations apply from 30 December 2026 for large operators and 30 June 2027 for micro/small enterprises and natural persons (Regulation (EU) 2025/2650). Re-check before submission — the timeline has been amended twice.

Who this is for

The paying user is a cooperative or exporter facing a compliance deadline with no budget for consultants.

The person actually operating the software is a cooperative officer or extension agent — one person with one mid-range Android phone, capturing several hundred plots over a few weeks, often with no signal.

The beneficiary is the smallholder farmer, who in most cases never touches the software at all. They stand next to the officer and point at their land. Any design that assumes the farmer has a smartphone, a data plan, and literacy in the interface language is wrong.

There is also a public beneficiary: journalists, NGOs and citizens who currently have no accessible view of clearing in their own district.

The solution

A web platform that takes smallholder plot boundaries anywhere on earth, runs satellite change detection over each one, and produces a timestamped PDF evidence pack an auditor will accept.

The evidence pack is the product. Not the map, not the model, not the dashboard. An auditor cannot act on "our model says 0.87." They can act on a document containing before-and-after satellite imagery, acquisition dates, area calculations, methodology and stated caveats. Everything else in the system exists to produce that document.

This framing should override instinct repeatedly during the build. When there's a choice between a feature that makes the app feel richer and one that makes the PDF more defensible, take the PDF every time.

Why it has to be global from the first commit

This is not a Sri Lankan tool with international ambitions. The regulation is EU-wide, the supply chains are Asia-Pacific, and the same product serves Indonesia, Vietnam and Côte d'Ivoire without modification. It's being submitted to a regional awards programme where "does this scale beyond your country" is a scoring criterion.

Practically: nothing about a country is ever hardcoded. If you find yourself writing a constant that only makes sense in one place, stop and make it configuration.

Features

Plot intake

The bottleneck in this entire domain is that plot geometry doesn't exist. Whoever solves collection owns the workflow. Four paths, and the ranking is deliberate:

Import from existing records — check first, always. Cooperative registries, land deeds, government cadastre, and prior certification schemes like Rainforest Alliance or RSPO often already hold coordinates. Import beats capture every time.

Satellite basemap tracing — the production default. Officer and farmer sit together, phone shows high-resolution imagery, farmer identifies their boundaries, officer taps corners. Two minutes per plot. This sounds less rigorous than walking the land and is usually more accurate: consumer GPS is 3–5 m in the open and worse under rubber or palm canopy where multipath scatters the fix, which on a 70 m-wide plot is a large fraction of the boundary. Tracing has no GPS error at all, and smallholder boundaries are frequently visible from orbit as tree lines, drains and footpaths.

Corner capture. For boundaries not visible from the air. Stand at each corner, hold still, average the fix, reject poor-accuracy readings. Not a continuous walk.

Continuous boundary walk. Build it — it's the most legible thirty seconds of any demo. But understand it doesn't scale: 400 plots at twenty minutes of walking each is 130 hours. It is a demo showpiece and an edge-case tool, not the workhorse.

Record which method captured each plot. A traced polygon and a walked one deserve different confidence in the output, and an auditor will ask.

Field reality the intake must survive

No signal, so everything queues locally and syncs later — non-negotiable, not a nice-to-have. Phone dies at plot 30, so persist after every plot rather than at end of session. Corners tapped out of order, so auto-order points and refuse to save a self-intersecting polygon. Farmers overstate plot size, so compare drawn area against claimed area and warn on mismatch. Two farmers claim the same land, so detect overlap against existing plots — this happens constantly and is a real dispute source. Basemap tiles unavailable in the field, so pre-cache district imagery before going out.

Attestation

A polygon alone is an unsupported assertion. What turns it into evidence: officer identity and capture timestamp recorded automatically, a geotagged photo taken standing at the plot, and the farmer's confirmation — on-screen signature or thumbprint with name and ID.

Analysis

A separate Python service, called over HTTP, queued rather than synchronous. It ingests a polygon and returns a verdict (clear / flagged / insufficient_data), a confidence score, a forest-fraction time series, an estimated clearing date range, cleared hectares, and rendered before/after imagery tiles.

It runs on Sentinel-2 optical fused with Sentinel-1 radar, labelled and validated against Hansen Global Forest Change. Radar is not optional: across tropical Asia-Pacific the optical record has cloud gaps of months, and an optical-only system quietly fails over most of the region it claims to serve.

The web app is built against a stub of this interface and must not assume the service is fast, present, or correct. Full ML specification is in a separate document.

The evidence pack

One PDF per plot, generated server-side, containing plot and farmer identifiers, the polygon as a coordinate table with the CRS used for area calculation stated explicitly, before/after imagery with the polygon overlaid and each tile captioned with exact acquisition date, sensor and cloud cover, the verdict and confidence in plain language, which national forest definition was applied, a full methodology section with model version and data source access dates, and a caveats section.

Write the caveats to be genuinely useful rather than defensive. State what the system cannot distinguish: legal harvesting looks identical to illegal clearing from orbit, mature rubber looks like natural forest, and plots below roughly 0.2 ha are at the edge of what 10 m imagery resolves. Overclaiming is what gets a document rejected by an auditor.

Standing monitoring

A verified plot stays subscribed. New clearing on a later satellite pass alerts the exporter before the shipment leaves — not after the container is rejected at Rotterdam.

Free public layer

The same engine with no login: a global map of flagged clearing, open to anyone. Users can confirm or dispute a flagged patch with a photo and comment, and those disputes are stored as labelled training data.

This is deliberate architecture, not charity. It gives a public-good story and a revenue model in one system, and crowdsourced ground truth is the only realistic way to obtain local labels at global scale.

Acoustic ground truth — stretch only

An ESP32 node with a microphone running an on-device chainsaw and heavy-vehicle classifier, transmitting event flags over LoRa. Satellite says where, the node says right now and it's real. Build the ingest endpoint and data model even without hardware, seeded with simulated events, so the PDF exhibit section renders.

Global correctness details that will bite

Coordinate reference systems. Plots span every UTM zone, both hemispheres, and the antimeridian. Store WGS84, reproject per-plot to an appropriate equal-area projection for hectare calculations, and test with plots in at least four widely separated zones including one south of the equator. Area computed in the wrong CRS is a silently wrong number on a legal document.

Country profiles as data. Each country carries its own cutoff date, national forest definition (canopy cover threshold, minimum area, minimum tree height — these genuinely differ and FAO's definition is not universal), commodity list, language and protected-area source. Adding a country is adding a row, never a code change.

Time zones. Satellite acquisitions are UTC. Farmers, auditors and cutoff dates are local. Store UTC, render local, label every timestamp in the PDF with its zone.

Language. Externalise interface strings from day one even if only English ships. Sinhala, Tamil, Bahasa Indonesia, Vietnamese and Tok Pisin are the difference between an officer using this and not.

Stack

Next.js with TypeScript and Tailwind on Vercel. Postgres with PostGIS for geometry, via Supabase. Leaflet for maps. Server-side PDF generation with a library that handles embedded raster imagery properly. A background job queue. One separate Python service for imagery, behind a clean HTTP boundary.

Constraints

I'm building this alone, part-time around school, for submission in late August — roughly six weeks. That's the binding constraint on every decision. When there's a choice between the better architecture and the one I can finish and still understand in week five, take the second. Boring, well-documented libraries over clever ones.

Target three countries with one cooperative each and around fifteen real plots per country — Sri Lanka plus two of Indonesia, Vietnam or the Philippines. Three countries is not scope creep, it is the entire regional argument: same pipeline, same code, no country-specific tuning, here are the per-country accuracy numbers. If the build slips, drop to two countries rather than ship three that half-work.

Depth over breadth. Forty-five real plots with real coordinates and a real generated PDF will convince a judge the ten-thousand-plot version works. A polished UI on mock data will not.

Do not build: tree-planting gamification, a carbon credit marketplace, blockchain anything, or authentication beyond magic links. If a screen isn't in the three-minute demo and isn't required to produce a PDF, cut it.

The real bottleneck is not code — it's obtaining real plot coordinates from real cooperatives across three countries, which has weeks of lead time. Push me on it if I go quiet about it.

How to work with me

Ask what you need to know before writing code. Propose the schema and wait for sign-off before generating files. Explain tradeoffs rather than silently picking. Flag anything that won't finish in six part-time weeks as soon as you see it and say what you'd cut.

I'll return to this code after gaps of days and will have forgotten it. Comment the non-obvious parts, especially CRS transforms and date handling. Keep a running DECISIONS.md. End each session by telling me exactly where I left off and the next concrete step.