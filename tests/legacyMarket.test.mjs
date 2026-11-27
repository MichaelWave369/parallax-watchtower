import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMarketSignals, MARKET_MAX_AGE_MS, MARKET_FUTURE_SKEW_MS } from "../lib/legacyMarket.mjs";
const now = Date.parse("2026-11-27T00:00:00Z");
const recent = Math.floor((now - 60000) / 1000);
const valid = { usd: 95000.25, usd_24h_change: -1.25, last_updated_at: recent };

test("market snapshots keep provider prices and actual update times with public receipts", () => {
  const records = normalizeMarketSignals({ bitcoin: valid, ethereum: { ...valid, usd: 3100 }, solana: { ...valid, usd: 190.5 } }, now);
  assert.equal(records.length, 3);
  assert.deepEqual(records.map(row => row.id), ["coingecko-bitcoin", "coingecko-ethereum", "coingecko-solana"]);
  assert.equal(records[0].facts.priceUsd, 95000.25);
  assert.equal(records[0].facts.change24hPct, -1.25);
  assert.equal(records[0].timestamp, "2026-11-26T23:59:00.000Z");
  assert.equal(records[0].confidence, "reported");
  for (const row of records) {
    assert.equal(new URL(row.sourceUrl).protocol, "https:");
    assert.equal(row.privacyClass, "public");
    assert.equal(row.lat, undefined);
    assert.match(row.confidenceNotes, /over one hour old are withheld/);
  }
  assert.deepEqual(normalizeMarketSignals({ bitcoin: valid }, new Date(now).toISOString()), [records[0]]);
});

test("missing or invalid actual prices are omitted without zero-valued fallback records", () => {
  for (const usd of [undefined, null, "95000", 0, -1, NaN, Infinity, true]) {
    assert.deepEqual(normalizeMarketSignals({ bitcoin: { ...valid, usd } }, now), []);
  }
  assert.deepEqual(normalizeMarketSignals({}, now), []);
  assert.deepEqual(normalizeMarketSignals(null, now), []);
  assert.deepEqual(normalizeMarketSignals([], now), []);
  assert.deepEqual(normalizeMarketSignals({ unexpectedCoin: valid }, now), []);
});

test("missing, malformed, stale or far-future provider times cannot become current observations", () => {
  for (const last_updated_at of [undefined, null, "1795737540", 0, -1, 1.5, NaN, Infinity,
    Math.floor((now - MARKET_MAX_AGE_MS - 1000) / 1000), Math.floor((now + MARKET_FUTURE_SKEW_MS + 1000) / 1000)]) {
    assert.deepEqual(normalizeMarketSignals({ bitcoin: { ...valid, last_updated_at } }, now), []);
  }
  assert.equal(normalizeMarketSignals({ bitcoin: { ...valid, last_updated_at: (now - MARKET_MAX_AGE_MS) / 1000 } }, now).length, 1);
  assert.equal(normalizeMarketSignals({ bitcoin: { ...valid, last_updated_at: (now + MARKET_FUTURE_SKEW_MS) / 1000 } }, now).length, 1);
  assert.throws(() => normalizeMarketSignals({ bitcoin: valid }, "not-a-time"), /valid market retrieval time/);
});

test("unavailable change stays unknown while actual zero change remains valid", () => {
  for (const usd_24h_change of [undefined, null, "0", NaN, Infinity, false]) {
    const [row] = normalizeMarketSignals({ bitcoin: { ...valid, usd_24h_change } }, now);
    assert.equal(row.summary, "24h change unavailable");
    assert.equal("change24hPct" in row.facts, false);
  }
  const [zero] = normalizeMarketSignals({ bitcoin: { ...valid, usd_24h_change: 0 } }, now);
  assert.equal(zero.summary, "+0.00% over 24h");
  assert.equal(zero.facts.change24hPct, 0);
});

test("one malformed coin does not discard valid peers or forward arbitrary metadata", () => {
  const [row] = normalizeMarketSignals({ bitcoin: { ...valid, secret: "private", lat: 39.9 }, ethereum: { ...valid, usd: null } }, now);
  assert.ok(row);
  assert.equal(row.facts.secret, undefined);
  assert.equal(row.lat, undefined);
  assert.equal(normalizeMarketSignals({ bitcoin: valid, ethereum: {} }, now).length, 1);
});
