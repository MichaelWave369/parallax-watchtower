import test from "node:test";
import assert from "node:assert/strict";
import { MAX_VECTOR_FEATURES, OPENFREE_MAP_STYLE, toMapFeatures } from "../lib/vectorMap.mjs";
const mk = (id, type="earthquake") => ({
  id, type, lat: 39.9277, lon: -122.1792, title: "Signal",
  source: "USGS Earthquake Feed", privacyClass: "public", magnitude: 3
});
test("vector map uses a non-OSMF, no-key style URL", () => {
  assert.match(OPENFREE_MAP_STYLE, /^https:\/\/tiles\.openfreemap\.org\/styles\//);
  assert.ok(!OPENFREE_MAP_STYLE.includes("tile.openstreetmap.org"));
});
test("all source-receipted public records become point features in lon-lat order", () => {
  const data = toMapFeatures([mk("one")], "one");
  assert.deepEqual(data.features[0].geometry.coordinates, [-122.1792, 39.9277]);
  assert.equal(data.features[0].properties.selected, 1);
});
test("fake/demo, private, invalid or unmapped records are never rendered", () => {
  const records = [
    mk("yes"), { ...mk("private"), privacyClass: "private_local" },
    { ...mk("fallback-news"), source: "Fallback News Adapter" },
    { ...mk("bad-lat"), lat: 93 }, { ...mk("bad-lon"), lon: Infinity },
    { ...mk("nomap"), lat: undefined }, { ...mk("unmapped-kp", "space_weather"), type: "space_weather" },
    mk("yes")
  ];
  assert.deepEqual(toMapFeatures(records).features.map(f => f.properties.id), ["yes"]);
});
test("orbital predictions, ISS samples, curated wildfires and news regions preserve their meaning", () => {
  const cases = ["orbit", "satellite", "wildfire", "news"].map((type,i)=>mk("p"+i,type));
  const kinds=toMapFeatures(cases).features.map(f=>f.properties.coordinateKind);
  assert.deepEqual(kinds, ["SGP4-predicted-subpoint","sampled-subpoint","catalog-event-point-not-perimeter","approximate-news-region"]);
});
test("very large event feeds are bounded without deleting original signal records", () => {
  const data = toMapFeatures(Array.from({length:MAX_VECTOR_FEATURES+90},(_,i)=>mk("id"+i)));
  assert.equal(data.features.length,MAX_VECTOR_FEATURES);
});
test("missing data has a safe empty result", () => {
  assert.deepEqual(toMapFeatures(null),{type:"FeatureCollection",features:[]});
});
