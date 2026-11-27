# Operation Watchtower Ascension — Ascension 01 candidate report

Report date: November 26, 2026, America/Los_Angeles. Candidate package: `2.0.0-alpha.1`. Controlling authority: [the preserved user specification](controlling-spec.md), whose SHA-256 is recorded in [the build receipt](build-receipt.json). Original repository commit: `b44e36ec5a87d585e4b6799f9e81d74afea64136`.

This candidate delivers a working static newsroom: reviewed public feeds → normalized cached metadata → source-attributed news stream → evidence comparison/local research → deterministic briefing and public export. It preserves the existing atlas and research tools. It is the first integrated slice of the requested 2.0 overhaul; the complete mission is not claimed finished.

The draft PR description and final delivery response record the actual published commit SHAs and remote CI run at the final head. No main merge or candidate production deployment is included in this work.

## Original assessment and architecture decision

The original application was useful and functional: React/Vite, a tile-free atlas, lazy MapLibre, orthographic globe, official hazard feeds, sampled/predicted orbital information, 50 research portals, two historical incident cases, a local discovery queue, temporal discovery trails and FieldPack v1. There were no open issues or PRs at intake; all twelve historical PRs were merged. The audit found thirteen branches and four existing workflows. Preserve this foundation rather than replace it with a mandatory backend.

Baseline validation was **59 unit tests and 8 Chromium smoke tests passing**. The successful build still warned that MapLibre's `supported` export did not exist. The old direct GDELT path could manufacture current timestamps and Northern California geography, and source outages created synthetic news/market rows that entered signal counts. Dependency installs had no lockfile. The active Vite application also lacked a passing strict typecheck because its configuration included unused Next scaffolding and missed actual integration types.

The full original findings, branch/workflow evidence and read-only ecosystem audit are in [the repository assessment](../ascension-audit.md). Earlier cache workflow failures were Pages artifact-metadata failures after successful ingestion/build; they were not misclassified as source outages.

| Concern | Before | Candidate |
| --- | --- | --- |
| News retrieval | One direct-browser GDELT path with optional proxy | Six centrally cached adapters; browser reads same-origin JSON; legacy atlas adapter retained and repaired |
| Record contract | Signal-centric metadata, some inferred news geography/time | Versioned public records with separate occurrence/publication/modification/retrieval clocks; unknown values remain unknown |
| Understanding reports | Individual signal receipts and historical cases | Receipt inspector, reversible suggested groups, source-family comparison, all-clock timelines, explicit manual comparison |
| Personal research | Watch zones, discovery review and historical Incident Room | Those capabilities plus local saved workspaces/watches, pinned evidence and clearly labeled notes/hypotheses/counterevidence |
| Storage/export | Local settings and existing FieldPack | Bounded IndexedDB public archive, retention controls, atomic unreviewed imports and privacy-minimal briefing/archive exports |
| Interface | Signal atlas as startup view | Nine-desk responsive newsroom as startup view, with the original workspaces one click away |
| Build/deployment | Vite/Pages with floating build-tool versions | Same base path and static tier, exact dependency versions/lockfile, strict active-app types, browser/a11y/schema checks |

## Implemented capabilities and their status

| Capability | Classification | What is demonstrated / practical limit |
| --- | --- | --- |
| Six-source federation, registry and Source Observatory | Implemented and verified | Real endpoint collection plus deterministic adapter tests; selected institutional/science/policy/hazard coverage |
| RSS/Atom/JSON/GeoJSON normalization, deduplication and four clocks | Implemented and verified | Strict URL/date/privacy contracts; no inferred precise story coordinates or current-time substitutions |
| Timeouts, streamed byte caps, fixed endpoints, concurrency/cooldowns/backoff and failure retention | Implemented and verified | New news collector plus repaired existing discovery/orbit transport; total news failure keeps prior news bytes |
| Global Command and eight additional working desks | Implemented and verified | Search/filter/observation toggle, local saved workspaces, research, briefs and source health; no empty domain placeholders |
| Metadata report grouping | Experimental | Deterministic/reversible behavior is tested; semantic accuracy is uncalibrated. Distinct public-data receipt IDs never auto-merge |
| Receipt inspection, comparison and timeline | Implemented but partially verified | Original metadata and all four clocks are visible; no automatic claim adjudication, framing verdict or calibrated independence score |
| Research Room, annotations and keyword watches | Implemented and verified | Local pins, manual HTTPS nominations, personal notes, hypotheses, disputed/correction-review notes and disconfirming receipts; watches send no notifications |
| Deterministic briefs and public archive portability | Implemented and verified | Actual browser-exported Markdown/JSON, citation validation, printing and privacy boundaries; brief coverage remains limited to available dated metadata |
| Bounded history/offline record recovery | Implemented and verified | At most 2,000 public records, 7/30/90-day retention, safe imports and in-memory fallback; this is not immutable event version history |
| Dark/light, responsive, keyboard and reduced-motion behavior | Implemented and verified | Automated and visual checks at desktop/390-pixel mobile widths; no claim of exhaustive physical-device/assistive-technology validation |
| Existing Lite/Globe/Map, Explore, Incident Room, Discovery and FieldPack | Implemented and verified | Existing regression cases retained; actual MapLibre renderer/zoom works with a controlled style, and disabled-WebGL recovery works |
| Scheduled news-cache workflow | Implemented but partially verified | Main-only six-hour job is implemented; not executed or deployed from this unmerged candidate |
| Watchtower-side ecosystem schemas | Implemented and verified | Four public JSON Schemas plus source manifests; existing FieldPack format preserved and unsafe destinations further constrained |
| Model assistance, translation, permanent event/claim/correction ledger, full global/local coverage and Tier 3 backend | Planned | No mock provider, generated reporting, SQLite service, Docker node or downstream consumer is represented as implemented |
| Merge, new production deployment and first scheduled-release verification | Blocked | Explicit human release authorization is required and has not been supplied |

