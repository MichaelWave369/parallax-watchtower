// Evidence-backed, manually maintained research snapshots. Not a live incident API.
// Source URLs are official public statements. Keep preliminary attribution explicit.
export const INCIDENT_LEDGER_VERSION = "phi.watchtower.incidents.v1";
export const INCIDENT_CASES = Object.freeze([
  {
    "id": "faa-2026-11-13-ground-stop",
    "title": "FAA nationwide ground stop",
    "eventDate": "2026-11-13",
    "region": "United States",
    "phase": "Reopened, with recovery disruptions reported",
    "phaseAsOf": "2026-11-14",
    "summary": "The FAA temporarily stopped departures nationwide after instability in air traffic control telecommunications and radar data. The ground stop ended that evening; operational recovery continued into November 14.",
    "lastEditorialReview": "2026-11-14",
    "editorialNote": "Historical, manually reviewed public-source snapshot. Not a live FAA status feed, flight manifest, current travel advisory, or definitive root-cause report.",
    "sources": [
      {
        "id": "dot-13",
        "publisher": "U.S. Department of Transportation",
        "title": "November 13: Nationwide ground stop lifted",
        "url": "https://www.transportation.gov/briefing-room/icymi-us-transportation-secretary-sean-p-duffy-announces-lifting-nationwide-ground",
        "publishedDate": "2026-11-13",
        "kind": "official_statement"
      },
      {
        "id": "dot-14",
        "publisher": "U.S. Department of Transportation",
        "title": "November 14: Airspace restoration and preliminary investigation",
        "url": "https://www.transportation.gov/briefing-room/icymi-us-transportation-secretary-sean-p-duffy-provides-update-restoration-airspace",
        "publishedDate": "2026-11-14",
        "kind": "official_statement"
      }
    ],
    "timeline": [
      {
        "id": "instability",
        "displayAt": "Nov 13 · 3:36 PM ET",
        "timestamp": "2026-11-13T15:36:00-05:00",
        "precision": "minute",
        "label": "Communications and radar data instability",
        "detail": "In a November 13 briefing, the Transportation Secretary said inconsistencies at ATC centers and TRACONs began around 3:36 p.m. Eastern.",
        "evidenceType": "officially_reported",
        "sourceIds": [
          "dot-13"
        ]
      },
      {
        "id": "ground-stop",
        "displayAt": "Nov 13 · time not published in cited briefing",
        "date": "2026-11-13",
        "precision": "day",
        "label": "Nationwide departure ground stop",
        "detail": "The FAA ordered a nationwide ground stop as a precaution while communications and radar stability was in question. No exact initiation minute is assigned here.",
        "evidenceType": "officially_confirmed",
        "sourceIds": [
          "dot-13",
          "dot-14"
        ]
      },
      {
        "id": "reopened",
        "displayAt": "Nov 13 · 8:15 PM ET",
        "timestamp": "2026-11-13T20:15:00-05:00",
        "precision": "minute",
        "label": "Airspace reopened",
        "detail": "Transportation Secretary Duffy reported that the airspace reopened at 8:15 p.m. Eastern; departures were expected to resume gradually as crews and aircraft became available.",
        "evidenceType": "officially_confirmed",
        "sourceIds": [
          "dot-13"
        ]
      },
      {
        "id": "recovery",
        "displayAt": "Nov 14 · time not specified",
        "date": "2026-11-14",
        "precision": "day",
        "label": "Operational recovery reported",
        "detail": "DOT said U.S. airspace was open again but passengers should anticipate delays and cancellations during the recovery.",
        "evidenceType": "officially_confirmed",
        "sourceIds": [
          "dot-14"
        ]
      },
      {
        "id": "investigation",
        "displayAt": "Nov 14 · preliminary investigation",
        "date": "2026-11-14",
        "precision": "day",
        "label": "Possible equipment or installation fault under investigation",
        "detail": "DOT described maintenance involving copper-to-fiber / TDM-to-IP migration and reported abnormal router connection attempts. Officials explicitly said the specific fault had not been determined. This is a preliminary account, not a settled root cause.",
        "evidenceType": "preliminary_attributed",
        "sourceIds": [
          "dot-14"
        ]
      }
    ],
    "facts": [
      {
        "label": "Airspace reopened",
        "value": "8:15 PM ET · Nov 13",
        "sourceId": "dot-13",
        "qualification": "Official statement"
      },
      {
        "label": "Aircraft in air at onset",
        "value": "Over 3,500",
        "sourceId": "dot-13",
        "qualification": "Officially reported approximate count"
      },
      {
        "label": "Flight operations resumed Nov 13 night",
        "value": "Over 8,000",
        "sourceId": "dot-14",
        "qualification": "DOT report on Nov 14"
      }
    ],
    "contextResourceIds": [
      "02",
      "04",
      "07",
      "47"
    ]
  }
]);

export function isSafeIncidentUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function buildIncidentBrief(incident) {
  if (!incident || !Array.isArray(incident.timeline)) throw new TypeError("Incident record is required");
  const sourceById = new Map(incident.sources.map((source) => [source.id, source]));
  const lines = [
    `WATCHTOWER LIVE · INCIDENT ROOM · ${incident.title}`,
    `Date: ${incident.eventDate} | Region: ${incident.region}`,
    `Status as reported ${incident.phaseAsOf}: ${incident.phase}`,
    incident.summary,
    `NOTICE: ${incident.editorialNote}`,
    "",
    "EVIDENCE TIMELINE:"
  ];
  for (const item of incident.timeline) {
    const receipts = item.sourceIds.map((id) => sourceById.get(id)?.url).filter((url) => isSafeIncidentUrl(url));
    lines.push(`- ${item.displayAt}: ${item.label}. ${item.detail}`);
    for (const url of receipts) lines.push(`  Source: ${url}`);
  }
  lines.push("", "Evidence is attributed to publishers; preliminary accounts are not final findings.");
  return lines.join("\n");
}

export function validateIncident(incident) {
  if (!incident || !incident.id || !Array.isArray(incident.sources) || !Array.isArray(incident.timeline)) return false;
  const ids = new Set(incident.sources.map((item) => item.id));
  if (ids.size !== incident.sources.length || !incident.sources.every((source) =>
    source.publisher && source.publishedDate && isSafeIncidentUrl(source.url))) return false;
  if (!incident.timeline.every((item) =>
    item.label && item.detail && item.displayAt &&
    (item.precision === "minute" ? !Number.isNaN(Date.parse(item.timestamp)) : item.precision === "day" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) &&
    Array.isArray(item.sourceIds) && item.sourceIds.length > 0 && item.sourceIds.every((id) => ids.has(id)))) return false;
  return incident.facts.every((fact) => ids.has(fact.sourceId));
}
