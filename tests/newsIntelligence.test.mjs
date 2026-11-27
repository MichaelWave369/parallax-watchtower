import test from "node:test";
import assert from "node:assert/strict";
import {
  NEWS_BRIEFING_SCHEMA, MAX_NEWS_INPUT, deduplicateNews, newsRecordFreshness,
  clusterEvents, compareEventReports, makeNewsBriefing, validateBriefingCitations, briefingToMarkdown
} from "../lib/newsIntelligence.mjs";

const NOW = Date.parse("2026-11-26T18:00:00Z");
const headline = "NASA Artemis mission completes successful lunar navigation test";
function report(id, overrides = {}) {
  return { id, sourceId: "nasa-news", publisher: "NASA", originGroup: "nasa",
    title: headline, url: `https://www.nasa.gov/news/${id}`, canonicalUrl: `https://www.nasa.gov/news/${id}`,
    summary: "Public feed metadata, not full-text reporting.", language: "en", topics: ["science", "space"],
    region: { code: "GLOBAL", label: "Location not specified", precision: "global" },
    publishedAt: "2026-11-26T16:00:00Z", eventAt: null, modifiedAt: null,
    retrievedAt: "2026-11-26T17:00:00Z", kind: "official_statement", evidenceType: "official_statement",
    fingerprint: "untrusted-provider-hash", privacyClass: "public", demo: false, ...overrides };
}
const opts = { now: NOW };

test("canonical URL duplicates collapse across publishers without multiplying confirmations", () => {
  const first = report("nasa-a", { url: "https://www.nasa.gov/news/mission?utm_source=feed#more" });
  const second = report("agency-a", { publisher: "Agency", sourceId: "agency", originGroup: "agency", url: "https://www.nasa.gov/news/mission" });
  const result = deduplicateNews([first, second], opts);
  assert.equal(result.records.length, 1);
  assert.equal(result.duplicates[0].reason, "canonical_url");
  assert.deepEqual(result, deduplicateNews([second, first], opts));
  assert.equal(clusterEvents([first, second], opts)[0].id, clusterEvents([second, first], opts)[0].id);
});

test("same-origin headline fingerprint and exact report time deduplicate, later observations remain distinct", () => {
  const first = report("a");
  const copy = report("b", { sourceId: "nasa-atom" });
  const later = report("c", { publishedAt: "2026-11-26T17:00:00Z" });
  const result = deduplicateNews([first, copy, later], opts);
  assert.deepEqual(result.records.map(row => row.id), ["a", "c"]);
  assert.equal(result.duplicates[0].reason, "same_origin_fingerprint_and_time");
});

test("different-origin copies remain inspectable and are not independent confirmations", () => {
  const reports = [report("a"), report("b", { originGroup: "another", sourceId: "another", publisher: "Another publisher" })];
  const events = clusterEvents(reports, opts);
  assert.equal(events.length, 1);
  assert.equal(events[0].articles.length, 2);
  assert.equal(events[0].originGroups.length, 2);
  assert.equal(events[0].possibleSyndication, true);
  assert.equal(events[0].independentCorroboration, "not_assessed");
  assert.equal(events[0].evidenceState, "multiple_origins_unreviewed");
  assert.match(events[0].grouping.reason, /suggested relationship only/);
});

test("one origin across two feeds counts once even when distinct reports can be grouped", () => {
  const events = clusterEvents([report("a"), report("b", { title: headline + " milestone", sourceId: "nasa-science" })], opts);
  assert.equal(events.length, 1);
  assert.equal(events[0].sourceCount, 2);
  assert.deepEqual(events[0].originGroups, ["nasa"]);
  assert.equal(events[0].evidenceState, "single_origin");
});

test("time overlap, common topics and generic words cannot manufacture event relationships", () => {
  const records = [report("a"), report("b", { title: "NASA reveals plans for Venus atmospheric observatory research" })];
  assert.equal(clusterEvents(records, opts).length, 2);
  assert.equal(clusterEvents([report("a"), report("b", { title: headline + " milestone", topics: ["economics"] })], opts).length, 2);
  assert.equal(clusterEvents([report("a"), report("b", { title: headline + " milestone", region: { code: "US", label: "United States", precision: "country" } })], opts).length, 2);
  assert.equal(clusterEvents([report("a"), report("b", { title: headline + " milestone", publishedAt: "2026-11-23T12:00:00Z" })], opts).length, 2);
});

