import test from "node:test";
import assert from "node:assert/strict";
import { normalizeIssPosition } from "../lib/issFeed.mjs";
import { buildPeekabooPublicViewsUrl, PEEKABOO_URL } from "../lib/peekabooBridge.mjs";
const now = Date.parse("2026-11-14T03:00:00Z");
const sample = { id: 25544, latitude: 37.2, longitude: -123.1, timestamp: now / 1000 - 35, altitude: 424.1, velocity: 27601.4, units: "kilometers", visibility: "daylight" };
test("ISS emits a source-receipted sampled ground-track location", () => {
  const iss = normalizeIssPosition(sample, now)[0];
  assert.equal(iss.type, "satellite");
  assert.equal(iss.lat, 37.2);
  assert.equal(iss.lon, -123.1);
  assert.equal(iss.facts.noradId, 25544);
  assert.equal(iss.facts.altitudeKm, 424.1);
  assert.equal(iss.facts.observationAgeSeconds, 35);
  assert.match(iss.summary, /sub-satellite point/);
});
test("ISS rejects unexpected catalog identifiers and bad coordinates", () => {
  assert.throws(() => normalizeIssPosition({ ...sample, id: 12345 }, now), /NORAD 25544/);
  assert.throws(() => normalizeIssPosition({ ...sample, latitude: 999 }, now), /invalid coordinates/);
  assert.throws(() => normalizeIssPosition({ ...sample, longitude: Infinity }, now), /invalid coordinates/);
});
test("ISS suppresses stale/future timestamps and unrecognized units", () => {
  assert.throws(() => normalizeIssPosition({ ...sample, timestamp: now / 1000 - 3600 }, now), /stale or future/);
  assert.throws(() => normalizeIssPosition({ ...sample, timestamp: now / 1000 + 500 }, now), /stale or future/);
  assert.throws(() => normalizeIssPosition({ ...sample, units: "miles" }, now), /units are unknown/);
});
test("ISS does not invent missing telemetry", () => {
  const iss = normalizeIssPosition({ ...sample, altitude: "unknown", velocity: null }, now)[0];
  assert.equal(iss.facts.altitudeKm, null);
  assert.equal(iss.facts.velocityKmH, null);
});
test("Peekaboo public view deep-link keeps location/mode contract", () => {
  const url = new URL(buildPeekabooPublicViewsUrl({ lat: 39.9277, lon: -122.1792 }, 9));
  const params = new URLSearchParams(url.hash.slice(1));
  assert.equal(params.get("map"), "9/39.92770/-122.17920");
  assert.equal(params.get("mode"), "public");
  assert.equal(params.get("layers"), "");
});
test("Peekaboo deep-link handles malformed centers safely", () => {
  assert.equal(buildPeekabooPublicViewsUrl({ lat: 400, lon: 0 }), PEEKABOO_URL);
  assert.equal(buildPeekabooPublicViewsUrl({ lat: NaN, lon: 0 }), PEEKABOO_URL);
});
