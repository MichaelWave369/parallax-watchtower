import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCOVERY_SCHEMA, MAX_DISCOVERY_ITEMS, candidateFromLink, candidateFromSignal,
  safeDiscoveryUrl, receiptKey, isValidCandidate, addCandidate,
  setReviewState, setReviewNote, readInbox, encodeInbox, createReviewPacket
} from "../lib/incidentDiscovery.mjs";

const NOW = Date.parse("2026-11-14T22:00:00Z");
const quake = {
  id: "usgs-e1", type: "earthquake", title: "M 5.3 earthquake", summary: "Example place",
  source: "USGS Earthquake Feed", sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/e1",
  timestamp: "2026-11-14T21:00:00Z", magnitude: 5.3, confidence: "verified_official",
  privacyClass: "public", lat: 40.0, lon: -120.0, facts: { status: "automatic" }
};

test("nominates source-linked public signals, never pretends to verify them", () => {
  const candidate = candidateFromSignal(quake, NOW);
  assert.equal(candidate.title, "M 5.3 earthquake");
  assert.equal(candidate.origin, "public-signal");
  assert.equal(candidate.status, "pending");
  assert.equal(candidate.sourceTimestamp, "2026-11-14T21:00:00.000Z");
  assert.equal(isValidCandidate(candidate), true);
  assert.equal("lat" in candidate, false);
  assert.equal("lon" in candidate, false);
  assert.equal("facts" in candidate, false);
});

test("excludes low-magnitude, private, fallback, unverifiable and non-event layers", () => {
  assert.equal(candidateFromSignal({ ...quake, magnitude: 2.5 }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, privacyClass: "consent_based" }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, confidence: "approximate" }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, sourceUrl: "http://example.org" }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, timestamp: "2026-10-01T00:00:00Z" }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, type: "orbit" }, NOW), null);
  assert.equal(candidateFromSignal({ ...quake, type: "news", facts: { adapter: "fallback" } }, NOW), null);
  const wildfire = candidateFromSignal({ ...quake, id: "fire-1", type: "wildfire", magnitude: undefined }, NOW);
  assert.equal(wildfire.signalType, "wildfire");
});

test("manual links need HTTPS and a title, without inventing an event timestamp", () => {
  assert.throws(() => candidateFromLink({ title: "", url: "https://www.faa.gov/newsroom" }, NOW), /title/);
  assert.throws(() => candidateFromLink({ title: "test", url: "javascript:alert(1)" }, NOW), /HTTPS/);
  const candidate = candidateFromLink({
    title: "Official FAA statement",
    url: "https://www.faa.gov/newsroom/faa-statement-nationwide-ground-stop?utm_source=test",
    summary: "A source for human follow-up"
  }, NOW);
  assert.equal(candidate.sourceTimestamp, null);
  assert.equal(candidate.origin, "manual-link");
  assert.equal(candidate.status, "pending");
  assert.equal(isValidCandidate(candidate), true);
  assert.ok(receiptKey(candidate.sourceUrl).includes("faa-statement-nationwide-ground-stop"));
  assert.ok(!receiptKey(candidate.sourceUrl).includes("utm_"));
});

test("review queue deduplicates receipts and preserves human decisions", () => {
  const first = candidateFromLink({ title: "Case", url: "https://www.faa.gov/newsroom/test?utm_source=a" }, NOW);
  const second = candidateFromLink({ title: "Duplicate", url: "https://www.faa.gov/newsroom/test?utm_source=b" }, NOW);
  const a = addCandidate([], first);
  assert.equal(a.added, true);
  assert.equal(addCandidate(a.items, second).added, false);
  const reviewing = setReviewState(a.items, first.id, "reviewing");
  assert.equal(reviewing[0].status, "reviewing");
  const commented = setReviewNote(reviewing, first.id, "Awaiting independent confirmation");
  assert.equal(commented[0].reviewNote, "Awaiting independent confirmation");
  assert.throws(() => setReviewState(commented, first.id, "published"), /Unknown/);
  assert.equal(addCandidate(commented, first).items[0].status, "reviewing");
});

test("persisted local inbox validates and discards malformed records", () => {
  const first = candidateFromSignal(quake, NOW);
  assert.deepEqual(readInbox(encodeInbox([first])), [first]);
  assert.deepEqual(readInbox("{bad json"), []);
  assert.deepEqual(readInbox(JSON.stringify({schema:"wrong",items:[first]})), []);
  assert.deepEqual(readInbox(JSON.stringify({schema:DISCOVERY_SCHEMA,items:[{id:"bad"}]})), []);
  assert.equal(MAX_DISCOVERY_ITEMS, 80);
});

test("review export is explicit, privacy-minimal, and cannot publish cases", () => {
  const candidate = candidateFromSignal(quake, NOW);
  const packet = createReviewPacket([candidate], NOW);
  assert.equal(packet.schema, DISCOVERY_SCHEMA);
  assert.equal(packet.purpose, "human-review-only");
  assert.equal(packet.publishedCases, 0);
  assert.equal(packet.candidates.length, 1);
  assert.match(packet.warning, /not confirmed incidents/);
  const json = JSON.stringify(packet);
  assert.doesNotMatch(json, /"lat"|"lon"|"watchZone"|"browserLocation"|"facts"/);
  assert.match(json, /earthquake\.usgs\.gov/);
});

test("rejects unsafe destinations and credential-bearing links", () => {
  assert.equal(safeDiscoveryUrl("http://example.com"), null);
  assert.equal(safeDiscoveryUrl("https://name:secret@example.com"), null);
  assert.equal(safeDiscoveryUrl("javascript:alert(1)"), null);
  assert.equal(safeDiscoveryUrl("https://www.faa.gov/newsroom#private"), "https://www.faa.gov/newsroom");
});
