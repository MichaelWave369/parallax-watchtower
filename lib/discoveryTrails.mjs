// A provenance-first discovery lens. Grouping by a UTC interval never means causation,
// shared location, common origin, elevated risk, or a confirmed incident.
import { isValidCandidate, receiptKey } from "./incidentDiscovery.mjs";
import { officialReceiptUrl } from "./discoveryCache.mjs";

export const DISCOVERY_TRAILS_SCHEMA = "phi.watchtower.temporal-trails.v1";
export const DISCOVERY_TRAIL_PERIODS = Object.freeze(["day", "week"]);
const MAX_INPUT = 100;
const MAX_WINDOWS = 14;

function utcDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function getBucket(timestampMs, period) {
  const date = new Date(timestampMs);
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (period === "day") return {startMs: dayStart, endMs: dayStart + 86400000};
  // Monday-to-Sunday calendar weeks, in UTC, rather than a rolling 7-day assertion.
  const sinceMonday = (new Date(dayStart).getUTCDay() + 6) % 7;
  const monday = dayStart - sinceMonday * 86400000;
  return {startMs: monday, endMs: monday + 7 * 86400000};
}
function eligible(item) {
  if (!isValidCandidate(item) || item.origin !== "public-signal" ||
      !["earthquake", "wildfire"].includes(item.signalType) ||
      typeof item.sourceTimestamp !== "string" || !Number.isFinite(Date.parse(item.sourceTimestamp))) return false;
  const host = item.signalType === "earthquake" ? "earthquake.usgs.gov" : "eonet.gsfc.nasa.gov";
  return Boolean(officialReceiptUrl(item.sourceUrl, host));
}

export function groupTemporalTrails(candidates, period = "week") {
  if (!DISCOVERY_TRAIL_PERIODS.includes(period)) throw new Error("Unsupported UTC period");
  const groups = new Map();
  const seen = new Set();
  for (const item of (Array.isArray(candidates) ? candidates : []).slice(0, MAX_INPUT)) {
    if (!eligible(item)) continue;
    const key = receiptKey(item.sourceUrl);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const time = Date.parse(item.sourceTimestamp);
    const {startMs, endMs} = getBucket(time, period);
    const id = period + ":" + utcDate(startMs);
    if (!groups.has(id)) groups.set(id, {
      id, period, from: utcDate(startMs),
      through: utcDate(endMs - 1), candidates: []
    });
    groups.get(id).candidates.push(item);
  }
  return [...groups.values()].map((group) => {
    group.candidates.sort((a,b) => Date.parse(b.sourceTimestamp) - Date.parse(a.sourceTimestamp) ||
      a.sourceUrl.localeCompare(b.sourceUrl));
    const earthquake = group.candidates.filter((item) => item.signalType === "earthquake").length;
    const wildfire = group.candidates.filter((item) => item.signalType === "wildfire").length;
    return {
      ...group,
      counts: {earthquake, wildfire},
      hasBothSources: earthquake > 0 && wildfire > 0,
      label: group.period === "day" ? group.from + " UTC"
        : group.from + " to " + group.through + " UTC"
    };
  }).sort((a,b) => b.from.localeCompare(a.from)).slice(0, MAX_WINDOWS);
}

export function makeTemporalResearchPacket(window, snapshotGeneratedAt = null) {
  if (!window || !DISCOVERY_TRAIL_PERIODS.includes(window.period) ||
      typeof window.from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(window.from) ||
      !Array.isArray(window.candidates)) throw new TypeError("A selected temporal window is required");
  const checked = groupTemporalTrails(window.candidates, window.period)
    .find((group) => group.from === window.from);
  if (!checked) throw new Error("Window contains no valid official source receipts");
  return {
    schema: DISCOVERY_TRAILS_SCHEMA,
    version: 1,
    purpose: "unreviewed-temporal-research",
    publishedIncidents: 0,
    timeBasis: "Source record timestamps grouped into UTC " + window.period + " intervals",
    period: window.period,
    from: checked.from, through: checked.through,
    cachedSnapshotAt: typeof snapshotGeneratedAt === "string" ? snapshotGeneratedAt : null,
    comparisonBasis: "Shared calendar interval only; no matching by location, physical mechanism or causality",
    warning: "Co-occurrence does not establish a connection. EONET geometry timestamps are not wildfire ignition times. These entries are candidate records, not verified incident impacts or safety alerts.",
    counts: checked.counts,
    receipts: checked.candidates.map((item) => ({
      signalType: item.signalType, title: item.title, summary: item.summary,
      sourceName: item.sourceName, sourceTimestamp: item.sourceTimestamp,
      sourceUrl: item.sourceUrl
    }))
  };
}

export function formatTemporalResearchBrief(window, snapshotGeneratedAt = null) {
  const packet = makeTemporalResearchPacket(window, snapshotGeneratedAt);
  return [
    "WATCHTOWER LIVE | TEMPORAL DISCOVERY TRAIL",
    "Window: " + packet.from + " to " + packet.through + " UTC",
    "Basis: " + packet.comparisonBasis,
    "Original snapshot: " + (packet.cachedSnapshotAt ?? "Unknown"),
    "USGS quakes: " + packet.counts.earthquake + " | NASA EONET wildfire references: " + packet.counts.wildfire,
    "NOTICE: " + packet.warning, "",
    ...packet.receipts.flatMap((receipt) => [
      receipt.signalType + " | " + receipt.sourceTimestamp + " | " + receipt.title,
      "Receipt: " + receipt.sourceUrl
    ])
  ].join("\n");
}
