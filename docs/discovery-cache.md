# WATCHTOWER LIVE | Scheduled Discovery Cache v1

## Scope

The Discovery Inbox now supports a centrally fetched, scheduled public candidate snapshot with an explicit human review gate. Candidate records are public, unreviewed research leads, not verified incidents, emergency alerts, or automatically published historical cases.

## Official providers

- USGS Earthquake GeoJSON: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson
- NASA EONET v3 wildfires: https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&days=14&limit=100

The USGS M4.5 selection is a noise-management threshold, not an emergency classification. NASA EONET events are curated metadata references, not fire perimeters or evacuation instructions. Only the central scheduled workflow requests these sources.

## Workflow and cache

- Workflow: .github/workflows/discovery-leads.yml
- Script: scripts/refreshDiscoveryLeads.mjs
- Pure contract: lib/discoveryCache.mjs
- Public snapshot: public/data/discovery-candidates.v1.json
- Cron: 06:43 and 18:43 UTC daily, plus manual dispatch and initial deployment on workflow/script changes.
- Requests one fixed HTTPS endpoint per provider, with timeout, size limit, no redirects and no retries.
- Limit: 40 de-duplicated candidates; strict source-domain receipt checks; no raw event geography or private browser location.
- Partial provider failure is displayed. Both providers failing leaves the previous snapshot unchanged and fails the Action. An old snapshot may remain publicly readable but cannot be queued if older than 36 hours.
- Uses the same GitHub Pages concurrency group as existing orbital and normal Pages workflows. GitHub-token data commits do not necessarily trigger downstream push deployments; the scheduled workflow builds and deploys directly.
- Avoids a no-change commit for up to ten hours if candidate data and provider status are identical.

## Human review

Opening Discovery Inbox reads the static snapshot. Its timestamp and per-provider status remain visible. Queuing an individual lead is a manual action and saves it to the user's bounded local browser inbox. Existing reviewer notes, export and status transitions remain locally controlled. Nothing in this workflow modifies the independently maintained published incidents in Incident Room.

## Limitations

This is not generalized infrastructure-outage detection. It covers only two official environmental source families; FAA and other infrastructure notices still require separate manual source review. A returned feed result does not establish incident impact or causality. Source rights, rate limits, data meanings, and provenance must be rechecked before adding other providers.

## Verification

Run npm test, npm run build and npm run test:browser. Verify the initial placeholder displays pending without invented results, then confirm the first scheduled Actions job and resulting GitHub Pages publication after merge.
