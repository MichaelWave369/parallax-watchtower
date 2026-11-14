# WATCHTOWER LIVE

**Real-time signal atlas and OSINT field ledger** for earthquakes, news, maps, markets, watch zones, and receipt-based situational awareness.

Watchtower Live is built around a simple rule: **see more, know sooner, act smarter — without turning public intelligence into stalker tech.** Every signal is treated as a ledger record with a source, timestamp, location/radius when available, confidence label, privacy class, and receipt link.

Live GitHub Pages dashboard:

```text
https://michaelwave369.github.io/parallax-watchtower/
```

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
npm install
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

The earthquake layer uses the public USGS all-week GeoJSON feed. The news layer attempts a public GDELT DOC 2.0 article-list pull and falls back safely when browser CORS or network conditions block it.

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
