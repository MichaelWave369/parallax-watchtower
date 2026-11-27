# Ascension 01 requirements register

Controlling authority: [Operation Watchtower Ascension](controlling-spec.md),
the user-provided specification preserved in this directory. This register maps
that specification to the integrated candidate. It does not replace, narrow or
mark the entire specification complete.

“Implemented and verified” below means the stated bounded behavior has local
execution evidence and a reproducible verification hook. It does not mean
independently verified reporting, comprehensive security certification, a
successful future schedule, green remote CI at an unspecified commit or a
production deployment. Final run counts, exact commit SHAs and remote CI outcomes
must come from the final mission receipt, not assumptions in this table.

Status vocabulary:

- **Implemented and verified:** the bounded behavior was exercised locally.
- **Implemented but partially verified:** working candidate code exists; the
  broader requirement or its operational validation remains incomplete.
- **Experimental:** behavior is exercised, but its accuracy or suitability for
  unattended interpretation has not been calibrated.
- **Planned:** absent from the implementation; retained in the controlling scope.
- **Blocked:** the next operational action requires explicit human authorization
  or an unavailable prerequisite.

## Phase coverage

| Phase | Controlling sections | Candidate state | Boundary |
| --- | --- | --- | --- |
| I — Foundation | 2, 5, 15, 19 | Implemented but partially verified | Repository/deployment baseline, verified defect repairs, schemas and adapter contracts exist; full-product acceptance remains open. |
| II — Federation | 4, 5, 16 | Implemented but partially verified | Six real metadata adapters and bounded collection are exercised; the six-hour GitHub schedule has not run for this unmerged candidate. Editorial/local/multilingual breadth remains incomplete. |
| III — Command Center | 3, 9, 10 | Implemented but partially verified | Nine functional desks and retained atlas modes work locally; the full requested workspace/layer catalog and movable/resizable panel system are not implemented. |
| IV — Intelligence | 6, 7, 8 | Experimental | Conservative grouping and source comparison support review; automated verification, calibrated independence and permanent event identity are absent. |
| V — Research | 10, 12, 13, 14 | Implemented but partially verified | Local research, watch searches, bounded archive and deterministic briefings work; named room graphs, longitudinal event/correction history and notifications remain planned. |
| VI — Computational Collaboration | 11 | Planned | No model provider, translation, generated analysis or model evaluation dataset is implemented. Core functionality has no model dependency. |
| VII — Ecosystem Federation | 15 | Implemented but partially verified | Watchtower-side versioned metadata/event/brief contracts and the existing FieldPack producer remain available; no downstream consumer or silent synchronization is implemented. |
| VIII — Hardening | 17, 18, 19 | Implemented but partially verified | Security/failure probes, strict active-app typechecking, production browser checks, schemas and benchmarks exist; exercised cases do not establish every environment or all mission acceptance criteria. |
| IX — Operational Release | 16, 21, 22 | Blocked | Candidate review and documentation precede explicit authorization to merge and deploy. The current public deployment is not this candidate. |

## I. Foundation

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-001 | 2, 19 | Audit the existing repository, branches, workflows, open work and live deployment before changing architecture. Baseline and separate review receipts are retained; later commits require fresh final checks. | Implemented and verified | [Production baseline](evidence/production-baseline.json), [separate review](independent-review.md); repository history and workflow inspection. |
| WTA-002 | 2, 5, 17, 19 | Repair verified legacy defects: fabricated news/market fallbacks removed, invalid or missing news times stay unknown, generic hazard keywords do not imply Northern California, market timestamps and values are validated, and the real MapLibre SDK export is used. | Implemented and verified | `lib/legacyNews.mjs`, `lib/legacyMarket.mjs`, `components/SignalVectorMap.tsx`; `tests/legacyNews.test.mjs`, `tests/legacyMarket.test.mjs`, `e2e/vectorMap-runtime.spec.mjs`. |
| WTA-003 | 5, 7, 15 | Publish bounded public news, snapshot, event-suggestion and briefing contracts. Separate source identity, evidence type and occurrence/publication/modification/retrieval times. The schemas are producer contracts rather than truth assertions. | Implemented and verified | `lib/newsContract.mjs`, `public/schemas/news-*.schema.json`; `tests/newsSchemas.test.mjs`, `tests/newsAdapters.test.mjs`. |
| WTA-004 | 2, 16, 19 | Make dependency resolution reproducible and add strict typechecking for the active Vite application. Inactive Next scaffolding remains outside that build scope. | Implemented and verified | `package.json`, `package-lock.json`, `tsconfig.json`, `.github/workflows/ci.yml`; `npm ci`, `npm run typecheck`, `npm run build`. |

