# Flora Mangrove Atlas

**Free, open-source mangrove monitoring for any coastline.** Draw or upload a site and get four decades of mangrove extent, gain and loss, canopy height, biomass, a screening carbon stock, tidal-wetland context and *live* Sentinel-2 condition, all computed on the fly in Google Earth Engine, with every number traced to a cited, openly licensed dataset.

Built by [Flora Carbon AI](https://floracarbon.ai) (Kolkata). Licensed under Apache-2.0.

> **Status:** v0.1. The UI and API are tested end-to-end with mocked Earth Engine responses. Run the Code Editor check (below) once you connect your own Earth Engine project.

---

## Why another mangrove tool?

We reviewed Global Mangrove Watch, MangMap, TNC's Blue Carbon Explorer, Mapping Ocean Wealth, DEA Mangroves, the Coastal Carbon Atlas and the commercial dMRV tools before building this. The Atlas keeps what works (GMW's card-per-indicator layout, analysis of user-drawn areas) and fixes the gaps:

| | Global Mangrove Watch | **Flora Mangrove Atlas** |
|---|---|---|
| Extent time series | GMW only | **Two independent maps side by side** (GMW v3 + CGMD annual 1984–2023), plus a dataset-agreement score shown as an uncertainty floor |
| Canopy height | 30 m, ~2000 | **12 m TanDEM-X (2015)** plus 30 m SRTM-era for comparison |
| Current condition | Monthly loss alerts only | **Monthly NDVI + Mangrove Vegetation Index for the last 24 months**, with Cloud Score+ masking and clear-sky coverage per month (monsoon-aware), plus a "latest Sentinel-2" imagery layer |
| Carbon | Fixed factors | **Transparent, switchable factors** (IPCC 0.47 / GMW 0.451), explicitly labelled as a screening estimate |
| Provenance | Info popups | **Every card cites its dataset, version and licence**. Exports (JSON/CSV/GeoJSON/PDF) carry full citations |
| Map stack | Mapbox (paid token) | **MapLibre + OpenFreeMap + EOX**: no map API keys, no vendor lock-in |
| Backend | Rails + PostGIS + Heroku + Cloud Functions | **One Next.js app.** Earth Engine is the only backend, so self-hosting means one service plus one key |
| API | Undocumented | **Documented open JSON API** (`/api/analyze/{module}`, `/api/layers/{id}`) |
| Licence | MIT | Apache-2.0 (explicit patent grant) |

## Features

- **Map layers:** annual extent 1984–2023 (time slider), GMW v3 epochs, GMW gain/loss between any two epochs, 10 m 2020 extent, 12 m canopy height, biomass, max height 2000, tidal-wetland change 1999–2019, tidal flats, latest 90-day Sentinel-2 true colour and NDVI. Optional soil carbon.
- **Area analysis:** draw a polygon or box, upload GeoJSON / KML / KMZ / zipped shapefile, or search a place. Five analysis modules run in parallel and each card loads independently.
- **Shareable state:** layers, years, opacity, basemap and view live in the URL.
- **Exports:** JSON report (with citations), long-format CSV, GeoJSON boundary, and print/PDF.
- **Accessible:** table view for every chart, keyboard drawing cancel (Esc), light and dark themes, responsive down to 390 px.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # add your Earth Engine service account (below)
pnpm dev                     # http://localhost:3000
```

Without Earth Engine credentials the app still runs (basemaps, upload, methods page) and tells you what's missing.

## Connect Earth Engine

1. Create or choose a Google Cloud project and [register it for Earth Engine](https://code.earthengine.google.com/register).
   - **Licence note:** Earth Engine is free only for noncommercial use by eligible organisations. A for-profit operator, Flora included, needs a commercial plan. Check [Earth Engine pricing](https://cloud.google.com/earth-engine/pricing) and [noncommercial eligibility](https://earthengine.google.com/noncommercial/). The code itself is free for anyone to use.
2. Enable the **Earth Engine API** on the project.
3. Create a **service account**, grant it the `Earth Engine Resource Viewer` role (plus `Service Usage Consumer`), and create a JSON key.
4. Put the key in `.env.local`:

   ```bash
   GEE_SERVICE_ACCOUNT_KEY=<the JSON, or base64 of it>
   GEE_PROJECT=<your-cloud-project-id>
   ```

5. Check it at `GET /api/health`. It should return `configured: true`.

### Optional: soil carbon

The Sanderman et al. (2018) 30 m soil carbon map isn't in a public Earth Engine catalogue. Download it from [Harvard Dataverse](https://doi.org/10.7910/DVN/OCYUIT), upload it as an asset (values in Mg C/ha), share it with the service account, and set `GEE_SOC_ASSET=projects/<you>/assets/<name>`. Totals then include soil carbon.

## Verify the Earth Engine logic yourself

All Earth Engine logic lives in one pure file, `src/lib/server/ee/recipes.ts`. Generate a stand-alone Code Editor script from it:

```bash
pnpm ee:script > atlas-recipes.js
```

Paste the script into <https://code.earthengine.google.com>. It adds every layer and prints every statistic for a Sundarbans test box. Reviewers can then audit exactly what the server runs.

## API

| Method | Path | Body / query | Returns |
|---|---|---|---|
| `GET` | `/api/health` | | Engine status and limits |
| `GET` | `/api/layers/{layerId}` | `year`, or `from` & `to` | XYZ tile URL template (valid for hours) |
| `POST` | `/api/analyze/{module}` | `{ "geometry": GeoJSON, "carbonFraction"?: 0.47 }` | `{ result, datasets, warnings, partial, … }` |

Modules: `extent`, `change`, `structure`, `coastal`, `condition`. Layer IDs are listed in `src/lib/layers.ts`.

```bash
curl -X POST http://localhost:3000/api/analyze/extent \
  -H 'content-type: application/json' \
  -d '{"geometry":{"type":"Polygon","coordinates":[[[88.75,21.95],[88.88,21.95],[88.88,22.05],[88.75,22.05],[88.75,21.95]]]}}'
