// Conservative metadata tools. Grouping and retrieval success never verify a claim.
import { canonicalizeNewsUrl, normalizeNewsRecord } from "./newsContract.mjs";

export const NEWS_BRIEFING_SCHEMA = "phi.watchtower.briefing.v1";
export const NEWS_EVENT_SCHEMA = "phi.watchtower.event.v1";
export const MAX_NEWS_INPUT = 5000;
export const MAX_NEWS_EVENTS = 1500;
const HOUR = 3600000;
const STOP_WORDS = new Set("a an and are as at be been by for from has have in into is it its of on or over that the their this to today was were will with latest update updates says said new news".split(" "));
const LIMITATIONS = Object.freeze([
  "This is a deterministic selection of public source metadata, not original reporting or independent claim verification.",
  "Publication, event occurrence, modification and retrieval times have different meanings; unknown times remain unknown.",
  "Coverage depends on configured feeds and cache freshness. Missing reports do not establish that nothing happened.",
  "Publisher origin groups describe configured relationships; a count of groups is not a count of independent confirmations."
]);

/** @param {number|string} [now] */
function clock(now = Date.now()) {
  const value = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(value)) throw new TypeError("A valid reference time is required");
  return value;
}

function finiteTime(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
}

function reportTime(record) {
  for (const [key, basis] of [["publishedAt", "publication"], ["eventAt", "event"], ["modifiedAt", "modification"]]) {
    const value = finiteTime(record[key]);
    if (value !== null) return { value, basis };
  }
  return { value: null, basis: "unknown" };
}

function titleKey(title) {
  return String(title ?? "").normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(title) {
  return new Set(titleKey(title).split(/\s+/).filter(word => word.length > 2 && !STOP_WORDS.has(word)).slice(0, 40));
}

function stableHash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function cleanRecords(records, now) {
  const input = Array.isArray(records) ? records.slice(0, MAX_NEWS_INPUT) : [];
  return input.map(record => normalizeNewsRecord(record, now)).filter(Boolean);
}

/**
 * URLs collapse across publishers; fingerprint copies collapse only within an origin and exact report time.
 * @param {any[]} records
 * @param {{now?: number|string}} [options]
 */
export function deduplicateNews(records, { now = Date.now() } = {}) {
  const at = clock(now);
  const urls = new Map();
  const fingerprints = new Map();
  const retained = [];
  const duplicates = [];
  const ordered = cleanRecords(records, at).sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl) ||
    Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt) ||
    (finiteTime(b.modifiedAt) ?? -Infinity) - (finiteTime(a.modifiedAt) ?? -Infinity) ||
    a.id.localeCompare(b.id));
  for (const record of ordered) {
    const url = canonicalizeNewsUrl(record.canonicalUrl || record.url);
    if (!url) continue;
    const time = reportTime(record).value;
    const fingerprint = record.fingerprint && time !== null && record.kind !== "public_data"
      ? [record.originGroup, record.kind, record.fingerprint, time, record.eventAt, record.modifiedAt,
        record.language, record.region.code, record.region.precision,
        titleKey(record.region.label), titleKey(record.title)].join("|") : null;
    const previous = urls.get(url) || (fingerprint ? fingerprints.get(fingerprint) : null);
    if (previous) {
      duplicates.push({ retainedId: previous.id, duplicateId: record.id,
        reason: urls.has(url) ? "canonical_url" : "same_origin_fingerprint_and_time" });
      continue;
    }
    urls.set(url, record);
    if (fingerprint) fingerprints.set(fingerprint, record);
    retained.push(record);
  }
  return { records: retained, duplicates };
}

/**
 * @param {any} record
 * @param {number|string} [now]
 * @param {number} [maxAgeHours]
 */