## II. Federation

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-005 | 4, 5 | Six metadata adapters: NASA, UN Geneva, ECB, arXiv AI, Federal Register and USGS. RSS, Atom, JSON and GeoJSON are supported. Each source has attribution, licensing limits, coverage, language, supported fields and policy links. This is selected institutional/research/hazard coverage, not comprehensive world or local journalism. | Implemented and verified | `lib/newsSources.mjs`, `lib/newsAdapters.mjs`, `public/data/news-sources.v1.json`, `docs/news-sources.md`; `tests/newsAdapters.test.mjs` and the recorded real collection. |
| WTA-006 | 4, 5 | A real collection retained 115 metadata records across all six adapters at `2026-11-27T00:09:46.540Z`. Source health and historical success/failure times are visible. This is a dated retrieval receipt, not a promise of continued availability or independent event verification. | Implemented and verified | `public/data/news.v1.json`, `public/data/news-health.v1.json`, [actual-cache browser review](independent-review.md). |
| WTA-007 | 5, 16, 17, 18 | Fixed provider URLs, refused redirects, response/body deadlines and size caps, bounded concurrency, per-source cooldowns, persisted backoff and partial-failure handling. Retained records keep their original retrieval times. Collection keeps at most 30 records per source; the schema ceiling is 600. | Implemented and verified | `lib/newsAdapters.mjs`, `scripts/refreshNews.mjs`; `tests/newsAdapters.test.mjs`, `tests/browserRequests.test.mjs`. |
| WTA-008 | 5, 16 | A six-hour GitHub cache job and static deployment path are implemented. Main-only writes and shared Pages concurrency are configured. The job has not executed for this unmerged candidate; operational schedule and deployment validation remain outstanding. | Implemented but partially verified | `.github/workflows/news-cache.yml`, `scripts/refreshNews.mjs`; first authorized post-merge collection/deployment receipt is required. |
| WTA-009 | 5 | Canonical URLs, deterministic headline fingerprints, source attribution and date normalization are implemented. Source-declared language/topics and published place metadata are preserved. Automatic language detection, entity extraction and semantic/geographic classification are not implemented. | Implemented but partially verified | `lib/newsContract.mjs`, `lib/newsIntelligence.mjs`; `tests/newsAdapters.test.mjs`, `tests/newsIntelligence.test.mjs`. |
| WTA-010 | 4, 5, 11 | Broaden independently licensed world/local journalism, non-English coverage and document metadata. No arbitrary page scraping, full-article copying, document attachment parser or multilingual translation is implemented. | Planned | Source admission and implementation sequence: [roadmap](roadmap.md). |

