# Watchtower Ascension: original repository assessment

Audit date: November 26, 2026 (America/Los_Angeles). Original commit: `b44e36ec5a87d585e4b6799f9e81d74afea64136`. This document describes the original implementation, before the Ascension candidate. A finding listed here is not a claim that it remains in the candidate; see the candidate report and tests for resolution status.

## Repository and architecture

The 78 tracked files describe a functioning React 18/Vite static application, not a blank project. The live entry is `src/main.tsx` → `src/App.tsx` → `components/WatchtowerDashboard.tsx`; the `app/` Next-style files are legacy scaffolding and not the Vite entry. GitHub Pages base `/parallax-watchtower/` must remain unchanged. There is also an optional Netlify GDELT function.

The dashboard embeds direct-browser USGS, GDELT, CoinGecko, EONET, NOAA and ISS fetches plus a same-origin orbital cache. Atlas modes are tile-free local canvas, orthographic globe, and lazy MapLibre/OpenFreeMap. Separate components provide Explore (50 curated external links), two historical FAA incident cases, local Discovery Inbox and UTC temporal Discovery Trails. Pure `lib/` modules already enforce several meaningful source and privacy contracts.

The useful boundary to preserve is: source receipts and timestamps survive normalization; fallback, private and unreceipted data do not become FieldPack evidence. A newsroom layer can be added beside these capabilities without replacing React, forcing a backend or changing historical incident records.

### GitHub state at intake