```

Public instances apply limits: area ≤ 250,000 ha, ≤ 20,000 vertices, and 30 analyses per hour per IP. All limits are configurable (see `.env.example`). Results are cached for 12 h, and identical requests are served from the cache.

## Architecture

```
Browser (Next.js client)                       Server (Next.js route handlers)        Google Earth Engine
┌──────────────────────────────┐   /api/layers  ┌──────────────────────────┐ getMapId ┌───────────────┐
│ MapLibre + terra-draw         │──────────────▶│ tiles.ts  (map-id cache)  │────────▶│ public catalog │
│ Layer panel / URL state       │◀── tile URL ──│                           │         │ assets (GMW,  │
│ Upload parsing (in-browser)   │                │ analyze.ts → recipes.ts   │────────▶│ CGMD, NASA,   │
│ Cards (Recharts) + exports    │──/api/analyze─▶│ AOI validation, limits,   │ reduce  │ Murray, S2)   │
└──────────────────────────────┘◀── JSON ──────│ rate limit, result cache  │◀────────│               │
                                                └──────────────────────────┘          └───────────────┘
```

- `src/lib/datasets.ts`: provenance registry (producer, version, licence, citation, asset IDs). It is the single source of truth.
- `src/lib/layers.ts`: map layer definitions and legends.
- `src/lib/server/ee/recipes.ts`: pure Earth Engine image and reduction builders.
- `src/lib/analysis/shape.ts`: pure functions that turn Earth Engine output into typed results (unit-tested).
- `src/lib/geo/aoi.ts`: GeoJSON normalisation and limits (unit-tested).

## Deploy

- **Vercel / any Node host:** `pnpm build && pnpm start`. Set the env vars. The analysis route allows up to 300 s.
- **Docker:** `docker build -t flora-mangrove-atlas . && docker run -p 3000:3000 --env-file .env.local flora-mangrove-atlas`

In-memory caches and rate limits are per instance. For multi-instance deployments, put a CDN in front of `/api/layers` (responses send `s-maxage=3600`) and swap `RateLimiter`/`TtlCache` for Redis.

## Tests

```bash
pnpm typecheck && pnpm lint
pnpm test          # unit tests (AOI, result shaping, carbon, URL state, config, export)
pnpm build && pnpm test:e2e   # Playwright; Earth Engine and tiles are mocked
```

## Data and limitations

See `/methods` in the app for every dataset, formula and citation. In short:

- These are **screening estimates** from global maps.
- Biomass uses global allometry from around 2000.
- Belowground biomass is not included.
- Planting younger than about 3–5 years is usually invisible at 10–30 m resolution.
- The results are **not sufficient for carbon-credit issuance** under Verra VM0033 or Gold Standard. Those need field plots, stratification, baselines and uncertainty deductions.

## Roadmap

**Open Atlas**

- Sentinel-1 radar alerts that see through monsoon cloud
- Annual 10 m extent
- Planting-cohort survival tracker
- Bengali, Hindi, Odia and Tamil UI
- QGIS plugin
- Community photo ground truth

**FloraScope (Flora's paid tier)**

- Field-plot-calibrated biomass
- Soil cores
- Stratification
- VM0033 / Gold Standard calculation engine with uncertainty
- Audit trail and pre-audit checks
- PDD and monitoring-report drafting (Carbon Intel)

## Contributing

Issues and PRs are welcome. See `CONTRIBUTING.md`. If you use the Atlas in research, please cite the underlying datasets listed on `/methods`.

## Credits

The data comes from Global Mangrove Watch (Aberystwyth University, soloEO, JAXA, Wetlands International, TNC), The Mangrove Lab (CGMD), NASA JPL/ORNL DAAC (Simard et al.), James Cook University and the University of Queensland (Murray et al.), ESA Copernicus, and Google (Cloud Score+). Basemaps are Sentinel-2 cloudless by EOX (CC BY 4.0) and OpenFreeMap / © OpenStreetMap contributors.
