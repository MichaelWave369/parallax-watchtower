// Provider snapshots only. Missing prices or observation times never become zero/now.
export const MARKET_MAX_AGE_MS = 60 * 60 * 1000;
export const MARKET_FUTURE_SKEW_MS = 5 * 60 * 1000;
const COINS = Object.freeze([
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" }
]);

export function normalizeMarketSignals(payload, now = Date.now()) {
  const nowMs = typeof now === "number" ? now : typeof now === "string" ? Date.parse(now) : NaN;
  if (!Number.isFinite(nowMs)) throw new TypeError("A valid market retrieval time is required.");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return COINS.flatMap(({ id, symbol }) => {
    const row = payload[id];
    const price = row?.usd;
    const updatedSeconds = row?.last_updated_at;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
        typeof updatedSeconds !== "number" || !Number.isSafeInteger(updatedSeconds) || updatedSeconds <= 0) return [];
    const observedMs = updatedSeconds * 1000;
    if (!Number.isFinite(observedMs) || observedMs < nowMs - MARKET_MAX_AGE_MS || observedMs > nowMs + MARKET_FUTURE_SKEW_MS) return [];
    const change = typeof row.usd_24h_change === "number" && Number.isFinite(row.usd_24h_change) ? row.usd_24h_change : null;
    return [{
      id: `coingecko-${id}`,
      type: "market",
      title: `${symbol} market pulse: $${price.toLocaleString("en-US", { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}`,
      summary: change === null ? "24h change unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% over 24h`,
      source: "CoinGecko Market Adapter",
      sourceUrl: `https://www.coingecko.com/en/coins/${id}`,
      timestamp: new Date(observedMs).toISOString(),
      confidence: "reported",
      confidenceNotes: "Public CoinGecko snapshot with its provider update timestamp; snapshots over one hour old are withheld. Retrieval does not independently verify a market price.",
      privacyClass: "public",
      facts: { symbol, priceUsd: price, ...(change === null ? {} : { change24hPct: change }), provider: "CoinGecko" }
    }];
  });
}