The [40-entry requirements register](requirements-register.md) maps the complete controlling scope to implementation, evidence and remaining work across all nine phases. “Verified” means exercised engineering behavior, never a claim that a feed verifies world events.

## Source inventory and observed health

One controlled live collection completed at `2026-11-27T00:09:46.540Z` (November 26, approximately 4:10 p.m. Pacific). All six endpoints returned successful, attributable metadata. That dated success is not a continuing availability guarantee.

| Source | Format | Retained records | Evidence/coverage boundary |
| --- | --- | ---: | --- |
| NASA News Releases | RSS | 10 | Institutional releases; publication does not establish occurrence |
| United Nations Geneva | RSS | 10 | Press/meeting coverage, not independent corroboration |
| European Central Bank | RSS | 15 | Issuer communications; attributed press metadata, no financial recommendations |
| arXiv AI Announcements | Atom | 30 | Descriptive preprint metadata; announcement update is not invented paper-publication time |
| Federal Register | JSON | 20 | Informational publication metadata; day-only dates stay day precision |
| USGS M4.5+ Earthquakes | GeoJSON | 30 | Catalog occurrence/update values; distinct event receipts remain separate |
| **Total** | **4 formats** | **115** | **English, selected coverage; not comprehensive global journalism** |

Policies, licenses, attribution, robots/API observations, source limitations and exact endpoints are documented in [the source review](../news-sources.md). No article body, paper abstract/PDF, image, attachment, private profile or tracking data is republished. CISA's tested advisory endpoint returned 403 and is not enabled. The policy-reviewed arXiv implementation uses its documented RSS host rather than the separately evaluated API host.

## Actual validation

The [local validation receipt](evidence/local-validation.json) records commands, exit codes, durations and [full logs](evidence/local-checks/unit.txt). At the completed local run:

| Check | Result |
| --- | --- |
| Clean locked install (`npm ci`) | Passed |
| Strict active-Vite typecheck | Passed; strict mode retained, inactive Next scaffold left intact |
| Unit/source/security/schema/integration tests | **136 passed; 0 failed; 0 skipped** |
| Production Vite build at `/parallax-watchtower/` | Passed |
| Production Chromium browser tests | **23 passed; 0 failed** |
| Dependency advisory audit | **0 reported vulnerabilities** at the recorded run |
| Whitespace/diff validation | Passed |

Browser coverage includes startup/map recovery, real MapLibre initialization/zoom with a controlled style, old research tools, mobile layouts, both themes, source grouping/separation, explicit comparison, annotation attribution, public export privacy, offline record recovery, blocked storage, invalid/malicious inputs, stale health, atomic import rejection, legacy controls under denied storage, and production CSP refusing inline script execution. New schema tests validate real emitted record/snapshot/event/brief objects; malformed/private data fail their contracts.

The original atlas tests were retained. Two now explicitly select **Live signals** after startup because the requested default changed to **News Command**; their atlas assertions remain. No failing test was disabled, deleted or relaxed. Initial accessibility checks found low-contrast navigation/version text, which was corrected. A stronger real-renderer test exposed a lazy CSS positioning bug that blocked map controls; the stylesheet specificity was repaired and the same interaction now passes. The separate reviewer added independent security cases and documented their observations in [the review receipt](independent-review.md).

Remote CI is verified against the final published head and reported in the draft PR's delivery table. Local success alone is not substituted for that check.

## Security findings and resolutions

