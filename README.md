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
