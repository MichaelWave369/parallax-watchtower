// Public, metadata-only news interchange. All imported strings are untrusted text.
export const NEWS_SCHEMA = 'phi.watchtower.news.v1';
export const NEWS_MAX_RECORDS = 600;
export const NEWS_FRESH_MS = 36 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const TOPICS = /^[a-z][a-z0-9_-]{0,47}$/;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/;
export function newsNow(value = Date.now()) {
  const n = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(n) ? n : Date.now();
}
export function newsText(value, max = 280) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function newsHash(value) {
  // Deterministic identifier only; not a cryptographic integrity or truth claim.
  let hash = 2166136261;
  for (const ch of String(value)) { hash ^= ch.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
export function canonicalizeNewsUrl(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 2048 || /[\u0000-\u0020\u007f]/.test(raw)) return null;
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
        !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) ||
        /^\d[\d.]*$/.test(host) || host.includes(':') || host.endsWith('.localhost')) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.toString();
  } catch { return null; }
}
export function newsTimestamp(raw, nowMs, nullable = true) {
  if (nullable && (raw === null || raw === undefined || raw === '')) return null;
  if (typeof raw !== 'string' || raw.length > 48) return undefined;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/.exec(raw);
  if (!parts) return undefined;
  const [,y,m,d,h,minute,sec,zone] = parts;
  const day = new Date(Date.UTC(Number(y), Number(m)-1, Number(d)));
  if (day.getUTCFullYear() !== Number(y) || day.getUTCMonth()+1 !== Number(m) || day.getUTCDate() !== Number(d) ||
      Number(h)>23 || Number(minute)>59 || Number(sec)>59 || (zone!=='Z' && (Number(zone.slice(1,3))>23 || Number(zone.slice(-2))>59))) return undefined;
  const n = Date.parse(raw);
  if (!Number.isFinite(n) || n < Date.UTC(1970, 0, 1) || n > nowMs + FUTURE_SKEW_MS) return undefined;
  return new Date(n).toISOString();
}
export function normalizeNewsRecord(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.demo === true || input.privacyClass !== 'public') return null;
  const nowMs = newsNow(now);
  const url = canonicalizeNewsUrl(input.url ?? input.canonicalUrl);
  const title = newsText(input.title, 280);
  const sourceId = typeof input.sourceId === 'string' && ID.test(input.sourceId) ? input.sourceId : '';
  const publisher = newsText(input.publisher, 120);
  const originGroup = newsText(input.originGroup, 120);
  const retrievedAt = newsTimestamp(input.retrievedAt, nowMs, false);
  const publishedAt = newsTimestamp(input.publishedAt, nowMs);
  const eventAt = newsTimestamp(input.eventAt, nowMs);
  const modifiedAt = newsTimestamp(input.modifiedAt, nowMs);
  if (!url || !title || !sourceId || !publisher || !originGroup || !retrievedAt ||
      publishedAt === undefined || eventAt === undefined || modifiedAt === undefined) return null;
  const kind = ['article','official_statement','public_data','research'].includes(input.kind) ? input.kind : 'article';
  const evidenceType = ['official_statement','primary_documentation','independent_reporting','secondary_reporting','uncorroborated_claim'].includes(input.evidenceType) ? input.evidenceType : 'uncorroborated_claim';
  const precision = ['global','country','region','point'].includes(input.region?.precision) ? input.region.precision : 'global';
  const region = {
    code: typeof input.region?.code === 'string' && /^[a-zA-Z0-9_-]{1,24}$/.test(input.region.code) ? input.region.code : 'GLOBAL',
    label: newsText(input.region?.label, 120) || 'Location not specified',
    precision
  };
  // This metadata contract deliberately does not carry coordinates or infer story location.
  const fingerprint = newsHash(title.toLocaleLowerCase('en').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim());
  const id = typeof input.id === 'string' && ID.test(input.id) ? input.id : `${sourceId}-${newsHash(url)}`;
  return { id, sourceId, publisher, originGroup, title, url, canonicalUrl: url,
    summary: newsText(input.summary, 360),
    language: typeof input.language === 'string' && /^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(input.language) ? input.language : 'und',
    topics: Array.isArray(input.topics) ? [...new Set(input.topics.filter(x => typeof x === 'string' && TOPICS.test(x)))].slice(0,12) : [],
    region, publishedAt, eventAt, modifiedAt, retrievedAt, kind, evidenceType, fingerprint, privacyClass:'public', demo:false };
}
export function validateNewsSnapshot(input, now = Date.now(), {checkCounts = true} = {}) {
  if (!input || input.schema !== NEWS_SCHEMA || !Array.isArray(input.sources) || input.sources.length > 40 ||
      !Array.isArray(input.records) || input.records.length > NEWS_MAX_RECORDS) return null;
  const nowMs = newsNow(now), generatedAt = newsTimestamp(input.generatedAt, nowMs, false);
  if (!generatedAt) return null;
  const sourceIds = new Set();
  const sources = [];
  for (const row of input.sources) {
    if (!row || typeof row.id !== 'string' || !ID.test(row.id) || sourceIds.has(row.id) ||
      !['ok','error','unavailable'].includes(row.status)) return null;
    const lastSuccessAt = newsTimestamp(row.lastSuccessAt, nowMs);
    const lastFailureAt = newsTimestamp(row.lastFailureAt, nowMs);
    const attemptedAt = newsTimestamp(row.attemptedAt, nowMs);
    const nextAttemptAt = row.nextAttemptAt == null ? null : newsTimestamp(row.nextAttemptAt, nowMs+7*86400000, false);
    if (lastSuccessAt === undefined || lastFailureAt === undefined || attemptedAt === undefined || nextAttemptAt === undefined ||
      !Number.isInteger(row.recordCount) || row.recordCount < 0 || row.recordCount > NEWS_MAX_RECORDS) return null;
    sourceIds.add(row.id);
    sources.push({ id:row.id, status:row.status, lastSuccessAt, lastFailureAt, attemptedAt, recordCount:row.recordCount,
      message:newsText(row.message,240), consecutiveFailures:Number.isInteger(row.consecutiveFailures)?Math.min(Math.max(row.consecutiveFailures,0),20):0, nextAttemptAt });
  }
  const records = [], seen = new Set(), ids = new Map();
  for (const raw of input.records) {
    const r = normalizeNewsRecord(raw, nowMs);
    if (!r || !sourceIds.has(r.sourceId) || Date.parse(r.retrievedAt) > Date.parse(generatedAt) + FUTURE_SKEW_MS) return null;
    const key = r.sourceId + '\n' + r.canonicalUrl;
    const priorKey = ids.get(r.id);
    if (priorKey && priorKey !== key) return null;
    if (seen.has(key)) continue;
    ids.set(r.id,key); seen.add(key); records.push(r);
  }
  if (checkCounts && sources.some(source => source.recordCount !== records.filter(record => record.sourceId === source.id).length)) return null;
  return {schema:NEWS_SCHEMA, generatedAt, sources, records};
}
export function validateNewsHealth(input, now = Date.now()) {
  if (!input || input.schema !== 'phi.watchtower.news-health.v1') return null;
  const result = validateNewsSnapshot({...input,schema:NEWS_SCHEMA,records:[]},now,{checkCounts:false});
  return result ? {schema:'phi.watchtower.news-health.v1',generatedAt:result.generatedAt,sources:result.sources} : null;
}