export function newsRecordFreshness(record, now = Date.now(), maxAgeHours = 36) {
  const at = clock(now);
  const limit = Number.isFinite(maxAgeHours) && maxAgeHours > 0 ? maxAgeHours : 36;
  const retrieved = finiteTime(record?.retrievedAt);
  const published = finiteTime(record?.publishedAt);
  const age = retrieved === null || retrieved > at ? null : (at - retrieved) / HOUR;
  return {
    state: age === null ? "unknown" : age > limit ? "stale" : "fresh",
    retrievalAgeHours: age,
    publicationAgeHours: published === null || published > at ? null : (at - published) / HOUR
  };
}

function compatiblePlaces(a, b) {
  const left = a.region?.code;
  const right = b.region?.code;
  if (!left || !right || left !== right || a.region.precision !== b.region.precision) return false;
  // A broad coverage code such as GLOBAL can accompany a publisher's specific place label.
  // Without geocoded place identities, do not infer that differently named regions coincide.
  if (["region", "point"].includes(a.region.precision)) {
    const labelA = titleKey(a.region.label), labelB = titleKey(b.region.label);
    return Boolean(labelA && labelA === labelB && !/^(unknown|unspecified|location not specified)$/.test(labelA));
  }
  return true;
}

function relatedReports(a, b, aTokens, bTokens) {
  const ta = reportTime(a).value;
  const tb = reportTime(b).value;
  if (ta === null || tb === null || Math.abs(ta - tb) > 48 * HOUR) return false;
  if (!compatiblePlaces(a, b) || !a.topics?.some(topic => b.topics?.includes(topic))) return false;
  const eventA = finiteTime(a.eventAt), eventB = finiteTime(b.eventAt);
  if (eventA !== null && eventB !== null && Math.abs(eventA - eventB) > 48 * HOUR) return false;
  // A measurement/event receipt identifies its own observation. Similar headlines, nearby
  // timestamps and place labels cannot prove that different provider IDs are one event.
  // Canonical-URL copies already collapse in deduplicateNews; explicit cross-provider
  // event-identity matching can be added under a separate, evidence-backed contract.
  if ((a.kind === "public_data" || b.kind === "public_data") &&
      a.canonicalUrl !== b.canonicalUrl) return false;
  if (aTokens.size < 5 || bTokens.size < 5) return false;
  // Different numbers and explicit negation are retained for manual comparison, not silently merged.
  const numbers = title => [...String(title).matchAll(/\b\d+(?:\.\d+)?\b/g)].map(x => x[0]).sort().join("|");
  if (numbers(a.title) !== numbers(b.title)) return false;
  const negation = title => /\b(no|not|never|denies|denied|without)\b/i.test(title);
  if (negation(a.title) !== negation(b.title)) return false;
  let intersection = 0;
  for (const token of aTokens) if (bTokens.has(token)) intersection++;
  const union = aTokens.size + bTokens.size - intersection;
  return intersection >= 5 && intersection / union >= 0.72 &&
    intersection / Math.min(aTokens.size, bTokens.size) >= 0.85;
}

