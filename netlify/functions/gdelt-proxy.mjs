// Optional public-only GDELT adapter. User input can change query text, never the host.
import { GDELT_DOC_ENDPOINT, LEGACY_NEWS_QUERY, normalizeGdeltArticle } from "../../lib/legacyNews.mjs";
const MAX_QUERY_LENGTH = 600;
const MAX_BYTES = 1000000;
const TIMEOUT_MS = 12000;

function reply(statusCode, value, cache = false) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "x-content-type-options": "nosniff",
      "cache-control": cache ? "public, max-age=300" : "no-store"
    },
    body: JSON.stringify(value)
  };
}

async function readBounded(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw new Error("oversized");
  if (!response.body?.getReader) throw new Error("missing-body");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("oversized");
      chunks.push(value);
    }
  } catch (error) {
    // Cleanup is best-effort; an upstream cancel callback may never settle.
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch {}
    throw error;
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export function createGdeltHandler(fetchImpl = fetch, { timeoutMs = TIMEOUT_MS, maxBytes = MAX_BYTES } = {}) {
  return async function handle(event = {}) {
    const method = event.httpMethod ?? "GET";
    if (method === "OPTIONS") return reply(204, null);
    if (method !== "GET") return reply(405, { error: "Only GET requests are supported." });
    const params = event.queryStringParameters ?? {};
    const query = params.query ?? LEGACY_NEWS_QUERY;
    const rawCount = params.maxrecords ?? "20";
    if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(query) ||
      typeof rawCount !== "string" || !/^\d{1,2}$/.test(rawCount) || Number(rawCount) < 1 || Number(rawCount) > 50) {
      return reply(400, { error: "Use a query of 1–600 characters and maxrecords between 1 and 50." });
    }
    const url = new URL(GDELT_DOC_ENDPOINT);
    url.searchParams.set("query", query.trim());
    url.searchParams.set("mode", "ArtList");
    url.searchParams.set("format", "json");
    url.searchParams.set("maxrecords", rawCount);
    url.searchParams.set("sort", "HybridRel");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        signal: controller.signal, redirect: "manual",
        headers: { accept: "application/json", "user-agent": "WatchtowerLive/2.0 (public metadata cache)" }
      });
      if (response.status !== 200) throw new Error("upstream-status");
      if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get("content-type") ?? "")) throw new Error("upstream-type");
      const payload = JSON.parse(await readBounded(response, maxBytes));
      if (!Array.isArray(payload?.articles)) throw new Error("upstream-shape");
      const seen = new Set();
      const articles = payload.articles.slice(0, Number(rawCount)).flatMap((raw) => {
        const normalized = normalizeGdeltArticle(raw, "proxy");
        if (!normalized || seen.has(normalized.sourceUrl)) return [];
        seen.add(normalized.sourceUrl);
        return [{ title: normalized.title, url: normalized.sourceUrl, seendate: normalized.timestamp,
          domain: normalized.facts.domain, sourceCommonName: normalized.facts.sourceCommonName,
          language: normalized.facts.language, sourceCountry: normalized.facts.sourceCountry }];
      });
      return reply(200, { articles }, true);
    } catch {
      return reply(502, { error: "GDELT is unavailable or returned an invalid response. No news records were generated." });
    } finally {
      clearTimeout(timer);
      controller.abort();
      // HTTP/type/declared-size rejection may precede reader acquisition.
      // Never let an unread body keep downloading or make cancellation block.
      try { if (response?.body && !response.body.locked) Promise.resolve(response.body.cancel()).catch(() => {}); } catch {}
    }
  };
}

export const handler = createGdeltHandler();