## III. Command Center

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-011 | 3 | Default newsroom with Global Command, World Affairs, Science & Technology, Natural Hazards, Policy & Economics, My Watchlist, Intelligence Brief, Research Room and Source Observatory. Desks have working filters/actions rather than placeholder screens. Separate dedicated desks for every requested domain remain planned. | Implemented and verified | `components/NewsCommandCenter.tsx`, `components/newsroom.css`; `e2e/newsroom.spec.mjs`, [desktop screenshot](screenshots/newsroom-desktop.png). |
| WTA-012 | 3, 10 | Chronological bounded streams, keyword/topic/coverage filtering, saved views, density control, local watch searches, keyboard search and fullscreen mode. Watch rules do not generate notifications or emergency alerts. Dragging/resizing panels is not implemented. | Implemented but partially verified | `lib/newsWorkspace.mjs`, `components/NewsCommandCenter.tsx`; `tests/newsWorkspace.test.mjs`, `e2e/newsroom.spec.mjs`. |
| WTA-013 | 3, 9 | Existing Lite Atlas, globe, lazy MapLibre mode and recovery boundaries remain usable. Existing Explore, historical Incident Room, Discovery Inbox/Trails and FieldPack producer are retained. News metadata with unknown/region-level location is not given invented point coordinates. | Implemented and verified | `components/WatchtowerDashboard.tsx`, `components/GlobeCanvas.tsx`, `components/MapRenderBoundary.tsx`; `e2e/startup.smoke.spec.mjs`, `e2e/vectorMap-runtime.spec.mjs`, existing atlas/discovery/FieldPack unit tests. |
| WTA-014 | 3, 9 | Historical map playback, flood/volcano/infrastructure/transport layers, regional summaries, uncertainty polygons and a broader atlas/news correlation workflow remain absent. Existing orbital samples/predictions and wildfire points retain their published caveats. | Planned | `docs/federated-orbit-contract.md`, `docs/map-403-repair.md`; [roadmap](roadmap.md). |
| WTA-015 | 3, 18, 19 | Responsive desktop/mobile layouts, dark/light themes, visible focus, reduced-motion styles and exercised accessibility checks. Fullscreen and layout controls exist; exhaustive tablet, assistive-technology and physical multi-monitor validation has not occurred. | Implemented but partially verified | `components/newsroom.css`, `e2e/newsroom.spec.mjs`; [mobile](screenshots/newsroom-mobile.png), [light theme](screenshots/newsroom-light.png), [browser measurements](evidence/browser-measurements.json). |

## IV. Intelligence and evidence

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-016 | 5, 6 | Duplicate receipts collapse; same-origin headline copies need matching times and compatible metadata. Multiple origins are never labeled independent confirmations. Distinct public-data event receipts stay separate, including nearly simultaneous aftershocks. | Implemented and verified | `lib/newsIntelligence.mjs`; `tests/newsIntelligence.test.mjs`. |
| WTA-017 | 6 | Reversible heuristic suggestions require strong title similarity, compatible times/topics/places and user-overridable separation. IDs are stable for reordering and later appended reports, but can change when an older anchor is discovered. Grouping accuracy is not calibrated; these are not permanent authoritative event records. | Experimental | `clusterEvents` in `lib/newsIntelligence.mjs`, `tests/newsIntelligence.test.mjs`, `e2e/newsroom.spec.mjs`, `docs/news-intelligence.md`. |
| WTA-018 | 6, 7 | Receipt inspector retains all four clocks, source evidence type, origin family, geographic precision, original links and explicit uncertainty. UI timelines distinguish event/publication/modification/retrieval entries. It does not extract and adjudicate every article claim. | Implemented but partially verified | `components/NewsCommandCenter.tsx`, `lib/newsIntelligence.mjs`; `tests/newsIntelligence.test.mjs`, `e2e/newsroom.spec.mjs`. |
| WTA-019 | 7, 8, 12 | Local note/hypothesis/counterevidence/disputed/correction annotations are visibly user-authored. They do not silently change provider verification or enter public exports. This is a review aid, not a versioned shared correction ledger. | Implemented and verified | `lib/newsWorkspace.mjs`, `components/NewsCommandCenter.tsx`; `tests/newsWorkspace.test.mjs`, `e2e/newsroom.spec.mjs`. |
| WTA-020 | 8 | Compare original headlines, source metadata and publication times within suggested groups or by explicitly selecting another saved report. Manual selection does not assert a relationship. Automated terminology, quote, omission, political-allegiance and factual-disagreement judgments are absent. | Implemented but partially verified | `components/NewsCommandCenter.tsx`, `compareEventReports` in `lib/newsIntelligence.mjs`; `e2e/newsroom.spec.mjs`. |
| WTA-021 | 6, 7, 8, 14 | Persistent event identity/versioning, claim-level evidence/counterevidence relationships, correction/retraction propagation, lifecycle/developing-story detection, emerging-topic detection and source-independence assessment remain unimplemented. | Planned | [Roadmap priority 2](roadmap.md); existing heuristics explicitly leave independence unassessed. |

