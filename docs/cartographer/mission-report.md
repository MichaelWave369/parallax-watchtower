# Operation Cartographer — permanent geographic fallback

November 26, 2026 (America/Los_Angeles). Continued the validated Ascension implementation after its PR #13 was merged. Base: `3f967492b3c8ae190b589093d681fc9e88b4a05c`; it retains Ascension `24290b6` with only a subsequent discovery-cache refresh. This candidate is for draft review. It does not merge or deploy production. The PR records its final published SHA and exact-head CI run.

## Actual root cause

The production build of MapLibre 6.18.0 resolved its default worker relative to the bundled application chunk. Vite did not emit that default-named worker. Real Chromium requested:

`https://michaelwave369.github.io/parallax-watchtower/assets/maplibre-gl-worker.mjs?v=6.18.0`

**HTTP 404**, `text/html`. Browser console: `Error: Worker failed to load. Check that the worker URL is correct.` The style, TileJSON and sprites returned HTTP 200 with permissive map CORS. WebGL 2 initialized with a 914 × 550 canvas. This was a missing build asset, not evidence that the provider or GPU had failed.

The old implementation waited for `load` before registering its signal source. Without working decoding workers, neither geography nor markers rendered. Its deadline checked only `isStyleLoaded()`, and constructor errors were discarded. An empty, background-only test style never exercised geographic decoding or tile workers, so the old renderer test passed.

The status mismatch is separately reproduced: after automatic fallback, pressing Map again displayed the vector heading and black canvas while the global `fieldNote` still said **“Vector basemap did not load; showing Lite Atlas.”** Mode changes did not reset that unrelated status string. [Production network/console and both states](evidence/production-retry-before.json); [black canvas after retry](screenshots/production-black-after-retry.png). The older fallback itself was only a grid, and truncated marker drawing at 900 records. Its globe had no country geography and truncated at 1,500.

## Investigation receipts

| Concern | Observed result / repair |
| --- | --- |
| OpenFreeMap availability | Production dark style, TileJSON and sprites returned 200. Candidate Liberty style, actual vector `.pbf` tile, raster geography, glyphs and sprites returned 200 in Chromium. |
| Workers / base path | Production default worker was 404. Explicit Vite `?worker&url` import emits a hashed module worker; `setWorkerUrl` loads it with 200 below `/parallax-watchtower/assets/`. |
| CORS | Map responses permitted the request. A separate production GDELT CORS failure was captured; it did not cause the map worker 404. |
| CSP | Existing production policy permits same-origin workers. It was not relaxed. An actual browser `worker-src 'none'` violation now exercises Canvas recovery. |
| WebGL / acceleration | Real WebGL 2 via Chromium's SwiftShader software GPU rendered country polygons. Disabled WebGL and context loss are separately tested. Physical vendor GPU testing is not claimed. |
| Dimensions / lifecycle | Production canvas dimensions were nonzero. Explicit absolute positioning and ResizeObserver cover lazy mount, resizing and fullscreen. Unmount removes the map and observer; stale attempt callbacks are ignored. |
| Geographic readiness | A nonzero rendered geographic feature count and matching geographic projection are required before uncovering GL. Neither controls, attribution, style load nor a black background can mark Ready. |
| Source/layer registration | MapLibre owns basemap sources and country fill/boundary layers. A provider-independent Canvas layer owns accepted signals, clustering, hit testing and the shared camera. Markers are available before any provider loads. |
| React status synchronization | Headings, pressed mode buttons and health messages derive from the actual renderer in the state machine. Feed messages cannot claim a fallback is active. |

## Rendering architecture

