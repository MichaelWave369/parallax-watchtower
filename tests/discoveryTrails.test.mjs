import test from "node:test";
import assert from "node:assert/strict";
import { candidateFromSignal } from "../lib/incidentDiscovery.mjs";
import {
  DISCOVERY_TRAILS_SCHEMA, groupTemporalTrails, makeTemporalResearchPacket,
  formatTemporalResearchBrief
} from "../lib/discoveryTrails.mjs";

const NOV14 = Date.parse("2026-11-14T23:32:27Z");
const quake = candidateFromSignal({
  id: "usgs-123", type: "earthquake", title: "M5.0 example",
  summary: "Example sea", source: "USGS Earthquake Feed",
  sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/123",
  timestamp: "2026-11-14T12:00:00Z", magnitude: 5, confidence: "verified_official",
  privacyClass: "public"
}, NOV14);
const fire = candidateFromSignal({
  id: "eonet-123", type: "wildfire", title: "EONET event example",
  summary: "Curated event", source: "NASA EONET wildfire catalog",
  sourceUrl: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_123",
  timestamp: "2026-11-12T08:00:00Z", confidence: "reported",
  privacyClass: "public"
}, NOV14);
const oldFire = candidateFromSignal({
  id: "eonet-older", type: "wildfire", title: "Older curated event",
  summary: "Reference only", source: "NASA EONET wildfire catalog",
  sourceUrl: "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_OLDER",
  timestamp: "2026-11-05T08:00:00Z", confidence: "reported",
  privacyClass: "public"
}, NOV14);

test("UTC days do not invent cross-source matches when records land on different dates", () => {
  const days = groupTemporalTrails([quake, fire, oldFire], "day");
  assert.deepEqual(days.map(x => x.from), ["2026-11-14", "2026-11-12", "2026-11-05"]);
  assert.ok(days.every(x => !x.hasBothSources));
  assert.ok(days.every(x => x.candidates.length === 1));
});

test("Monday-to-Sunday UTC weeks group independent sources, not purported causes", () => {
  const weeks = groupTemporalTrails([quake, fire, oldFire], "week");
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].from, "2026-11-09");
  assert.equal(weeks[0].through, "2026-11-15");
  assert.deepEqual(weeks[0].counts, { earthquake: 1, wildfire: 1 });
  assert.equal(weeks[0].hasBothSources, true);
  assert.equal(weeks[1].from, "2026-11-02");
  assert.deepEqual(weeks[1].counts, { earthquake: 0, wildfire: 1 });
  assert.equal(weeks[1].hasBothSources, false);
  assert.throws(() => groupTemporalTrails([], "month"), /Unsupported/);
});

test("only validated USGS and NASA receipts are considered; duplicate receipts collapse", () => {
  const badHost = {...quake, id:"signal:earthquake:forged", sourceUrl: "https://attacker.test/earthquake"};
  const malformed = {...quake, sourceTimestamp: null};
  const manual = {...quake, origin:"manual-link"};
  const duplicate = {...quake, id:"signal:earthquake:copy"};
  const orbit = {...quake, signalType:"orbit"};
  const result = groupTemporalTrails([badHost, malformed, manual, duplicate, orbit, quake, fire]);
  assert.equal(result.length, 1);
  assert.equal(result[0].candidates.length, 2);
});

test("research brief retains receipts and explicit uncertainty without fabricated geography", () => {
  const weekly = groupTemporalTrails([quake, fire], "week")[0];
  const packet = makeTemporalResearchPacket(weekly, "2026-11-14T23:32:27Z");
  assert.equal(packet.schema, DISCOVERY_TRAILS_SCHEMA);
  assert.equal(packet.publishedIncidents, 0);
  assert.equal(packet.purpose, "unreviewed-temporal-research");
  assert.equal(packet.receipts.length, 2);
  assert.match(packet.warning, /not wildfire ignition times/);
  assert.match(packet.comparisonBasis, /no matching by location/);
  assert.doesNotMatch(JSON.stringify(packet), /"lat"|"lon"|"geometry"|"facts"|"watchZone"/);
  const brief = formatTemporalResearchBrief(weekly);
  assert.match(brief, /earthquake\.usgs\.gov/);
  assert.match(brief, /eonet\.gsfc\.nasa\.gov/);
  assert.match(brief, /Co-occurrence does not establish a connection/);
});

test("bad windows and empty inputs cannot masquerade as source-backed research", () => {
  assert.deepEqual(groupTemporalTrails(null), []);
  assert.throws(() => makeTemporalResearchPacket(null), /required/);
  assert.throws(() => makeTemporalResearchPacket({from:"2026-11-09",period:"week",candidates:[]}), /no valid official/);
});
