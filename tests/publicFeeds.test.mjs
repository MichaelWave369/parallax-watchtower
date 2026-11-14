import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEonetWildfires, normalizeNoaaKp } from "../lib/publicFeeds.mjs";

test("wildfires: latest point, source receipt, and honest semantics", () => {
  const records = normalizeEonetWildfires({ events: [{
    id: "EONET_123", title: "Example fire", closed: null, geometry: [
      { type: "Point", date: "2026-11-01T00:00:00Z", coordinates: [-121.1, 40.4] },
      { type: "Point", date: "2026-11-02T00:00:00Z", coordinates: [-121.2, 40.5] }
    ]
  }]});
  assert.equal(records.length, 1);
  assert.equal(records[0].lat, 40.5);
  assert.equal(records[0].lon, -121.2);
  assert.match(records[0].confidenceNotes, /Not an active-fire perimeter/);
  assert.match(records[0].sourceUrl, /^https:\/\/eonet\.gsfc\.nasa\.gov/);
});

test("wildfires: no guessed position for polygon-only event", () => {
  const records = normalizeEonetWildfires({ events: [{
    id: "EONET_POLYGON", closed: null,
    geometry: [{ type: "Polygon", date: "2026-11-02T00:00:00Z", coordinates: [[[-121, 40], [-120, 40], [-121, 41]]] }]
  }]});
  assert.equal(records.length, 1);
  assert.equal(records[0].lat, undefined);
  assert.equal(records[0].facts.locationIsPerimeter, "no");
});

test("wildfires: skips closed/malformed records and rejects wrong shape", () => {
  const records = normalizeEonetWildfires({ events: [
    { id: "closed", closed: "2026-11-02T00:00:00Z", geometry: [{ type: "Point", date: "2026-11-01T00:00:00Z", coordinates: [0, 0] }] },
    { id: "bad", closed: null, geometry: [{ type: "Point", date: "not-a-date", coordinates: [0, 0] }] }
  ]});
  assert.equal(records.length, 0);
  assert.throws(() => normalizeEonetWildfires({}), /missing events/);
});

test("NOAA Kp: parses latest valid object-format observation", () => {
  const rows = normalizeNoaaKp([
    { time_tag: "2026-11-12T00:00:00Z", kp_index: "3.2" },
    { time_tag: "2026-11-13T00:00:00Z", kp_index: 5.4 },
    { time_tag: "invalid", kp_index: 8 }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].facts.kp, 5.4);
  assert.equal(rows[0].type, "space_weather");
  assert.equal(rows[0].lat, undefined);
  assert.equal(rows[0].timestamp, "2026-11-13T00:00:00.000Z");
});
test("NOAA Kp: missing observations do not fabricate a signal", () => {
  assert.deepEqual(normalizeNoaaKp([]), []);
  assert.deepEqual(normalizeNoaaKp([{ time_tag: "2026-11-13T00:00:00Z", kp_index: 99 }]), []);
  assert.throws(() => normalizeNoaaKp({}), /not a list/);
});