1. **Primary:** MapLibre + the live, key-free OpenFreeMap Liberty style. Provider/OSM/OpenMapTiles attribution remains visible. External requests happen only in Map mode. No bulk download, raster OSM volunteer-server fallback, credential or new service is introduced.
2. **Independent secondary:** MapLibre with the bundled Natural Earth GeoJSON country fill and boundary style. It has no dependency on OpenFreeMap, its tiles, glyphs or sprites. Reference labels use local system fonts in the shared overlay.
3. **Always available geographic surface:** the eagerly bundled Natural Earth atlas rendered in Canvas2D. It is mounted and painted while GL initializes, loads, times out or recovers. The vector surface stays hidden until real geography renders. It needs no WebGL, remote tiles, remote font, API key, runtime geography fetch or map worker.
4. **Geographic globe:** the same 177 countries projected orthographically in Canvas2D with clipped boundaries, collision-suppressed labels and clustered public signals. The globe also works without WebGL.

The offline atlas has continental outlines, country boundaries, reference labels, graticule, pan, cursor-anchored wheel zoom, touch pinch, keyboard pan/zoom/selection, clustered event picking, watch-zone context and selected news uncertainty. A small geographic world overview remains available at high zoom. Local/global and fullscreen controls share the camera. Receipts remain in the original event inspector.

The shared camera avoids renderer resets. MapLibre's default viewport constraints can change zoom/center at world scales; a documented transform constraint preserves the controlled Mercator camera. Its measured projection is compared with the Canvas projection before readiness. Longitude wrapping and a clipped world copy keep dateline transitions aligned. Location, zoom, filters, selected event and watch zone live above renderer instances, so transitions and workspace switches retain them.

The seven lifecycle states are `initializing`, `loading_style`, `loading_geography`, `ready`, `degraded`, `recovering`, and `offline_atlas`. Each vector attempt has one **10-second deadline**, including module loading. Automatic recovery tries OpenFreeMap once, then the independent vector atlas once, then settles on Canvas. Canvas geography and signals remain visible for the entire sequence. There is no recurring retry loop; the manual Retry control begins a new generation. Diagnostic history is bounded to twelve failures. A successful renderer is not demoted when its earlier loading timer expires.

Signals use a screen-space grid rather than thousands of DOM nodes. All accepted visible records up to the existing 5,000-record rendering bound are counted in clusters; no first-900/1,500 truncation. The selected event is separated from its cluster. Private, placeholder, invalid and unsupported unmapped records remain excluded. The full original feed is retained independently of the rendering bound.

## News geography and uncertainty

Ordinary GDELT DOC metadata does not supply incident coordinates. Publisher country, article titles and keyword matches still do not create map locations. Optional configured proxies can supply an explicit source-linked `geography` object on an article:

```json
{
  "kind": "source-published-area",
  "receipt": "https://publisher.org/source-statement",
  "lat": 20,
  "lon": 25,
  "radiusKm": 1200,
  "label": "Published approximate region"
}
```

`receipt` must match the article's safe HTTPS receipt, coordinates must be finite and within geographic bounds, and areas require a positive radius at most 10,000 km. `source-published-point` is also accepted. This is an explicit optional proxy contract, not a claim that the direct DOC API emits this schema. Proxy assertions retain **reported / not independently verified** provenance. Selected areas have a dashed uncertainty outline in both map and globe. Unknown locations remain unmapped. The example coordinates and the browser test news report are test fixtures, not real news claims. The Ascension metadata archive's contract is unchanged.

## Real-world acceptance

Validation uses the production Vite build and GitHub Pages base path in Chromium, including the emitted module worker and actual Canvas/WebGL rendering. Live checks retain TLS validation and CORS. The execution environment requires its existing managed certificate authority and an HTTPS proxy; the live probe routes localhost directly and tunnels external browser HTTPS. No `ignoreHTTPSErrors`, CORS disabling or browser security bypass is used.