function makeEvent(articles) {
  const sorted = [...articles].sort((a, b) => (reportTime(a).value ?? Infinity) - (reportTime(b).value ?? Infinity) || a.id.localeCompare(b.id));
  const anchor = sorted[0];
  const publications = sorted.map(article => finiteTime(article.publishedAt)).filter(value => value !== null);
  const updates = sorted.flatMap(article => [finiteTime(article.publishedAt), finiteTime(article.modifiedAt)])
    .filter(value => value !== null);
  const origins = [...new Set(sorted.map(article => article.originGroup))].sort();
  const sources = [...new Set(sorted.map(article => article.sourceId))].sort();
  const occurrenceTimes = [...new Set(sorted.map(article => article.eventAt).filter(Boolean))];
  const sameTitles = new Set(sorted.map(article => titleKey(article.title))).size < sorted.length;
  return {
    schema: NEWS_EVENT_SCHEMA,
    id: `event-${stableHash(anchor.canonicalUrl)}`,
    title: anchor.title,
    description: "Source-linked reporting group. Review the original reports before drawing conclusions.",
    articles: sorted,
    firstReportedAt: publications.length ? new Date(Math.min(...publications)).toISOString() : null,
    lastUpdatedAt: updates.length ? new Date(Math.max(...updates)).toISOString() : null,
    eventAt: occurrenceTimes.length === 1 ? occurrenceTimes[0] : null,
    location: { code: anchor.region.code, label: anchor.region.label, precision: anchor.region.precision },
    originGroups: origins,
    sourceCount: sources.length,
    reportCount: sorted.length,
    independentCorroboration: "not_assessed",
    possibleSyndication: sameTitles && sorted.length > 1,
    evidenceState: origins.length > 1 ? "multiple_origins_unreviewed" : "single_origin",
    unknowns: ["The underlying claims have not been independently verified by this grouping tool.",
      "Source independence and syndication require human review.",
      ...(occurrenceTimes.length !== 1 ? ["An agreed event occurrence time is not established."] : []),
      ...(anchor.region.precision !== "point" ? ["No exact event coordinate is asserted."] : [])],
    timeline: sorted.flatMap(article => [
      ...(article.eventAt ? [{ type: "event", at: article.eventAt, recordId: article.id, sourceUrl: article.url }] : []),
      ...(article.publishedAt ? [{ type: "publication", at: article.publishedAt, recordId: article.id, sourceUrl: article.url }] : []),
      ...(article.modifiedAt ? [{ type: "modification", at: article.modifiedAt, recordId: article.id, sourceUrl: article.url }] : []),
      { type: "retrieval", at: article.retrievedAt, recordId: article.id, sourceUrl: article.url }
    ]).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.recordId.localeCompare(b.recordId)),
    grouping: { method: sorted.length > 1 ? "conservative_headline_time_topic_region" : "single_report",
      reason: sorted.length > 1 ? "Strong headline similarity within 48 hours, shared topic and compatible geographic precision; a suggested relationship only." : "No automatic relationship asserted.",
      reviewable: true }
  };
}

/**
 * Bounded token-index candidates avoid comparing every report to every other report.
 * @param {any[]} records
 * @param {{separateIds?: string[], now?: number|string}} [options]
 */
export function clusterEvents(records, { separateIds = [], now = Date.now() } = {}) {
  const at = clock(now);
  const clean = deduplicateNews(records, { now: at }).records;
  const separate = new Set(Array.isArray(separateIds) ? separateIds.slice(0, MAX_NEWS_INPUT) : []);
  const sorted = [...clean].sort((a, b) => (reportTime(a).value ?? Infinity) - (reportTime(b).value ?? Infinity) || a.id.localeCompare(b.id));
  const groups = [];
  const index = new Map();
  for (const article of sorted) {
    const words = tokens(article.title);
    const candidates = new Set();
    if (!separate.has(article.id)) {
      for (const word of words) for (const groupIndex of index.get(word) || []) {
        candidates.add(groupIndex);
        if (candidates.size >= 80) break;
      }
    }
    let match = -1;
    for (const groupIndex of [...candidates].slice(0, 80)) {
      const group = groups[groupIndex];
      // Compare against anchor and most recent report, preventing transitive similarity chains.
      if (!separate.has(group.articles[0].id) &&
          relatedReports(article, group.articles[0], words, group.words) &&
          relatedReports(article, group.articles[group.articles.length - 1], words, tokens(group.articles[group.articles.length - 1].title))) {
        match = groupIndex;
        break;
      }
    }
    if (match >= 0) {
      groups[match].articles.push(article);
    } else {
      const groupIndex = groups.length;
      groups.push({ articles: [article], words });
      if (!separate.has(article.id)) for (const word of words) {
        const bucket = index.get(word) || [];
        bucket.push(groupIndex);
        if (bucket.length > 80) bucket.shift();
        index.set(word, bucket);
      }
    }
  }
  return groups.map(group => makeEvent(group.articles))
    .sort((a, b) => (finiteTime(b.lastUpdatedAt) ?? finiteTime(b.eventAt) ?? -Infinity) -
      (finiteTime(a.lastUpdatedAt) ?? finiteTime(a.eventAt) ?? -Infinity) || a.id.localeCompare(b.id))
    .slice(0, MAX_NEWS_EVENTS);
}

