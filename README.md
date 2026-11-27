# WATCHTOWER LIVE

**A public news command center and source-receipted signal atlas** for understanding reports, inspecting evidence, building local research, and exporting transparent briefings.

Watchtower Live is built around a simple rule: **see more, know sooner, act smarter — without turning public intelligence into stalker tech.** Every signal is treated as a ledger record with a source, timestamp, location/radius when available, confidence label, privacy class, and receipt link.

Live GitHub Pages dashboard:

```text
https://michaelwave369.github.io/parallax-watchtower/
```

## Ascension 01 candidate

The default **News Command** workspace now contains nine working desks: Global Command, World Affairs, Science & Technology, Natural Hazards, Policy & Economics, My Watchlist, Intelligence Brief, Research Room, and Source Observatory. The existing **Live signals**, **Explore**, **Incident Room**, and **Discovery Inbox** remain available from the top navigation.

- **Six reviewed metadata adapters:** NASA, UN Geneva, ECB, arXiv, Federal Register, and USGS. RSS, Atom, JSON and GeoJSON collection runs centrally, with a six-hour minimum cooldown and per-source backoff. The browser reads the same-origin cache rather than polling publishers.
- **Evidence first:** separate publication, occurrence, modification and retrieval clocks; original receipts; explainable evidence labels; conservative, reversible report groups; side-by-side source comparison. Grouping does not verify claims or independence.
- **Local research:** saved workspaces and keyword watches, pinned public evidence, hypotheses, disputed claims, corrections to review and disconfirming evidence. No automatic notifications or personal-data synchronization.
- **Portable briefings:** deterministic, source-linked Markdown/JSON and printable output. IndexedDB keeps at most 2,000 public metadata records with 7/30/90-day retention; public archive imports remain unreviewed. Notes, watches, browser location and saved views stay out of public exports.
- **Responsive UI:** dark/light themes, compact mode, keyboard search (`/`), fullscreen, and local history that can recover after feed failures. Old feed failures no longer generate synthetic headlines or market prices.

The reviewed collection initially returned **115 real public metadata records** on November 26, 2026, at approximately 4:10 p.m. Pacific. This is a dated source snapshot, not a claim of continuous live verification. Coverage is institutional and research-focused, currently English, and incomplete. arXiv announcements and date-only Federal Register documents have no invented precise publication time; use the all-dates archive to inspect undated metadata.

This is a candidate branch. Main and the public deployment are changed only after explicit merge authorization. The scheduled news workflow is installed on the branch and becomes operational on main after merge; its first deployed run still needs verification.

See [source policies](docs/news-sources.md), [intelligence method](docs/news-intelligence.md), [mission report](docs/ascension/mission-report.md), [requirements register](docs/ascension/requirements-register.md), and [remaining roadmap](docs/ascension/roadmap.md).

## Source-integrated field atlas

This public repo starts with a mobile-safe MVP:

- Live USGS earthquake feed
- Lite Atlas canvas map with no external map tiles/CDNs
- Corning, Mt. Shasta, Northern California, and West Coast watch lenses
- Consent-based browser location lens
- Local radius filtering
- 24h / 7d filters, search, alert preview, and copyable field report
- Source Ledger and Watchtower Log panels
- Public news adapter with safe fallback behavior
- Confidence and privacy labels visible in the UI

## Guardrails

Watchtower is for public-signal awareness and personal/local readiness. It does **not** support stalking, hidden tracking, doxxing workflows, private-camera ingestion, face identification, or person-targeting workflows.

Core boundaries:

- Consent-based location only
- Public and official sources preferred
- No stalker tech
- Receipts over hype
- Correlation does not equal causation
- Confidence is visible, not implied

## Run locally

```bash
npm ci
npm run dev
```

Then open:

```text
http://localhost:5173
```

Build for GitHub Pages:

```bash
npm run build
```

## Source notes

The Live signals earthquake layer uses the public USGS all-week GeoJSON feed. Its legacy GDELT adapter remains available, but failed requests produce an unavailable source state and no synthetic news. The new newsroom uses the six-source scheduled metadata cache documented above.

## Optional source proxy

GitHub Pages is static. Some public data sources may reject direct browser requests. This repo includes a Netlify-compatible GDELT proxy function:

```text
netlify/functions/gdelt-proxy.mjs
```

See:

```text
docs/source-proxy-strategy.md
```

## Project motto

> The Watchtower does not control the sea.  
> It helps people see the conditions clearly.

## Federated source expansion

This release adds:
- NASA EONET open, curated wildfire records (not every active wildfire; locations are **not** incident perimeters)
- NOAA SWPC planetary Kp observations (global context only, never pinned on the local map)
- Companion entry points into Peekaboo and EIRM; these links do not imply shared camera ingestion
- Orthographic draggable globe view with marker selection and regional map toggle
- Adapter tests in `npm test` and a pull-request CI workflow

The visible product has been renamed to **WATCHTOWER LIVE**. The old `parallax-watchtower` GitHub repository slug and Pages base path are temporarily retained for backward compatibility. A repository rename requires a separate migration of URLs and hosting settings. See `docs/watchtower-live-plan.md`.

Feed status indicates an adapter fetch succeeded, not that the underlying event is happening in real time or that the source is complete.

## ISS satellite positions and Peekaboo regional handoff

