# Watchtower Ascension roadmap

This roadmap sequences the remaining work in
[Operation Watchtower Ascension](controlling-spec.md). The integrated candidate
is the first working newsroom slice, not the completed 2.0 mission. The
[requirements register](requirements-register.md) records current behavior and
limits using stable requirement IDs.

## Current candidate boundary

The candidate keeps the React/Vite GitHub Pages application and its existing
atlas, globe, recovery paths, Explore catalog, historical Incident Room,
Discovery Inbox/Trails and FieldPack producer. Its default newsroom adds nine
functional desks, source receipts, reviewable metadata grouping, local research
and watch searches, a bounded local archive, and deterministic briefings.

Six configured RSS/Atom/JSON/GeoJSON adapters produced a recorded real collection
of 115 metadata records. Titles, links and permitted source metadata are
retained; this is selected institutional, science, policy and hazard coverage,
not comprehensive world/local journalism. The configured six-hour GitHub cache
workflow has not executed for this unmerged candidate. No model integration,
mandatory backend or downstream repository consumer is implemented.

Before operational release, record the exact candidate commit, run all required
checks, inspect remote CI for that head and obtain the explicit human
authorization required to merge/deploy. After an authorized merge, inspect the
first actual news-cache and Pages runs, then verify the public site. This is a
release gate, not evidence that the unfinished product phases are complete.

## Next three implementation priorities

| Priority | Deliverable | Why it comes next | Reviewable acceptance boundary |
| --- | --- | --- | --- |
| 1 | Independently licensed world/local journalism and multilingual source metadata | Six useful institutional/research/hazard sources cannot represent the breadth of international, regional and local reporting requested by the mission. | Add a small, policy-reviewed source set with real endpoint receipts, geographic/language coverage, attribution and reuse limits, explicit origin relationships, deterministic adapter tests and visible coverage gaps. Retain original-language text; do not imply translation or independent confirmation before it exists. |
| 2 | Persistent event and claim/correction ledger | Heuristic groups and local correction notes cannot provide durable event identities, cross-session version history or claim-level supporting/counterevidence relationships. | Version an explicit event/claim schema, preserve source snapshots and revisions, keep immutable evidence references, support merge/split review with history, record corrections/retractions without erasing earlier claims, and test identity stability plus export privacy. No automatic verification label from report counts. |
| 3 | Optional Ollama assistance with security and fidelity evaluation | Model assistance can be useful once reporting breadth and a durable evidence ledger exist, but source-linked generation needs measurable accuracy and prompt-injection resistance. | Opt-in configurable local inference, source-referenced output schemas, no instructions executed from retrieved content, clear generated-content labels, unsupported-citation rejection, explicit insufficient-evidence behavior and an evaluation dataset covering fidelity, uncertainty, multilingual handling and adversarial content. Core newsroom continues to work with inference disabled. |

## Phase I — Foundation

**Current state:** implemented but partially verified across the complete phase
(WTA-001–004). Baseline/review receipts, repair coverage, locked dependencies,
strict typechecking of the active Vite app and normalized public contracts exist.

Carry the controlling specification, requirement IDs and preserved failures
forward in every candidate. Add migrations only when a real contract change
requires them. Expand source/schema fixtures as new adapters and ledger versions
arrive. Retain the current startup and WebGL recovery behavior as regression
gates.

## Phase II — Federation

**Current state:** a working six-source collection and observatory are verified;
the scheduled candidate workflow and broader source coverage remain partially
verified/planned (WTA-005–010).

Implement priority 1 as a small vertical slice, starting with sources whose
metadata redistribution terms permit the actual intended use. Verify provider
availability and usage policy at admission time; an RSS URL or accessible page
alone is not a reuse license. Keep source category, geographic coverage and
language separate from the location/language of an individual story. Preserve
provider-origin relationships so syndication and shared ownership do not inflate
corroboration counts.

After authorized release, observe real six-hour collection behavior under
partial and total failure before increasing volume or cadence. Add historical
source availability receipts when the archive is able to retain them honestly.
Do not increase source frequency merely to make the interface appear live.

## Phase III — Command Center

**Current state:** the default newsroom, nine desks, saved views and retained
atlas work; the complete requested workspace/layer catalog is partial
(WTA-011–015).

Build dedicated regional/local, infrastructure, cybersecurity, weather/climate
and space workspaces only when their source coverage supports useful behavior.
Avoid adding empty panels for domain names. Introduce panel collapse/resize and
layout persistence with keyboard and screen-reader equivalents; validate tablet
and physical multi-monitor usage before claiming those arrangements proven.

Geographic filters should use documented place identities and precision. Add
country/region boundaries or uncertainty areas rather than placing a point at a
country centroid. New hazard/transport layers need separate provider and
timestamp semantics. Historical map playback waits for genuine retained event
versions; the existing orbital model must continue to be labeled a prediction.