test("different quantities, negations and unrelated public-data observations remain separate", () => {
  assert.equal(clusterEvents([report("a", { title: headline + " 12" }), report("b", { title: headline + " 13" })], opts).length, 2);
  assert.equal(clusterEvents([report("a"), report("b", { title: "NASA Artemis mission has not completed successful lunar navigation test" })], opts).length, 2);
  const quake = { kind: "public_data", title: "USGS magnitude earthquake record near remote coastal island" };
  assert.equal(clusterEvents([report("a", { ...quake, eventAt: "2026-11-26T12:00:00Z" }), report("b", { ...quake, eventAt: "2026-11-26T13:00:00Z", originGroup: "other" })], opts).length, 2);
  assert.equal(deduplicateNews([report("a", { ...quake, eventAt: "2026-11-26T12:00:00Z" }), report("b", { ...quake, eventAt: "2026-11-26T13:00:00Z" })], opts).records.length, 2);
  assert.equal(clusterEvents([report("a", { eventAt: "2026-11-01T12:00:00Z" }), report("b", { eventAt: "2026-11-26T13:00:00Z", originGroup: "other" })], opts).length, 2);
});

test("nearby same-magnitude aftershocks keep distinct provider event receipts", () => {
  const quake = {
    kind: "public_data", sourceId: "usgs-earthquakes", publisher: "U.S. Geological Survey", originGroup: "usgs",
    title: "M 4.5 - Earthquake near remote coastal island region",
    region: { code: "GLOBAL", label: "Remote coastal island region", precision: "region" },
    topics: ["hazards"], publishedAt: null
  };
  const first = report("usgs-a", { ...quake, url: "https://earthquake.usgs.gov/earthquakes/eventpage/us-first", eventAt: "2026-11-26T12:00:00Z" });
  const aftershock = report("usgs-b", { ...quake, url: "https://earthquake.usgs.gov/earthquakes/eventpage/us-second", eventAt: "2026-11-26T12:02:00Z" });
  const events = clusterEvents([first, aftershock], opts);
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.articles.length === 1));
  const reported = { ...aftershock, id: "article-a", sourceId: "reporting", originGroup: "another", kind: "article" };
  assert.equal(clusterEvents([first, reported], opts).length, 2);
});

test("matching broad coverage codes cannot conceal different publisher-specified regions", () => {
  const a = report("a", { region: { code: "GLOBAL", label: "North coast region", precision: "region" } });
  const b = report("b", { region: { code: "GLOBAL", label: "South coast region", precision: "region" } });
  assert.equal(deduplicateNews([a, b], opts).records.length, 2);
  assert.equal(clusterEvents([a, b], opts).length, 2);
  const samePlace = { ...b, region: { code: "GLOBAL", label: "NORTH-COAST region", precision: "region" },
    title: headline + " milestone" };
  assert.equal(clusterEvents([a, samePlace], opts).length, 1);
});

test("grouping is deterministic, source-attributed and reversible with separateIds", () => {
  const a = report("a");
  const b = report("b", { title: headline + " milestone", publishedAt: "2026-11-26T17:00:00Z" });
  const forward = clusterEvents([a, b], opts);
  assert.deepEqual(forward, clusterEvents([b, a], opts));
  assert.equal(clusterEvents([a, b], { ...opts, separateIds: ["b"] }).length, 2);
  assert.equal(forward[0].id, clusterEvents([a], opts)[0].id);
  assert.equal(forward[0].eventAt, null);
  assert.ok(forward[0].timeline.every(item => item.recordId && item.sourceUrl.startsWith("https://")));
  assert.ok(forward[0].timeline.some(item => item.type === "retrieval"));
  assert.ok(forward[0].timeline.some(item => item.type === "publication"));
  assert.ok(forward[0].unknowns.some(text => /occurrence time/.test(text)));
});

test("event occurrence and retrieval do not become invented publication or modification times", () => {
  const event = clusterEvents([report("a", { publishedAt: null, eventAt: "2026-11-26T12:00:00Z" })], opts)[0];
  assert.equal(event.firstReportedAt, null);
  assert.equal(event.lastUpdatedAt, null);
  assert.equal(event.eventAt, "2026-11-26T12:00:00.000Z");
});

test("narrative comparison attributes headlines and excerpts without declaring factual agreement", () => {
  const event = clusterEvents([report("a")], opts)[0];
  const compared = compareEventReports(event);
  assert.equal(compared[0].headline, headline);
  assert.equal(compared[0].publisher, "NASA");
  assert.equal(compared[0].eventAt, null);
  assert.match(compared[0].interpretation, /require review/);
  assert.equal(compareEventReports(null).length, 0);
});

test("unsafe URLs, demonstration records and private records are excluded before analysis", () => {
  const records = [report("a", { url: "javascript:alert(1)" }), report("b", { demo: true }), report("c", { privacyClass: "private_local" }), report("d", { url: "https://localhost/secret" })];
  assert.equal(deduplicateNews(records, opts).records.length, 0);
  assert.deepEqual(clusterEvents(null, opts), []);
});

