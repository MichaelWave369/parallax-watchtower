# Ascension 01: separate reviewer browser receipt

Date: November 26, 2026 (America/Los_Angeles). Scope: the built production Vite candidate under the existing `/parallax-watchtower/` base path. The newsroom and source ingestion were implemented by other team members; this reviewer previously implemented the legacy adapters, transport cleanup and baseline type fixes. This is a separate engineering review, not a third-party security certification or production release authorization.

## Security and failure-recovery probes

Command:

```sh
npx playwright test e2e/newsroom-security.spec.mjs --reporter=line
```

Result: **5 passed, 0 failed, 0 skipped in 3.6 seconds**, Chromium, using Playwright's own production preview server. No source rebuild was performed during the run. Tests use clearly labelled synthetic fixtures intercepted only in the test browser; these fixtures are not written to the public news cache.

| Probe | Observed result |
|---|---|
| One unsafe record in an otherwise valid shared cache | Entire snapshot rejected; neither the malicious article nor a safe-looking partial subset is displayed. Readable validation failure and empty-state UI remain available. No script execution or browser exception. |
| Manual nominations using an executable scheme, embedded credentials, loopback IP or localhost | Each nomination rejected before persistence or network retrieval. No invented record and no external request. |
| Archive containing one valid record and one malicious receipt | Import rejected atomically; pre-existing records unchanged and the valid prefix is not partially admitted. |
| Valid public archive with an official-looking publisher/evidence label and arbitrary private fields | Imported as `manual`, `Imported · NASA`, `USER SUBMISSION`, `uncorroborated claim`. Private note fields do not enter local research notes or rendered content. Underlying source links remain inspectable. |
| Both localStorage and IndexedDB denied by browser policy | Newsroom remains usable in memory, reads the shared cache, explains unavailable persistence, and supports a local watch search without a startup error. |
| A historically successful retrieval older than 36 hours | Main status reports stale/no current snapshot; all six source cards say `stale snapshot`, preserving retrieval success timestamps and exact documentation/policy links. |

Each test also asserted zero attempted external requests and zero uncaught browser errors. These tests exercise safe rendering, source/URL admission, import provenance and browser failure handling; they do not establish publisher truth or completeness of real-world event coverage.

### Preserved environment failure

The first invocation tried to reuse another command session's preview on port 4181 and all five navigations failed with `ERR_CONNECTION_REFUSED` before reaching the application. Command sessions have isolated network/process namespaces in this workspace. The reviewer reran the same tests with their own Playwright-managed web server; all five then passed. No test was weakened, no product assertion was bypassed, and the connection failures were not classified as source-feed failures.

## Actual shipped-cache UX inspection

A separate self-contained Node process launched its own Vite production preview on port 4183 and inspected the real generated static news files in headless Chromium. It did not intercept or replace the news snapshot. External requests were blocked and recorded. Observed: **0 attempted external requests, 0 uncaught browser errors**, 30 initially rendered report rows with bounded pagination, and six inspectable source cards.

Shared metadata snapshot: `2026-11-27T00:09:46.540Z` (November 26, 4:09 PM Pacific), **115 real source metadata records**.

| Source | Retained metadata records | Source card state |
|---|---:|---|
| NASA News Releases | 10 | ok |
| UN Geneva Press Items | 10 | ok |
| ECB Press | 15 | ok |
| arXiv AI Announcements | 30 | ok |
| Federal Register Documents | 20 | ok |
| USGS M4.5+ Earthquakes | 30 | ok |

The cards displayed source attribution, success/failure receipts, license limits and provider-specific policy links. The product explicitly states that adapter availability is retrieval status rather than a publisher credibility rating. Its coverage note accurately describes selected institutions, science, policy and hazards, and states that coverage is incomplete and is not an official emergency warning service. This browser run verifies the rendering of an existing collection receipt; it does not independently re-fetch the providers or verify underlying reported claims.

## Earlier review findings and disposition

- Malformed calendar dates, false report/occurrence timestamp equivalence, stale source labels, policy URL mapping, cross-report annotation drafts and public archive size roundtrip were reported to the owning engineers and repaired before this browser run.
- Unread HTTP/oversize responses now abort/cancel transport; a blocked IndexedDB request closes a database handle that succeeds after the caller has already received a failure. Dedicated regression tests cover both.
- The active Vite TypeScript application passes strict typechecking; inactive Next scaffolding remains unchanged and explicitly outside that build's scope.
- No unresolved critical browser correctness or security defect was identified in the exercised newsroom paths. Broader provider coverage, local-model assistance, long-term versioned archives, operating-system integration and production deployment remain separate milestones; this review makes no completion claim for them.
