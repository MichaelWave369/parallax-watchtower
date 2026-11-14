# WATCHTOWER LIVE | staged integration plan

## First pass (this PR)
- Rebrand the public UI, tab metadata, and project documentation to WATCHTOWER LIVE.
- Preserve the existing GitHub Pages path until the repository itself can be renamed.
- Add NASA EONET *curated, open wildfire events* with source receipts; these are not fire perimeters or evacuation alerts.
- Add NOAA SWPC planetary Kp as a **global, deliberately unmapped** space-weather signal.
- Add direct exits to companion public maps: Peekaboo (published public cameras) and EIRM (space weather).
- Preserve existing USGS, news, market, alerts, watch zones, and source-ledger behavior.
- Add adapter normalization tests and PR CI.
- Introduce an optional orthographic globe projection with draggable center, mapped public markers and clickable receipts. This is a visual projection, not a terrain globe or a replacement for a full geospatial engine.

## Next passes (not yet implemented)
1. Extract shared source-adapter contracts (id, source, observedAt, retrievedAt, coordinates, evidence, freshness, status).
2. Introduce actual Peekaboo source packages by agreement with its existing safety/provenance boundary; do not scrape the UI or turn surveillance map markers into viewable cameras.
3. Add opt-in public flight, maritime, and satellite adapters. Verify licensing, CORS, rate limits and privacy constraints before enabling.
4. Upgrade the simple orthographic globe into a full geospatial globe (terrain/land layers, broader zoom navigation) while retaining the Lite Atlas fallback.
5. Add PhiStream explanations grounded in explicit source receipts, not invented cross-source causality.
6. Connect through PhiOS Web/XR after contract tests and accessibility checks.

## Repo rename checklist (manual through GitHub Settings)
If renamed to `Watchtower-Live`, update:
- `package.json` homepage and build script
- `vite.config.ts` base
- README live URL, cross-repository links and Pages settings
- integrations pointing at the current repo path

Do not pre-change the base before renaming: it would break the existing Pages URL.