## V. Research, watchlists, briefings and history

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-022 | 5, 12 | Manual public HTTPS nominations, saved source records, local annotations and manual report comparison form a functioning Research Room. A nomination fetches no remote page and remains an uncorroborated user submission. | Implemented and verified | `components/NewsCommandCenter.tsx`, `lib/newsWorkspace.mjs`; `e2e/newsroom.spec.mjs`, `e2e/newsroom-security.spec.mjs`. |
| WTA-023 | 10, 12 | Local watch searches and existing local watch zones are retained without silent cross-app sharing. Named room hierarchies, evidence relationship graphs, collaborative research and private-person profiling are not implemented. | Implemented but partially verified | `lib/newsWorkspace.mjs`, `components/WatchtowerDashboard.tsx`; `tests/newsWorkspace.test.mjs`, `e2e/newsroom.spec.mjs`. |
| WTA-024 | 13 | Deterministic 24-hour/seven-day source-backed briefs, source references, explicit coverage/freshness limits, Markdown/JSON export and printable view. Filtering and recency ordering are transparent; inferred public-impact rankings and comprehensive world coverage are not claimed. Unknown source times are not replaced with retrieval time. | Implemented and verified | `lib/newsIntelligence.mjs`, `components/NewsCommandCenter.tsx`; `tests/newsIntelligence.test.mjs`, `tests/newsSchemas.test.mjs`, `e2e/newsroom.spec.mjs`; [actual brief JSON](evidence/actual-brief.json), [Markdown](evidence/actual-brief.md). |
| WTA-025 | 10, 13 | Quiet hours, cooldown/dedup notification rules, priority notification history, browser notifications, morning/evening delivery and automatic changes-since-last-visit briefs are not implemented. Existing signal alert previews are not a new notification service. | Planned | [Roadmap](roadmap.md). |
| WTA-026 | 14, 18 | IndexedDB stores public metadata and last good snapshot locally; preferences/annotations remain local. Archive bounds are 2,000 records, with user-selected 7/30/90-day retention and graceful in-memory operation when storage fails. Retention currently follows retrieval age, not an immutable historical-event timeline. | Implemented and verified | `lib/newsWorkspace.mjs`; `tests/newsWorkspace.test.mjs`, `tests/newsStorageRecovery.test.mjs`, `e2e/newsroom.spec.mjs`, `e2e/newsroom-security.spec.mjs`. |
| WTA-027 | 14, 17 | User-triggered metadata archive import/export uses bounded UTF-8 JSON, explicit public-only fields and atomic import validation. Imports are downgraded to unreviewed user submissions. Personal notes, watchlists, saved views and browser location are excluded. | Implemented and verified | `makeNewsArchive` / `readNewsArchiveImport` in `lib/newsWorkspace.mjs`; `tests/newsWorkspace.test.mjs`, `e2e/newsroom-security.spec.mjs`. |
| WTA-028 | 12, 13, 14 | Event/briefing version comparison, retained correction history, source availability history, topic trends and graph exploration remain planned. A current snapshot plus bounded metadata archive is not a complete historical intelligence database. | Planned | [Roadmap priority 2](roadmap.md). |

## VI. Computational collaboration

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-029 | 11 | Core deterministic ingestion, review and briefing work without any model, paid API or account. No automatic model call is made from retrieved content. | Implemented and verified | `lib/newsIntelligence.mjs`, `components/NewsCommandCenter.tsx`; newsroom browser tests assert no external calls on default newsroom paths. |
| WTA-030 | 11 | Ollama/compatible local inference, PhiBuddy handoff, optional cloud providers, generated summaries/translations, claim extraction and historical contextualization are absent. Citation-fidelity, unsupported-claim and prompt-injection evaluation datasets for model assistance are not implemented. | Planned | [Roadmap priority 3](roadmap.md). |

