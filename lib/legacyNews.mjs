// Legacy GDELT transport adapter. Index timestamps are not publication/occurrence times.
// No place is inferred from a publisher's country, URL, or generic hazard keyword.
export const GDELT_DOC_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
export const LEGACY_NEWS_QUERY = '"Northern California" OR "Mt Shasta" OR Redding OR "Tehama County" OR Sacramento OR earthquake OR wildfire OR infrastructure';
const short = (raw, limit) => typeof raw === "string" ? raw.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit) : "";

function disallowedHost(host) {
  const hostname = host.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || !hostname.includes(".")) return true;
  // News receipts and this public proxy do not need IP literal destinations.
  return /^\[/.test(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

export function safeNewsReceipt(raw) {
  if (typeof raw !== "string" || raw.length > 2048 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || disallowedHost(url.hostname) || (url.port && url.port !== "443")) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export function parseGdeltTimestamp(raw) {
  if (typeof raw !== "string" || raw.length > 80) return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/.exec(raw);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) && new Date(ms).toISOString() === iso ? iso : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  const day = raw.slice(0, 10);
  const calendar = Date.parse(day + "T00:00:00Z");
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== day) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export function buildGdeltProxyUrl(raw, origin) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const trimmed = raw.trim();
  if (trimmed.length > 2000 || /[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error("News proxy must be a valid public HTTPS URL or a same-origin path.");
  let url;
  try { url = new URL(trimmed, origin); } catch { throw new Error("News proxy must be a valid public HTTPS URL or a same-origin path."); }
  const sameOriginPath = /^\/(?!\/)/.test(trimmed) && url.origin === new URL(origin).origin && !url.username && !url.password;
  if (!sameOriginPath && !safeNewsReceipt(url.toString())) throw new Error("News proxy must be a valid public HTTPS URL or a same-origin path.");
  url.hash = "";
  url.searchParams.set("query", LEGACY_NEWS_QUERY);
  url.searchParams.set("maxrecords", "20");
  return url.toString();
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

export function normalizeGdeltArticle(article, mode = "direct", nowMs = Date.now()) {
  if (!article || typeof article !== "object" || !["direct", "proxy"].includes(mode)) return null;
  const sourceUrl = safeNewsReceipt(article.url);
  const title = short(article.title, 300);
  const timestamp = parseGdeltTimestamp(article.seendate);
  if (!sourceUrl || !title || !timestamp || Date.parse(timestamp) > nowMs + 300000) return null;
  const domain = new URL(sourceUrl).hostname;
  return {
    id: "gdelt-" + stableHash(sourceUrl),
    type: "news", title,
    summary: short(article.sourceCommonName, 180) || domain,
    source: mode === "proxy" ? "Proxy GDELT News Adapter" : "GDELT News Adapter",
    sourceUrl, timestamp,
    confidence: "reported",
    confidenceNotes: "Publisher metadata via GDELT. Time is GDELT first-seen/index time, not confirmed publication or event occurrence. Geography is unknown.",
    privacyClass: "public",
    facts: {
      sourceMode: mode, domain,
      sourceCommonName: short(article.sourceCommonName, 180),
      language: short(article.language, 80), sourceCountry: short(article.sourceCountry, 80),
      seendate: timestamp, timeKind: "gdelt-first-seen-not-publication-or-occurrence"
    }
  };
}

export function normalizeGdeltArticles(articles, mode = "direct", nowMs = Date.now()) {
  if (!Array.isArray(articles)) throw new Error("GDELT response is missing the article list.");
  const seen = new Set();
  return articles.slice(0, 50).flatMap((article) => {
    const record = normalizeGdeltArticle(article, mode, nowMs);
    if (!record || seen.has(record.sourceUrl)) return [];
    seen.add(record.sourceUrl);
    return [record];
  });
}