test("cache age and publication age remain different, and future retrieval is unknown", () => {
  const oldReport = report("a", { publishedAt: "2026-10-01T12:00:00Z" });
  const freshness = newsRecordFreshness(oldReport, NOW);
  assert.equal(freshness.state, "fresh");
  assert.ok(freshness.publicationAgeHours > 1000);
  assert.equal(newsRecordFreshness(report("b", { retrievedAt: "2026-11-24T12:00:00Z" }), NOW).state, "stale");
  assert.equal(newsRecordFreshness({ retrievedAt: "2026-11-26T18:01:00Z" }, NOW).state, "unknown");
});

test("briefing windows use source time, never retrieval to make old or undated records new", () => {
  const brief = makeNewsBriefing([
    report("a"), report("old", { publishedAt: "2026-10-01T12:00:00Z" }),
    report("undated", { publishedAt: null, eventAt: null, modifiedAt: null }),
    report("future", { publishedAt: "2026-11-26T18:01:00Z" })
  ], opts);
  assert.equal(brief.schema, NEWS_BRIEFING_SCHEMA);
  assert.deepEqual(brief.items.map(item => item.id), ["a"]);
  assert.equal(brief.coverage.excludedUndated, 1);
  assert.equal(validateBriefingCitations(brief), true);
});

test("briefing supports event-only and modification-only records and marks stale retrieval", () => {
  const brief = makeNewsBriefing([
    report("event", { publishedAt: null, eventAt: "2026-11-26T15:00:00Z" }),
    report("modified", { publishedAt: null, modifiedAt: "2026-11-26T14:00:00Z", retrievedAt: "2026-11-24T12:00:00Z" })
  ], opts);
  assert.deepEqual(brief.items.map(item => item.timeBasis), ["event", "modification"]);
  assert.equal(brief.items[1].freshness, "stale");
  assert.equal(brief.coverage.staleCount, 1);
});

test("briefing filters and ranking are explicit and bounded", () => {
  const brief = makeNewsBriefing([
    report("a"), report("b", { title: "Ocean monitoring instrument reports Pacific research results", topics: ["climate"], publishedAt: "2026-11-26T17:00:00Z" }),
    report("c", { title: "Solar monitoring instrument reports space weather research results", publishedAt: "2026-11-26T17:30:00Z" })
  ], { ...opts, topic: "space", query: "monitoring", region: "GLOBAL", maxItems: 1 });
  assert.equal(brief.items.length, 1);
  assert.equal(brief.items[0].id, "c");
  assert.match(brief.rankingMethod, /No engagement or inferred impact score/);
});

test("public briefing whitelist cannot leak notes, watch zones, account data or arbitrary metadata", () => {
  const brief = makeNewsBriefing([report("a", { notes: "PRIVATE-SECRET", watchZone: { lat: 39.1 }, privateKey: "SECRET-KEY", facts: { secret: "private" } })], opts);
  assert.doesNotMatch(JSON.stringify(brief), /PRIVATE-SECRET|SECRET-KEY|watchZone|privateKey|"notes"|"facts"/);
  assert.doesNotMatch(briefingToMarkdown(brief), /PRIVATE-SECRET|SECRET-KEY/);
});

test("citation validation rejects invented, mismatched or unsafe references", () => {
  const brief = makeNewsBriefing([report("a")], opts);
  const invented = structuredClone(brief);
  invented.items[0].referenceIds = ["does-not-exist"];
  assert.equal(validateBriefingCitations(invented), false);
  assert.throws(() => briefingToMarkdown(invented), /citations/);
  const mismatch = structuredClone(brief);
  mismatch.references[0].url = "https://www.nasa.gov/unrelated";
  assert.equal(validateBriefingCitations(mismatch), false);
  const hostile = structuredClone(brief);
  hostile.references[0].url = "data:text/html,hostile";
  assert.equal(validateBriefingCitations(hostile), false);
});

test("Markdown brief preserves source receipts and escapes active markup", () => {
  const brief = makeNewsBriefing([report("a", { title: "NASA [fake link](javascript:alert) **title** <script>alert(1)</script>" })], opts);
  const markdown = briefingToMarkdown(brief);
  assert.match(markdown, /\[source\\-1\]|\[source-1\]/);
  assert.match(markdown, /https:\/\/www\.nasa\.gov\/news\/a/);
  assert.doesNotMatch(markdown, /<script>|\[fake link\]\(javascript/);
});

test("input processing is bounded and empty briefings describe absent coverage honestly", () => {
  const empty = makeNewsBriefing([], opts);
  assert.equal(empty.items.length, 0);
  assert.equal(validateBriefingCitations(empty), true);
  assert.match(briefingToMarkdown(empty), /No dated source records/);
  const huge = new Array(MAX_NEWS_INPUT + 50).fill(null);
  const brief = makeNewsBriefing(huge, opts);
  assert.equal(brief.coverage.truncatedInput, true);
});
