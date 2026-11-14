// Watchtower Discovery Inbox v1. Candidate leads are NOT verified incidents.
// No network access here, no location persistence, and no automatic publication.
export const DISCOVERY_SCHEMA = "phi.watchtower.incident-proposals.v1";
export const DISCOVERY_STORAGE_KEY = "watchtower:discovery-inbox:v1";
export const MAX_DISCOVERY_ITEMS = 80;
export const ELIGIBLE_SIGNAL_TYPES = Object.freeze(["earthquake", "wildfire", "news"]);
export const REVIEW_STATES = Object.freeze(["pending", "reviewing", "dismissed"]);

function clean(value, max = 240) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function safeDiscoveryUrl(raw) {
  try {
    if (typeof raw !== "string" || raw.trim().length > 2000) return null;
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function receiptKey(raw) {
  const safe = safeDiscoveryUrl(raw);
  if (!safe) return null;
  const url = new URL(safe);
  for (const name of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(name) || /^(fbclid|gclid)$/i.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function isRecentTimestamp(value, nowMs) {
  const time = Date.parse(value);
  return typeof value === "string" && Number.isFinite(time) &&
    time <= nowMs + 6 * 60 * 60 * 1000 && time >= nowMs - 14 * 24 * 60 * 60 * 1000;
}

export function candidateFromSignal(signal, nowMs = Date.now()) {
  if (!signal || !ELIGIBLE_SIGNAL_TYPES.includes(signal.type) ||
      signal.privacyClass !== "public" ||
      !["reported", "verified_official"].includes(signal.confidence) ||
      signal.facts?.adapter === "fallback" || !safeDiscoveryUrl(signal.sourceUrl) ||
      !isRecentTimestamp(signal.timestamp, nowMs)) return null;
  if (signal.type === "earthquake" &&
      (!Number.isFinite(signal.magnitude) || signal.magnitude < 4.5)) return null;
  if (!clean(signal.id, 300) || !clean(signal.title, 180) || !clean(signal.source, 180)) return null;
  const sourceUrl = safeDiscoveryUrl(signal.sourceUrl);
  return {
    id: "signal:" + clean(signal.type, 30) + ":" + clean(signal.id, 300),
    origin: "public-signal",
    signalType: signal.type,
    title: clean(signal.title, 180),
    summary: clean(signal.summary, 700),
    sourceName: clean(signal.source, 180),
    sourceUrl,
    sourceTimestamp: new Date(signal.timestamp).toISOString(),
    capturedAt: new Date(nowMs).toISOString(),
    status: "pending",
    reviewNote: ""
  };
}

export function candidateFromLink({ title, url, summary = "" }, nowMs = Date.now()) {
  const sourceUrl = safeDiscoveryUrl(url);
  if (!sourceUrl) throw new Error("A valid HTTPS source URL is required.");
  const heading = clean(title, 180);
  if (!heading) throw new Error("A title is required.");
  const capturedAt = new Date(nowMs).toISOString();
  return {
    id: "link:" + receiptKey(sourceUrl),
    origin: "manual-link",
    signalType: "manual",
    title: heading,
    summary: clean(summary, 700),
    sourceName: "User-supplied public link; not independently checked",
    sourceUrl,
    sourceTimestamp: null,
    capturedAt,
    status: "pending",
    reviewNote: ""
  };
}

export function isValidCandidate(item) {
  return Boolean(item && typeof item === "object" &&
    typeof item.id === "string" && item.id.length <= 2100 && item.id.length > 3 &&
    ["public-signal", "manual-link"].includes(item.origin) &&
    [...ELIGIBLE_SIGNAL_TYPES, "manual"].includes(item.signalType) &&
    typeof item.title === "string" && item.title.length > 0 && item.title.length <= 180 &&
    typeof item.summary === "string" && item.summary.length <= 700 &&
    typeof item.sourceName === "string" && item.sourceName.length > 0 && item.sourceName.length <= 180 &&
    safeDiscoveryUrl(item.sourceUrl) &&
    (item.sourceTimestamp === null || (typeof item.sourceTimestamp === "string" && Number.isFinite(Date.parse(item.sourceTimestamp)))) &&
    typeof item.capturedAt === "string" && Number.isFinite(Date.parse(item.capturedAt)) &&
    REVIEW_STATES.includes(item.status) &&
    typeof item.reviewNote === "string" && item.reviewNote.length <= 700);
}

export function addCandidate(existing, candidate) {
  if (!isValidCandidate(candidate)) throw new Error("Candidate evidence is incomplete.");
  const valid = Array.isArray(existing) ? existing.filter(isValidCandidate) : [];
  const key = receiptKey(candidate.sourceUrl);
  if (valid.some((item) => item.id === candidate.id || receiptKey(item.sourceUrl) === key)) {
    return { items: valid.slice(0, MAX_DISCOVERY_ITEMS), added: false };
  }
  return { items: [candidate, ...valid].slice(0, MAX_DISCOVERY_ITEMS), added: true };
}

export function setReviewState(existing, id, state) {
  if (!REVIEW_STATES.includes(state)) throw new Error("Unknown review state.");
  return existing.filter(isValidCandidate).map((item) =>
    item.id === id ? { ...item, status: state } : item);
}

export function setReviewNote(existing, id, note) {
  return existing.filter(isValidCandidate).map((item) =>
    item.id === id ? { ...item, reviewNote: clean(note, 700) } : item);
}

export function readInbox(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (data?.schema !== DISCOVERY_SCHEMA || !Array.isArray(data.items)) return [];
    const valid = data.items.filter(isValidCandidate).slice(0, MAX_DISCOVERY_ITEMS);
    const seen = new Set();
    return valid.filter((item) => {
      const key = receiptKey(item.sourceUrl);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

export function encodeInbox(items) {
  return JSON.stringify({ schema: DISCOVERY_SCHEMA, items: items.filter(isValidCandidate).slice(0, MAX_DISCOVERY_ITEMS) });
}

export function createReviewPacket(items, nowMs = Date.now()) {
  const valid = readInbox(encodeInbox(items));
  return {
    schema: DISCOVERY_SCHEMA,
    version: 1,
    purpose: "human-review-only",
    publishedCases: 0,
    exportedAt: new Date(nowMs).toISOString(),
    warning: "These are candidate leads, not confirmed incidents or live public alerts. Review original receipts before publishing a case.",
    candidates: valid.map(({ id, origin, signalType, title, summary, sourceName, sourceUrl,
      sourceTimestamp, capturedAt, status, reviewNote }) => ({
      id, origin, signalType, title, summary, sourceName, sourceUrl,
      sourceTimestamp, capturedAt, status, reviewNote
    }))
  };
}
