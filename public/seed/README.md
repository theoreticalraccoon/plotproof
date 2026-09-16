# Real seed data goes here

Drop your collected plot coordinates as **`public/seed/plots.csv`**, then in the
app open **/intake → Import → “Load bundled seed”**. The importer runs the same
save-gate as live capture (auto-order, self-intersection reject, equal-area area
+ claim mismatch, overlap detection) and only imports valid rows.

## Format

See `plots.template.csv` for a working example. Columns (header row required):

| column           | required | notes                                                        |
|------------------|----------|--------------------------------------------------------------|
| `farmer_name`    | yes      | Farmer's name.                                               |
| `geometry`       | yes      | Plot boundary. **GeoJSON Polygon**, **WKT `POLYGON((…))`**, or a bare `lng lat, lng lat, …` list. Coordinates are **lon, lat** (WGS84). |
| `national_id`    | no       | PII — include only with consent (see DECISIONS D-007).       |
| `membership_no`  | no       | Cooperative member number; used to de-duplicate farmers.     |
| `village`        | no       |                                                              |
| `country_code`   | no       | ISO-3166 alpha-2 (LK, ID, VN, PH…).                          |
| `commodity`      | no       | rubber, coffee, cocoa, oil palm…                             |
| `claimed_area_ha`| no       | Farmer's stated area; compared to the drawn area.            |

## What to collect

Sri Lanka first. A handful of real plots from one cooperative is worth more than
a spread across three countries — zero real plots exist today, so every feature
in the app is still a hypothesis (see `NEXT-STEPS.md`). Use a distinct
`membership_no` prefix per cooperative (e.g. `COOP-LK-###`). Column mapping is
auto-guessed and adjustable at import time.

A plot imported here also feeds the GROW lane: its boundary gives the weather
grid cell for watering and disease-pressure advice on `/grow`.

The template rows are **examples with placeholder coordinates** — delete them.
Nothing here fabricates real plots; the app only ever shows data you load.