/** @param {{articles: any[]}|null|undefined} event */
export function compareEventReports(event) {
  if (!event || !Array.isArray(event.articles)) return [];
  return event.articles.slice(0, MAX_NEWS_INPUT).map(article => ({
    recordId: article.id, publisher: article.publisher, sourceId: article.sourceId,
    originGroup: article.originGroup, headline: article.title, publishedAt: article.publishedAt,
    eventAt: article.eventAt, modifiedAt: article.modifiedAt, retrievedAt: article.retrievedAt,
    evidenceType: article.evidenceType, url: article.url,
    excerpt: article.summary || "No feed excerpt supplied.",
    correctionNotice: /^(correction|retraction|retracted)\b/i.test(article.title),
    interpretation: "Attributed source metadata; factual agreement, framing and independent corroboration require review."
  }));
}

function includesText(record, query) {
  return `${record.title} ${record.summary} ${record.publisher} ${record.topics.join(" ")} ${record.region.label}`
    .toLocaleLowerCase("en-US").includes(query.toLocaleLowerCase("en-US"));
}

/**
 * @param {any[]} records
 * @param {{now?: number|string, windowHours?: number, topic?: string, region?: string, query?: string, maxItems?: number}} [options]
 */
export function makeNewsBriefing(records, { now = Date.now(), windowHours = 24, topic = "", region = "", query = "", maxItems = 30 } = {}) {
  const at = clock(now);
  const hours = Number.isFinite(windowHours) && windowHours > 0 && windowHours <= 24 * 31 ? windowHours : 24;
  const limit = Number.isFinite(maxItems) ? Math.max(1, Math.min(100, Math.floor(maxItems))) : 30;
  const start = at - hours * HOUR;
  const { records: clean, duplicates } = deduplicateNews(records, { now: at });
  let undated = 0;
  const inWindow = clean.filter(record => {
    const time = reportTime(record).value;
    if (time === null) { undated++; return false; }
    return time >= start && time <= at;
  });
  const filtered = inWindow.filter(record =>
    (!topic || record.topics.includes(String(topic).slice(0, 80))) &&
    (!region || region === "all" || record.region.code === region || record.region.label === region) &&
    (!query || includesText(record, String(query).slice(0, 200))));
  filtered.sort((a, b) => reportTime(b).value - reportTime(a).value || a.id.localeCompare(b.id));
  const selected = filtered.slice(0, limit);
  const references = selected.map((record, i) => ({ id: `source-${i + 1}`, url: record.url,
    publisher: record.publisher, title: record.title }));
  const items = selected.map((record, i) => ({
    id: record.id, title: record.title, publisher: record.publisher, sourceId: record.sourceId,
    kind: record.kind, evidenceType: record.evidenceType,
    publishedAt: record.publishedAt, eventAt: record.eventAt, modifiedAt: record.modifiedAt,
    retrievedAt: record.retrievedAt, timeBasis: reportTime(record).basis,
    freshness: newsRecordFreshness(record, at).state,
    region: { code: record.region.code, label: record.region.label, precision: record.region.precision },
    topics: [...record.topics], url: record.url, referenceIds: [references[i].id]
  }));
  const retrievals = selected.map(record => Date.parse(record.retrievedAt)).filter(Number.isFinite);
  return {
    schema: NEWS_BRIEFING_SCHEMA, version: 1, generatedAt: new Date(at).toISOString(),
    from: new Date(start).toISOString(), through: new Date(at).toISOString(), windowHours: hours,
    rankingMethod: "Apply explicit topic, region and keyword filters, then order by known publication time (or event occurrence, then modification when publication is unknown), newest first; stable ID breaks ties. No engagement or inferred impact score.",
    coverage: { inputCount: Array.isArray(records) ? records.length : 0,
      acceptedCount: clean.length, inWindowCount: inWindow.length, matchedCount: filtered.length,
      includedCount: selected.length, excludedUndated: undated, duplicatesRemoved: duplicates.length,
      omittedCount: Math.max(0, filtered.length - selected.length),
      staleCount: items.filter(item => item.freshness === "stale").length,
      sourceCount: new Set(selected.map(record => record.sourceId)).size,
      truncatedInput: Array.isArray(records) && records.length > MAX_NEWS_INPUT,
      oldestRetrievalAt: retrievals.length ? new Date(Math.min(...retrievals)).toISOString() : null,
      newestRetrievalAt: retrievals.length ? new Date(Math.max(...retrievals)).toISOString() : null },
    items, references, limitations: [...LIMITATIONS]
  };
}