- Displays a single sampled **International Space Station** ground position from the [Where the ISS at? API](https://docs.wheretheiss.at/w/developer), when the source responds with a fresh timestamp. No fake trail or continuously interpolated track.
- ISS sampling inherits the one-minute refresh interval; only the ISS is supported at this stage.
- No marker is shown when the position is missing, malformed or stale. The Source Ledger reports the failure.
- The Peekaboo shortcut now opens **Public Views** centered on the current Watchtower lens using Peekaboo's supported map URL. Peekaboo remains a separate app; nothing is scraped or silently scanned.

See `docs/iss-peekaboo-bridge.md` for exact data constraints and tests.

## Shared orbital catalog: CelesTrak SGP4 predictions

- Select **orbit** in the signal layers to see predicted ground positions of the public STATIONS and VISUAL orbital groups (the ISS is excluded to avoid duplicating the separate sampled ISS source).
- A **GitHub Action**, not every browser, downloads CelesTrak JSON OMM once per three-hour update cycle and publishes `public/data/orbits.json` through GitHub Pages. It observes a minimum 2h15m time gap and stops, without retrying, on non-200 HTTP responses.
- Orbital elements are **not** live telemetry. The browser uses satellite.js SGP4 to propagate each validated element set to the current time; each signal carries element epoch, cache-fetch time, and propagation time.
- Stale shared cache (older than 12h), old elements (over 7d), or invalid propagation mean **no marker**. The Source Ledger explains unavailable data.
- The initial placeholder intentionally contains zero records; the first successful scheduled/manual catalog workflow must run after merge before orbit markers appear.
- Scheduled cache updates build and deploy Pages directly because GitHub-token commits do not trigger downstream `push` workflows.
- CelesTrak use is governed by [their published usage policy](https://celestrak.org/usage-policy.php). Groups are small and cached, with no direct end-user fetches.

This is a limited visual/space-station catalog, not an unrestricted military or all-satellites tracker.

## Portable Φ FieldPack v1 for ecosystem integrations

The **Φ FieldPack v1** card includes **Download FieldPack JSON** and **Copy FieldPack JSON**. It packages currently visible **public** source-receipted signals into a bounded, user-triggered JSON artifact; excluded records include private/local signals, fallback/demo placeholders and missing/unsafe source URLs. It includes provenance semantics, source health and timestamps.

**Privacy:** browser location and saved watch-zone coordinates, notes, search history and raw source errors are not exported. Public source event coordinates can be present, including approximate region or predicted orbital subpoints with their proper labels. Nothing is uploaded automatically.

See `docs/fieldpack-v1.md` for the schema, privacy guarantees, an example, and consumer guidance. `/data/field-sources.v1.json` exposes machine-readable federation metadata, but external companion apps remain **linked**, not silently synchronized.

## Vector basemap repair and marker clustering

The original OpenStreetMap raster tile canvas was blocked (403) because it explicitly omitted the HTTP Referer. It also recreated tile images on every selection and feed refresh. **Map** now uses MapLibre GL JS with [OpenFreeMap's key-free vector tiles](https://openfreemap.org/) and honors their attribution requirements; it makes **no requests to the OpenStreetMap Foundation's raster tile service**.

A new **Lite** mode uses a local, tile-free grid when WebGL or the vector source fails, while the existing **Globe** remains available. MapLibre clusters public events at broad zoom levels so earthquake, fire and orbital layers can be explored without overlapping thousands of markers. Click a cluster to expand, and a point to inspect its source receipt. The source feed/alert data is unaffected.

See `docs/map-403-repair.md` for diagnosis, policy links, acceptance checks and limitations.

## Startup recovery and browser smoke tests

The default mode is temporarily **Lite Atlas** so a third-party WebGL dependency cannot blank the entire page at boot. Choose **Map** to load the OpenFreeMap/MapLibre map on demand; a map crash or provider failure switches back to Lite. A top-level application error boundary shows a readable recovery screen instead of an empty page. The GitHub Actions CI now includes a real Chromium/Playwright smoke test of the production Pages base path with external sources blocked. Run with `npm run build && npm run test:browser` after installing Playwright Chromium.

## Scheduled Discovery Inbox cache (review-only)

A twice-daily GitHub Actions job requests the official USGS M4.5+ earthquake GeoJSON feed and NASA EONET curated open-wildfire references. It publishes only a bounded, HTTPS-receipted, **unreviewed candidate snapshot** at `/data/discovery-candidates.v1.json` for Discovery Inbox to load. The browser never polls these providers separately for the scheduled snapshot.

Source-health and age are visible; cache snapshots older than 36 hours cannot be queued as fresh. Every candidate requires a click to enter the existing local review inbox. **No candidate is automatically published as an Incident Room case or represented as an emergency alert.** NASA event references are not wildfire boundaries. See `docs/discovery-cache.md`.

## Cross-source Discovery Trails

Discovery Inbox now includes a source-backed temporal comparison view. Browse USGS and NASA EONET records side by side by UTC day or calendar week, inspect primary receipts, and explicitly export a research timeline. A shared time interval is **not evidence of geography, causality or a verified incident**. See `docs/discovery-trails.md`.

## Cartographer map reliability

The map progressively renders verified OpenFreeMap geography, independent bundled Natural Earth vector geography, and a Canvas2D geographic atlas. Country boundaries and public signal markers remain usable without external providers or WebGL. See the [root-cause report, acceptance matrix, and screenshots](docs/cartographer/mission-report.md).