## Phase IV — Intelligence

**Current state:** duplicate handling is verified; suggested event groups remain
experimental; source receipts and manual comparison support human review
(WTA-016–021).

Implement priority 2 before treating event IDs as permanent. Keep automated
grouping reversible, preserve supporting and disconfirming material, and record
why a user merged or separated records. Different public-data receipt IDs remain
separate unless an explicit, evidence-backed provider event-identity contract
supports a relationship.

Add claim-level evidence relationships, correction/retraction history and
review states before attempted automated contradiction detection. Calibrate any
multilingual semantic grouping on labeled examples, publish failure cases and
keep publisher origin counts distinct from independent corroboration. Report
framing differences through attributable text rather than undocumented political
labels. Historical context and developing-story detection need retained,
source-linked versions rather than generated backstory.

## Phase V — Research

**Current state:** local pins, annotations, watch searches, metadata archive and
source-backed briefings work; full room graphs, notifications and historical
comparison remain partial/planned (WTA-022–028).

Extend the Research Room with named rooms, explicit questions, claim/evidence
cards and sourced or clearly hypothetical relationships. Keep personal
annotations local and excluded from public exports by default. Public-document
imports should begin with bounded metadata; any future attachment parser needs
its own format/size/error boundary.

Add comparison of saved briefings and changes-since-last-visit only when prior
versions are retained. Continue distinguishing occurrence, publication,
modification and retrieval time. Add topic activity trends with coverage and
missing-data notes so a feed outage is not presented as a change in world events.

Notification work is optional and later: obtain explicit browser consent, keep
deduplication/cooldowns/quiet hours local, retain a bounded notice history and
distinguish informational notices from official emergency warnings. Saved watch
searches currently produce no notifications.

## Phase VI — Computational Collaboration

**Current state:** planned (WTA-029–030); deterministic features require no model.

Implement priority 3 with optional local inference first. Treat provider feeds,
articles and documents as untrusted data. Generated summaries, translations and
analysis must reference the evidence actually supplied, retain original source
links and admit insufficient support. No default cloud transfer of private
notes, watchlists, browser location or archive history is authorized by adding a
provider setting.

Optional cloud providers and a PhiBuddy-specific handoff follow the same consent,
schema and evaluation requirements. A functioning inference request is not
evidence of summarization fidelity or resistance to source prompt injection.

## Phase VII — Ecosystem Federation

**Current state:** Watchtower-side producers/interfaces are implemented; native
downstream integration remains partial/planned (WTA-031–034).

Use the versioned public news/event/briefing/source contracts and retain existing
FieldPack v1 compatibility. A downstream consumer must validate structure,
receipt safety, time meanings and public-only scope, then request user consent
before persisting an import. The next candidate should provide consumer fixtures
and a compatibility matrix; implementing consumers in PhiOS, PhiBuddy,
Agentora, PhiMemory9, Peekaboo or EIRM is separate repository work requiring
explicit authorization.

Introduce a self-hosted SQLite/container tier only when a demonstrated archive
or search workload justifies it. Keep the static account-free tier functional,
and never embed API keys in frontend bundles. An optional backend must document
resource requirements, retention, migrations, allowlists and rollback behavior.

## Phase VIII — Hardening

**Current state:** exercised local protection and failure-recovery checks exist;
the mission's broader environment/acceptance matrix remains partial
(WTA-035–038).

Keep unit, schema, source-contract, security and production-browser tests separate
from controlled live-source checks. Preserve the actual failure before repairing
a regression. Extend accessibility coverage to new workspaces and verify real
assistive technology, device constraints, interrupted network requests and
storage upgrades as the archive evolves.

Measure with a named dataset and runtime before introducing full virtualization,
workers or a search index. The current bounded/paginated stream and source caps
are intentional safeguards. Re-run dependency review after changes and inspect
remote CI at the actual candidate head. A green build cannot substitute for
browser startup, real SDK initialization, source freshness or deployment checks.

## Phase IX — Operational Release

**Current state:** blocked on explicit human merge/deployment authorization and
the resulting operational checks (WTA-039–040).

The release candidate should include a concise problem/behavior description,
architectural rationale, changed files, security/privacy limits, exact local and
remote check results, screenshots, source receipts, known limitations and a
rollback path. Confirm the repository base path and static-host behavior before
requesting the final release decision.

After authorization, verify the merge commit, Pages deployment, first cache job,
actual public UI, stale-source behavior and fallback atlas. Preserve a rollback
to the reviewed prior build and its static datasets. Successful release of the
first slice does not complete the remaining phases or authorize unrelated
repository changes.
