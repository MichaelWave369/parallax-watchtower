import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOmm, makeOrbitalSnapshot, validateOrbitalSnapshot, propagateOrbitalSnapshot } from "../lib/orbitalCatalog.mjs";

const when = Date.parse("2026-11-14T04:00:00Z");
const base = {
  OBJECT_NAME: "PUBLIC DEMO ORBIT", OBJECT_ID: "2026-001A", EPOCH: "2026-11-14T03:40:00.000",
  NORAD_CAT_ID: 61001, MEAN_MOTION: 15.0, ECCENTRICITY: 0.000583,
  INCLINATION: 98.3164, RA_OF_ASC_NODE: 103.8411, ARG_OF_PERICENTER: 20.5667,
  MEAN_ANOMALY: 339.5789, BSTAR: 0.00048021, MEAN_MOTION_DOT: 0.00005995,
  MEAN_MOTION_DDOT: 0, EPHEMERIS_TYPE: 0, CLASSIFICATION_TYPE: "U",
  ELEMENT_SET_NO: 999, REV_AT_EPOCH: 8655
};
const second = { ...base, NORAD_CAT_ID: 61002, OBJECT_NAME: "SECOND ORBITAL OBJECT" };
const snapshot = makeOrbitalSnapshot([
  { key: "stations", items: [base] },
  { key: "visual", items: [second, { ...base, OBJECT_NAME: "DUPLICATE GROUP" }] }
], new Date(when).toISOString());

test("normalization preserves full catalog numbers (not legacy five-digit TLEs)", () => {
  assert.equal(normalizeOmm({ ...base, NORAD_CAT_ID: 100123 }).NORAD_CAT_ID, 100123);
  assert.equal(normalizeOmm({ ...base, ECCENTRICITY: 1.5 }), null);
  assert.equal(normalizeOmm({ ...base, MEAN_MOTION: -1 }), null);
});
test("snapshot deduplicates overlapping groups and rejects the separately sampled ISS", () => {
  assert.equal(snapshot.items.length, 2);
  assert.deepEqual(snapshot.groups, ["stations", "visual"]);
  const withIss = makeOrbitalSnapshot([
    { key: "stations", items: [base, { ...base, NORAD_CAT_ID: 25544 }] }
  ], new Date(when).toISOString());
  assert.equal(withIss.items.length, 1);
});
test("snapshot fails closed on empty or stale provider groups", () => {
  assert.throws(() => makeOrbitalSnapshot([{ key: "stations", items: [] }], new Date(when).toISOString()));
  assert.throws(() => makeOrbitalSnapshot([{ key: "visual", items: [{ ...base, EPOCH: "2021-01-01T00:00:00" }] }], new Date(when).toISOString()));
});
test("snapshot with no published data or older than 12h is rejected", () => {
  assert.throws(() => validateOrbitalSnapshot({ version: 1, source: "CelesTrak GP OMM", fetchedAt: null, items: [] }, when));
  assert.throws(() => validateOrbitalSnapshot(snapshot, when + 13 * 60 * 60 * 1000), /stale/);
});
test("SGP4 calculates finite map positions with provenance and prediction labels", () => {
  const positions = propagateOrbitalSnapshot(snapshot, when);
  assert.equal(positions.length, 2);
  for (const p of positions) {
    assert.equal(p.type, "orbit");
    assert.ok(Number.isFinite(p.lat) && Math.abs(p.lat) <= 90);
    assert.ok(Number.isFinite(p.lon) && Math.abs(p.lon) <= 180);
    assert.equal(p.confidence, "approximate");
    assert.match(p.title, /predicted/);
    assert.match(p.facts.dataKind, /not direct observation/);
  }
});