## VII. Ecosystem federation and infrastructure

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-031 | 15 | Preserve the existing `phi.fieldpack.v1` producer and public privacy boundaries; publish versioned news/snapshot/event/briefing/source contracts and consumer guidance on the Watchtower side. Do not silently sync private research or change unrelated repositories. | Implemented and verified | `lib/fieldPack.mjs`, `public/data/field-sources.v1.json`, `public/schemas/news-*.schema.json`, `docs/fieldpack-v1.md`, `docs/news-intelligence.md`; existing FieldPack and new schema tests. |
| WTA-032 | 15 | Native PhiOS/PhiBuddy/Agentora/PhiMemory9/Peekaboo/EIRM news consumers, shared event identity and bidirectional evidence interchange are not implemented. Existing companion links do not establish native federation. | Planned | Versioned producer interfaces exist; downstream implementation is separate, explicitly authorized repository work. |
| WTA-033 | 16 | Preserve the `/parallax-watchtower/` GitHub Pages base path, account-free static operation, same-origin cached news and local persistence. Existing optional legacy proxy remains separate; no mandatory backend, SQLite service or Docker deployment is introduced. | Implemented and verified | `vite.config.ts`, `package.json`, existing Pages workflow, production-path browser tests. |
| WTA-034 | 16 | A Tier 3 self-hosted SQLite/container node, server-side search and local model scheduling are not implemented. No new mandatory infrastructure is required for the candidate. | Planned | [Roadmap](roadmap.md). |

## VIII. Hardening and acceptance

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-035 | 17, 19 | Render untrusted text safely, constrain collection URLs/redirects/payloads, reject executable/private receipt destinations, validate snapshots/imports atomically and enforce a production self-script CSP. Tests cover hostile cache/import data, private metadata exclusion and denied storage. This is an exercised protection set, not a blanket security certification. | Implemented and verified | `index.html`, `lib/browserRequests.mjs`, `lib/newsContract.mjs`, `lib/newsAdapters.mjs`; `tests/browserRequests.test.mjs`, `tests/newsAdapters.test.mjs`, `e2e/newsroom-security.spec.mjs`, `e2e/newsroom.spec.mjs`. |
| WTA-036 | 18, 19 | Initial stream rendering is paginated, storage and payloads are bounded, default newsroom reads no upstream providers, stale data is labeled, last good local data survives source outages and Lite Atlas remains usable without WebGL. Tested failures do not establish all bandwidth/device conditions. | Implemented and verified | `lib/newsWorkspace.mjs`, `components/NewsCommandCenter.tsx`; `e2e/newsroom.spec.mjs`, `e2e/startup.smoke.spec.mjs`, [browser measurements](evidence/browser-measurements.json). |
| WTA-037 | 18 | Controlled Node fixture benchmarks and actual-browser measurements exist. Full virtualization, a search index, background processing workers and large persistent historical search remain planned; synthetic measurements are not provider throughput claims. | Implemented but partially verified | [Browser measurements](evidence/browser-measurements.json), `docs/news-intelligence.md`; final mission receipt must identify environment, dataset and timing for reported benchmarks. |
| WTA-038 | 19, 21 | Unit, source/security/schema and production-browser checks are configured without weakening existing tests. Remote CI must be inspected at the exact published head; a prior run or local success is not sufficient. Full post-deployment acceptance remains outstanding. | Implemented but partially verified | `.github/workflows/ci.yml`, `tests/`, `e2e/`; `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`. |

## IX. Operational release

| Requirement ID | Spec sections | Bounded implementation and current limitation | Status | Evidence / verification hook |
| --- | --- | --- | --- | --- |
| WTA-039 | 20, 21, 22 | Preserve the controlling scope, publish this requirements register and roadmap, prepare one coherent reviewable candidate with actual test evidence and an honest deferred-work list. Draft PR publication is authorized; merge is not. | Implemented but partially verified | This register, [roadmap](roadmap.md), source/intelligence docs, screenshots and final draft-PR receipt when published. |
| WTA-040 | 16, 19, 21 | Merge candidate to main, run the first scheduled/news workflow against main, deploy Pages and verify the candidate at the public URL. These are operational release actions and have not been performed. | Blocked | Explicit human merge/deployment authorization, successful exact-head CI, then actual workflow and public production smoke receipts are required. |

The next implementation work is prioritized in [roadmap.md](roadmap.md). A
feature being planned or experimental here does not remove it from the
controlling specification.