Removed synthetic outage rows, fabricated news time/geography and invalid market prices/timestamps. Legacy receipts/proxy configuration now require safe public destinations. FieldPack rejects private/IP/credentialed/nonstandard-port receipts without changing its versioned shape. User watch-zone coordinates/radii are validated; denied storage writes remain recoverable.

The new collector rejects DTD/entity expansion, malformed feed roots/namespaces, oversize/deep XML, unexpected response types/redirects, unsafe receipt hosts and invalid/future dates. All source transport has body deadlines, byte caps and abort/cancellation. The existing scheduled collectors now enforce streamed limits before any publication; oversized chunked payload tests preserve their prior files. The optional proxy retains a fixed GDELT host, bounded parameters/body/time, JSON validation and redacted failures.

Untrusted content is rendered as text. Production scripts are same-origin under CSP; objects/frames and inline scripts are blocked. Private notes, saved views, browser location and watches are not added to public exports. Imports are atomically validated, remain unreviewed and cannot reuse an identity to attach existing notes to another receipt. No new model execution, cloud transfer, hidden analytics or private surveillance exists.

Residual limits: `saxes@6.0.0` has archived upstream maintenance and needs ongoing advisory review; the current advisory audit is not a permanent security guarantee. Full article/document attachment parsing is absent. Models and prompt-injection/fidelity evaluation for generated analysis are planned. GitHub Pages controls HTTP headers; Netlify-specific headers do not imply those headers are installed on Pages. Existing legacy browser feeds are bounded but remain a separate polling path when their workspace is open.

## Performance and browser observations

[Recorded browser measurements](evidence/browser-measurements.json) identify the exact runtime, viewport, timing and network conditions. The actual checked-in source cache was used with all external browser requests blocked. Thirty stream rows render initially; further rows are requested explicitly. Desktop and mobile have no horizontal overflow; the capture has no uncaught page errors or external requests. Desktop dark/light Axe WCAG A/AA checks report zero violations, alongside the automated mobile checks. These are local engineering observations, not worldwide speed or exhaustive accessibility claims.

[The Node benchmark](evidence/intelligence-benchmark.json) measured the actual 115-record cache: grouping **34.24 ms**, a 30-item valid-citation brief **9.06 ms**. A separately labeled 600-record synthetic input measured **128.42 ms** grouping and **14.37 ms** briefing. Synthetic benchmark/test input is never shipped as public news. The optional MapLibre chunk remains approximately **1.07 MB raw / 292 KB gzip**, lazy-loaded; that build warning is retained, not hidden.

Screenshots: [desktop](screenshots/newsroom-desktop.png), [light](screenshots/newsroom-light.png), [mobile](screenshots/newsroom-mobile.png). Reproduce them with `npm run build` then `node scripts/captureNewsroom.mjs`. Actual browser-exported briefing artifacts: [JSON](evidence/actual-brief.json) and [Markdown](evidence/actual-brief.md).

## Files, delivery, deployment and rollback

The [file register](file-register.json) inventories changed modules and content hashes. Main implementation areas are `lib/news*.mjs`, source/transport validation, `scripts/refreshNews.mjs`, `components/NewsCommandCenter.tsx`, `components/newsroom.css`, versioned public data/schemas, legacy adapter/atlas repairs, strict Vite types, locked workflows and expanded tests. Supporting audit, controlling-spec, requirements, roadmap, operational instructions, screenshots and logs are included for review. No unrelated repository was modified.

The existing production site was independently opened in the cloud browser: header/Lite Atlas and the Globe→Lite interaction worked. Its old GDELT fallback behavior was visible. [That baseline receipt](evidence/production-baseline.json) is evidence about existing main, not deployment of this candidate. A local browser network failure was recovered using the separate browser; it was not called a site outage.

The new source job is only operational after authorized merge to main. After release authorization, verify CI, first news-cache execution, Pages deployment, live JSON/health and the actual public UI separately. The original base path, cache schedules and Pages concurrency are preserved. See [operations and rollback](operations.md) for exact commands. Rollback is reverting the feature commits/new cache job and redeploying the previous build; no destructive database migration or cross-app synchronization was introduced.

## Next highest-value work

1. Admit a small policy-reviewed set of independent world/local and multilingual reporting sources with real endpoint receipts and honest coverage/origin metadata.
2. Add a durable event/claim/correction ledger with reviewed merge/split history, stable identities, source revisions and disconfirming evidence.
3. Add optional local Ollama assistance only with evidence-referenced output, explicit consent and measurable fidelity/uncertainty/prompt-injection evaluations.

The [roadmap](roadmap.md) preserves the remaining requirements. Operational release is human-owned; a successful draft candidate does not declare the unfinished phases complete.