| Scenario | Acceptance evidence |
| --- | --- |
| Production failure and stale retry message | [Actual requests and console](evidence/production-retry-before.json), [screenshot](screenshots/production-black-after-retry.png) |
| Live external style / tiles / glyphs / sprites | [Chromium network, GPU and pixel receipt](evidence/candidate-openfreemap.json), [primary screenshot](screenshots/openfreemap-vector.png) |
| Live style succeeds, geographic tile requests blocked | [Actual successful style and blocked tile requests](evidence/candidate-external-tiles-blocked.json), [independent vector screenshot](screenshots/external-tiles-blocked-vector.png) |
| Every external provider blocked | [Independent vector receipt](evidence/candidate-bundled.json), [bundled vector screenshot](screenshots/bundled-vector.png) |
| WebGL disabled and offline after app load | [Actual no-WebGL Canvas screenshot](screenshots/offline-no-webgl.png); browser suite also switches workspaces, resizes, pans, zooms, filters, inspects receipts and uses fullscreen offline |
| CSP worker denial | [Actual security-policy events and console messages](evidence/csp-worker-blocked.json), [Canvas screenshot](screenshots/csp-worker-blocked.png) |
| Malformed JSON / empty style | Browser tests refuse Ready, keep geographic Canvas visible, and recover to independent vector geography |
| Slow style | A stalled style request hits the 10-second deadline; the Canvas geography and markers remain visible and camera survives retry |
| WebGL context lost after Ready | Browser test forces actual GL context loss and verifies automatic recovery with camera and receipt retained |
| Resize / mode / workspace switching | Browser tests verify canvas painting and camera, filter and selection retention |
| More than 2,000 signals | All 2,400 public fixture records accounted for; real geographic polygons, worker decoding, marker pixels and cluster counts verified |
| Geographic globe without WebGL | [Globe screenshot](screenshots/geographic-globe.png), independent Canvas browser test |

Visual acceptance analyzes screenshots of the geographic surface, not surrounding controls. It rejects transparent, black or nearly uniform canvases; bundled rendering must contain substantial land and ocean pixels and visible marker pixels. Unit checks prove that black, transparent and grid-only canvases are rejected. Actual rendered geographic features and subpixel projection alignment are separate gates. The previous empty-background constructor test has been replaced. CI retains screenshot files, security-policy evidence and failure traces as an artifact.

Commands:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run test:browser
npm run test:map:live
npm run test:map:blocked
```

`diagnose:map:production` is a read-only reproduction probe for the pre-fix deployment. It intentionally expects the old failure and is not a CI gate after deployment. Live provider probes are explicit acceptance runs; deterministic CI does not depend on an external provider being up.

Local verification: **144 unit tests and 31 Chromium browser tests**. Strict TypeScript and production build pass. The draft PR records the CI conclusion at its exact published SHA. The map renderer and main bundle remain large (roughly 1.06 MB and 537 KB uncompressed; 289 KB and 186 KB gzip). MapLibre and its 519 KB worker remain lazy; real offline geography is deliberately eager. The browser interaction tests remained responsive with 2,400 signals; no frame-rate benchmark is claimed. Performance on the user's physical GPU and phone remains a follow-up observation, not a claimed test.

## Data and limits

Bundled Natural Earth 1:110m Admin-0 countries: **177 polygons/multipolygons, 222,597 bytes**, source pinned to `ca96624a56bd078437bca8184e78163e5039ad19`. [Machine-readable provenance and SHA-256](../../lib/data/world-atlas.provenance.json). The public-domain data were reduced to names, ISO identifiers, label references and geometry; coordinates were rounded to four decimal places and spherical ring orientation normalized. Tests verify the file hash, country count, polygon geometry, labels and winding. [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/).

These are generalized de facto geographic boundaries for context, not street detail or a legal boundary determination. The atlas guarantees geography when external map providers fail, once the application assets are available. It does not claim that an unvisited web application can be downloaded without a network; a service-worker installation workflow is outside this defect fix. There is no automatic third-party tile caching. News without supplied geography stays in the feed rather than acquiring guessed coordinates.

The bundled D3 geographic library is used under its included permissive license; notices are preserved in [third-party notices](../../public/third-party-geography.txt). No generated or proprietary map imagery is bundled.