/** Reject unsupported or mismatched citations before printing a briefing. */
export function validateBriefingCitations(brief) {
  if (!brief || brief.schema !== NEWS_BRIEFING_SCHEMA || !Array.isArray(brief.items) ||
      !Array.isArray(brief.references) || brief.items.length > 100 || brief.references.length > 100) return false;
  const refs = new Map();
  for (const ref of brief.references) {
    if (!ref || typeof ref.id !== "string" || refs.has(ref.id) || !canonicalizeNewsUrl(ref.url) ||
        typeof ref.title !== "string" || typeof ref.publisher !== "string") return false;
    refs.set(ref.id, ref);
  }
  return brief.items.every(item => item && typeof item.title === "string" && typeof item.publisher === "string" &&
    canonicalizeNewsUrl(item.url) && Array.isArray(item.referenceIds) && item.referenceIds.length > 0 &&
    item.referenceIds.length <= 10 && item.referenceIds.every(id => refs.has(id) &&
      canonicalizeNewsUrl(refs.get(id).url) === canonicalizeNewsUrl(item.url) &&
      refs.get(id).title === item.title && refs.get(id).publisher === item.publisher));
}

function markdownText(value) {
  return String(value ?? "unknown").replace(/[\r\n\t]+/g, " ").slice(0, 2000)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+.!|~]/g, "\\$&");
}

export function briefingToMarkdown(brief) {
  if (!validateBriefingCitations(brief)) throw new TypeError("Briefing citations are invalid or unsupported");
  return ["# WATCHTOWER LIVE · Source-backed brief", "",
    `Generated: ${markdownText(brief.generatedAt)}`,
    `Window: ${markdownText(brief.from)} — ${markdownText(brief.through)}`, "",
    markdownText(brief.rankingMethod), "",
    ...(brief.items.length ? brief.items.flatMap(item => [
      `- **${markdownText(item.title)}** — ${markdownText(item.publisher)}`,
      `  Publication: ${markdownText(item.publishedAt)} · Occurrence: ${markdownText(item.eventAt)} · Modified: ${markdownText(item.modifiedAt)}`,
      `  Retrieved: ${markdownText(item.retrievedAt)} · Cache: ${markdownText(item.freshness)} · Evidence: ${markdownText(item.evidenceType)}`,
      `  ${item.referenceIds.map(id => `[${markdownText(id)}](<${canonicalizeNewsUrl(brief.references.find(ref => ref.id === id).url)}>)`).join(" ")}`, ""
    ]) : ["No dated source records match this window and selection.", ""]),
    "## Coverage and uncertainty", "",
    `Included records: ${brief.items.length}. Source feeds: ${Number(brief.coverage?.sourceCount) || 0}. Stale cache records: ${Number(brief.coverage?.staleCount) || 0}.`, "",
    ...LIMITATIONS.map(line => `- ${line}`), ""
  ].join("\n");
}
