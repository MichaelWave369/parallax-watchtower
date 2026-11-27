# Operating the Ascension 01 candidate

This candidate retains the existing GitHub Pages base path `/parallax-watchtower/`. It needs no account, API key, subscription, mandatory backend, or model. Use Node 22.12 or newer; CI uses Node 22 and Ubuntu 24.04. Local validation also used Node 24.22.3 and Playwright Chromium 141.0.7390.37.

## Reproduce the candidate

```bash
npm ci
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:browser
```

`npm run dev` starts the development UI. `npm run preview` serves the production bundle; open the repository base path printed by Vite. The production Content Security Policy is injected only during build so development hot reload remains functional. Core scripts load from the same origin; external frames, objects and inline scripts are blocked. Inline styles remain permitted for React/MapLibre; HTTPS data connections remain permitted for existing providers and explicitly configured public proxies. GitHub Pages cannot apply arbitrary custom HTTP headers. The optional Netlify configuration adds `nosniff`, referrer and camera/microphone policy headers.

## Source collection

```bash
node scripts/refreshNews.mjs
```

The collector uses only reviewed registry URLs. It enforces source cooldowns from the existing health sidecar. Re-running this command does not bypass cooldowns, and there is no force-refresh option. It fetches feed metadata, never linked article bodies, PDFs, media or attachments. A source can publish less often than the collector runs.

Published files:

- `data/news.v1.json`: last successful or partially successful news snapshot.
- `data/news-health.v1.json`: latest attempt/backoff state, including complete collection failure.
- `data/news-sources.v1.json`: reviewed registry, permissions, attributions and limitations.

Partial source failure retains old records with their original retrieval time. Total failure preserves the news snapshot bytes, updates health, and exits nonzero. The six-hour scheduled workflow publishes that failure health before finishing with a failure conclusion. A successful workflow means valid metadata retrieval/build/deployment; it does not verify world events.

The new workflow is main-only. Creating a draft PR neither executes its schedule nor deploys its candidate. After an authorized merge, verify the CI, first news-cache job, Pages deployment, same-origin JSON files, source health, actual UI and browser errors separately. GitHub-token cache commits do not trigger ordinary downstream push workflows, so each cache workflow explicitly builds and deploys. Existing orbital/discovery schedules and the shared `pages` concurrency group are preserved. Delayed schedules and Pages-provider artifact failures remain possible.

## Newsroom use

The default Global Command stream shows news and institutional reports. Enable observation catalogs when wanted, or use Natural Hazards. Unknown exact dates never become current news: the all-dates archive also exposes undated announcements and date-only policy metadata. A reported-location filter uses source-supplied classification; source remit is not silently turned into a story coordinate.

Press `/` to focus search and Escape to clear it when focus is outside a text field. Saved workspaces retain desk, query, topic, region, time window, density and observation visibility. Keyword watches are local saved searches; they do not send notifications. Fullscreen uses the browser permission/capability and can be exited normally.

Save a public report to Research Room. Notes, hypotheses, disputed claims, corrections to review and disconfirming evidence are user annotations, separate from provider statements. A note can link a public receipt. Switching reports clears an unsaved note draft to prevent assigning it to another report. Compare suggested groups or select another saved report explicitly; a manual comparison creates no factual relationship.

The briefing is deterministic metadata selection, not generated original reporting. Its explicit ranking uses known publication time, then source occurrence/modification where publication is unavailable. The brief does not infer public impact or publisher credibility. Print and Markdown/JSON exports retain original source references. An empty or incomplete brief describes its coverage limits.

## Local data and privacy

IndexedDB stores at most 2,000 public metadata records with 7/30/90-day retrieval-age retention. A canonical record is replaced by a later receipt; this is not a versioned historical archive. Settings, watches and bounded research annotations stay in browser-local storage. Denied/quota-limited storage degrades to a usable in-memory session; the UI explains that persistence failed.

Public archive export omits private notes, watches, saved views and browser location. It stays below the same 3 MB UTF-8 import ceiling and reports any omitted records. Imports are validated atomically, never dereferenced, and relabeled as unreviewed user submissions. No browser permission or upload occurs automatically. Clearing local news and notes affects this device's newsroom; a later refresh may load the public snapshot again. Existing atlas watch zones and Discovery Inbox storage are separate.

## Evidence capture and rollback

After a production build, `node scripts/captureNewsroom.mjs` uses the actual dated public cache, blocks external network requests, captures desktop/light/mobile screenshots, exports a real source-backed brief and writes local browser measurements. It is a reproducible local check, not production or global-network performance evidence.

Before merge, rollback is discarding/reverting the feature branch. After an authorized release, revert the feature commit(s) and new news-cache workflow together, rebuild and redeploy the previous site. Keep the original `/parallax-watchtower/` base. The candidate introduces no destructive migration or cross-application synchronization; its local newsroom store has a distinct name. Do not remove users' local notes as part of a code rollback.

Tier 3 SQLite services, containers, model endpoints and downstream consumers are deferred; no installation or operational success for those tiers is claimed.
