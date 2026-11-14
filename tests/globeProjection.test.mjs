import test from "node:test";
import assert from "node:assert/strict";
import { orthographicPoint } from "../lib/globeProjection.mjs";

test("globe projection centers a selected location", () => {
  const p = orthographicPoint(39.9, -122.2, 39.9, -122.2);
  assert.ok(p && Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9);
});
test("globe hides coordinates on the far hemisphere", () => {
  assert.equal(orthographicPoint(0, 180, 0, 0), null);
});
test("globe places the horizon at unit radius and rejects malformed coordinates", () => {
  const p = orthographicPoint(0, 90, 0, 0);
  assert.ok(p && Math.abs(p.x - 1) < 1e-9);
  assert.equal(orthographicPoint(91, 0, 0, 0), null);
  assert.equal(orthographicPoint(NaN, 0, 0, 0), null);
});
