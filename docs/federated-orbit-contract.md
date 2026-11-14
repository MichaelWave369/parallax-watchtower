# WATCHTOWER LIVE | Cache-first satellite source contract

### Producer
Workflow: `.github/workflows/orbital-catalog.yml`.
Public source: `https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=JSON` and `GROUP=VISUAL`.
Published artifact: `data/orbits.json` in this app's Pages path.

```json
{
  "version": 1,
  "fetchedAt": "ISO-8601 UTC timestamp",
  "source": "CelesTrak GP OMM",
  "sourceUrl": "https://celestrak.org/NORAD/elements/",
  "groups": ["stations", "visual"],
  "items": [ "validated JSON OMM entries; no ISS" ]
}
```

### Consumer
Public files can be read by another ecosystem app, but source verification is its responsibility.
Every predicted signal carries:
- stable id `celestrak-predicted-{NORAD_CAT_ID}`
- `type: orbit`, `confidence: approximate`, `privacyClass: public`
- `timestamp` == propagation time, `facts.elementEpoch`, `facts.catalogFetchedAt`
- coordinates = computed satellite subpoint, **not a ground location, live observation or a target**
- HTTPS provider receipt link with catalog ID

### Cache and freshness boundary
- CelesTrak JSON OMM selected instead of legacy TLE to support catalog IDs >99999.
- One centrally scheduled job, every three hours, with an additional 2h15m source cooldown.
- Source errors stop the update; no HTTP retry loop.
- Client stops rendering predictions when the published cache is older than 12h or the individual element epoch is older than 7d.
- A missing or stale cache is an explicit unavailable state. Never substitute seeded coordinates to make a map look busy.

### GitHub Pages deployment
Since a commit pushed by GitHub Actions using GITHUB_TOKEN does not trigger regular push workflows, the cache workflow builds and deploys Pages in its own job. The normal Pages push job is preserved for human code merges and uses the same concurrency group.

### Future federation
Peekaboo's public-view link stays a separate action. EIRM's NOAA measurements remain a separate evidence family. Later `source-contract/v1` can unify identity, timestamps, health and receipts without collapsing source semantics.

### Build compatibility
The app pins satellite.js **6.0.2** for stable JSON OMM/SGP4 support under Vite's worker bundler. Satellite.js v7.1.0 introduced an optional WASM worker import that causes the Vite 8 default build to fail with a top-level-await/IIFE error even though WATCHTOWER does not use the WASM API. Upgrade only after the Vite compatibility issue is resolved and CI verifies the bundle.