- No open issues and no open pull requests returned by the connected repository searches.
- Thirteen remote branches including main were returned. Six older integration branches are ancestors of main; six later feature branch tips are not ancestors (their work is already represented on main through merges/squashes). An ancestry check alone does not establish an unmerged feature.
- Twelve historical PRs cover public feeds, orbit cache, FieldPack, map repair, startup recovery, Explore, incidents, discovery cache and trails.
- Four workflows: CI, Pages, orbital cache/deploy (three-hour schedule), discovery cache/deploy (twice-daily schedule).
- Latest observed cache/deploy runs succeeded: [discovery 45866432799](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45866432799) and [orbits 45863131978](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45863131978).
- The earlier [discovery 45666631584](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45666631584) and [orbit 45577746601](https://github.com/MichaelWave369/parallax-watchtower/actions/runs/45577746601) failures occurred in deploy-pages after successful collection, tests, builds and artifact uploads. Both logs say no `github-pages` artifact metadata was found. These are deployment failures, not evidence of source-feed failure; the precise external cause was not established.

## Baseline evidence

`npm test` executed against the original modules: **59 passed, 0 failed, 0 skipped**; Node test process duration **296.66 ms** on this workspace. Existing tests cover adapters, projections, URL/schema/privacy gates, historical incident citations and discovery workflows.

The original repository has no lockfile; `npm ci` therefore cannot run. `vite` and `@vitejs/plugin-react` are `latest`, making installs and builds time-dependent. CI uses `npm install`. The TypeScript config includes Next-era files and a Next plugin while the project is Vite; production `vite build` does not perform a complete strict typecheck. Dependency auditing and reproducible installation need explicit candidate evidence.

The eight original Playwright cases use the production base path and deliberately block external providers. They validate shell visibility, Lite/Globe switches, map failure recovery, Explore, incident navigation, and discovery workflows. They do not prove a successful vector basemap, provider availability, mobile layouts, new newsroom workflows, or real-time event truth.

## Verified defects and recommendations

| Finding | Original code/evidence | Required behavior |
|---|---|---|
| Missing or malformed GDELT dates become current time | `WatchtowerDashboard.tsx` original lines 111–117 | Reject records with unknown index time or preserve unknown explicitly; do not replace it with retrieval time. GDELT seen time is not event occurrence/publication time. |
| Geographic fabrication | Original lines 120–126 map generic `earthquake`, `wildfire`, or `california` to Northern California; `shasta county` is caught by the earlier Mt. Shasta match | Leave story geography unknown unless supported by explicit source data. Publisher country is not event location. |
| Unsafe legacy news destination | Raw `article.url` becomes `sourceUrl` and an anchor without safe HTTPS validation | Reject executable schemes, credentialed links, local/IP destinations and unexpected ports before display. Use `noopener noreferrer`. |
| Synthetic feed counts | Unavailable news/market sources create current-dated fallback records; they contribute to visible signals and news alert counts | Show unavailable-source UI with zero invented records. |
| Market values invented from missing fields | Missing price/change become zero; missing observation timestamp becomes now | Require valid positive prices and actual provider update time; keep missing change unknown. |
| Bad stored proxy URL can break the news path | `new URL()` in `gdeltProxyUrl` runs before the per-endpoint try/catch | Validate user configuration and catch malformed stored settings; keep direct fallback available. |
| Browser ingestion can hang or overlap | Sequential USGS/news/market requests have no timeout; interval can overlap an incomplete pull | Bound response time and size, isolate failures, prevent overlapping runs, cancel on unmount. |
| Map support check always fails in installed MapLibre version | `maplibregl.supported()` is absent from MapLibre 6.18 exports; real Actions build warns `IMPORT_IS_UNDEFINED` | Use the actual constructor/WebGL capability path, and test functioning map initialization separately from fallback. |
| Optional proxy is insufficiently bounded | Original Netlify handler has a fixed upstream host (no arbitrary-host SSRF), but no query/count limit, timeout, streaming cap, redirect refusal or response-shape gate | Keep fixed host, bound query/count/time/body, reject redirects and non-JSON, sanitize output metadata, redact raw errors. |
| Local save robustness | Several control handlers write localStorage without try/catch despite unused safe wrapper functions | Storage denial/quota must be recoverable and must not blank the dashboard. Validate lat/lon ranges and positive radius on saved/custom lenses. |
| Inconsistent map filtering | Vector adapter excludes demo/private/bad coordinates; Lite/Globe paths rely on callers and the fallback news has coordinates | Remove synthetic records at ingestion and retain explicit public-only coordinate checks. |
| Existing collector memory caps are post-read | `refreshDiscoveryLeads.mjs` and `refreshOrbitalCatalog.mjs` check size after `response.text()` | A future hardening pass should cap streamed bytes while reading, including for chunked responses. |

## Security and privacy assessment

Existing React rendering uses text interpolation; no `dangerouslySetInnerHTML`, `eval`, or dynamic source execution was found in the original application. Source records are still untrusted data. Safe text rendering alone does not make arbitrary anchor URLs or an unbounded XML/JSON parser safe.

FieldPack v1 deliberately whitelists public evidence and excludes browser location, saved watch zones, notes, query history and arbitrary provider error metadata. Discovery stores locally and requires explicit queueing; its workflow labels do not claim verification. Existing source URL gates vary in strictness between modules, so a new news contract should use one centralized validation boundary. No mandatory account, telemetry, ad platform or private-person tracking feature was found in the audited code.

Browser geolocation is user-triggered. Peekaboo navigation includes the selected watch lens in a URL hash only after the user follows the link; this is an explicit handoff to another application, not a shared-source ingestion contract. Private settings and notes must not enter public news caches or briefing exports.

GitHub Pages cannot supply arbitrary HTTP security headers from repository configuration alone. New static content should use appropriate document-level controls where compatible; any Netlify/self-hosted header claim must be scoped to that host. No full third-party penetration test or independent production security certification was performed.

## Ecosystem inspection (read-only)

The linked repositories were read through the connected GitHub service. No downstream repository was modified, no local model was contacted, and no private memory was synchronized.

| Repository | Current source inspected | Verified interface/boundary and integration implication |
|---|---|---|
| PhiOS | `README.md` blob `3d057271c022dc9a2593a79b4a1a79fd5f6de682` | Local-first authority-aware runtime, advisory/read-only evidence paths and explicit network flags. No news/FieldPack import endpoint was established by the inspected documentation. A user-triggered validated public-envelope consumer remains downstream work. |
| PhiBuddy | `README.md` blob `9e5a50b08cf73bb32d86afa1ac1660fbdb29b3e6` | Local Ollama through Rust/Tauri, explicit evidence attachment, separate local memory, and a limited allowlisted plaintext retriever. No browser-callable Watchtower import service is documented there. Export/source references are a feasible explicit handoff; direct local-model connectivity is unverified. |
| Agentora | `README.md` blob `16451d65dda2af95fcb915fd90b2583bbf5e06ea` | Local FastAPI/SQLite. The documented discovery bridge is opt-in, operator-key-gated and specific to PhiDiscovery role packets. It must not be presented as a general Watchtower endpoint. |
| PhiMemory9 | `README.md` blob `09bc8ea5d560f85e9085701f5e5447035e781285` | Experimental provenance/evidence/contradiction ledger; localhost reader requires an access key and mutation plans require approval. Synthetic integrations remain HELD. Public news references do not grant memory write authority. |
| Peekaboo | `src/productNavigation.js` blob `f53f24194764e905406092ccbafad6a7a3fe3b24` and `src/App.jsx` blob `b09f2ffa467d6fba4f78c06b30b2e9a1ead7ed73` | Existing `map=zoom/lat/lon`, `layers=` and `mode=public` URL-hash handoff matches the implemented navigation parser. Public Views is separate from explicit OSM surveillance scans. |
| EIRM (`schumann-live-react`) | `README.md` blob `5012e810ce4e993f4742b175805fb2859e2f3e22` | Separate public NOAA context and spectrogram viewer; optional measured data is distinct from reference harmonics and local observation notes. No common Watchtower synchronization interface is documented in the inspected README. |

A scoped connector code search for `fieldpack` in PhiOS, PhiBuddy, Agentora and PhiMemory9 returned no matches. Search absence is not a proof that no implementation exists; only the interfaces above were established. Existing Watchtower FieldPack v1 remains the verified producer contract.

## Implementation priority and release boundary

The highest-value coherent slice is a bounded metadata ingestion cache with an explicit source registry, a usable newsroom interface, conservative reversible grouping, attributable evidence comparison, deterministic briefing export and local research/watch settings. It should reuse Pages plus optional scheduled collection rather than introduce a mandatory server.

Deep multilingual classification, calibrated contradiction detection, full-country coverage, complete historical playback, production local-model assistance, comprehensive emergency warning coverage, and a self-hosted intelligence node remain separate verified milestones. Their presence in the controlling specification must not turn into completion claims merely because tabs or contracts exist.

Draft PR publication is authorized by the controlling mission. Merge into main and production release require Michael's explicit authorization. A local build, mock browser test, upstream HTTP success and a successful production deployment are different kinds of evidence and must be reported separately.

## Candidate typecheck scope

The Ascension candidate enables strict TypeScript checking of the active Vite entry points, shared UI components and `vite.config.ts`, with Vite's actual `ImportMetaEnv` definitions. Imported JavaScript modules remain part of type inference. The inactive `app/` Next-style scaffold is preserved unchanged and excluded because neither Vite nor the deployed Pages bundle uses it; installing Next solely to satisfy that unused scaffold would add an unrelated runtime. Strictness is retained, and canvas contexts, validated discovery receipts, temporal windows and catalog results use actual narrowed types rather than blanket error suppressions. Typecheck results are recorded in the candidate report.
