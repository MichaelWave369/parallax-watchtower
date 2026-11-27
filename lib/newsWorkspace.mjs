import { normalizeNewsRecord, canonicalizeNewsUrl, newsText } from './newsContract.mjs';

export const NEWS_PREFERENCES_KEY = 'watchtower:news-workspace:v1';
export const NEWS_ARCHIVE_SCHEMA = 'phi.watchtower.news-archive.v1';
export const NEWS_ARCHIVE_LIMIT = 2000;
export const NEWS_ARCHIVE_BYTES = 3_000_000;
export const NEWS_DESKS = ['global', 'affairs', 'science', 'hazards', 'policy', 'watchlist', 'sources', 'briefing', 'research'];
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,159}$/.test(value);
const ids = value => Array.isArray(value) ? [...new Set(value.filter(safeId))].slice(0, 150) : [];

export function normalizeNewsPreferences(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const watchlist = Array.isArray(r.watchlist) ? r.watchlist.slice(0, 30).flatMap(row => {
    const query = newsText(row?.query, 120);
    return query && safeId(row?.id) ? [{ id: row.id, query }] : [];
  }) : [];
  const savedViews = Array.isArray(r.savedViews) ? r.savedViews.slice(0, 18).flatMap(row => {
    const name = newsText(row?.name, 80);
    return name && safeId(row?.id) ? [{ id: row.id, name, query: newsText(row.query, 120), topic: newsText(row.topic, 48), region: newsText(row.region, 24),
      desk: NEWS_DESKS.includes(row.desk) ? row.desk : 'global',
      timeWindow: ['24', '168', 'all'].includes(row.timeWindow) ? row.timeWindow : '168', compact: row.compact === true,
      includeObservations: row.includeObservations === true }] : [];
  }) : [];
  const notes = Array.isArray(r.notes) ? r.notes.slice(-90).flatMap(row => {
    const text = newsText(row?.text, 1200);
    const kind = ['note', 'hypothesis', 'counterevidence', 'disputed', 'correction'].includes(row?.kind) ? row.kind : 'note';
    const stamp = Date.parse(row?.createdAt);
    return text && safeId(row?.id) && safeId(row.recordId) && Number.isFinite(stamp) ? [{
      id: row.id, recordId: row.recordId, kind, text,
      referenceUrl: canonicalizeNewsUrl(row.referenceUrl), createdAt: new Date(stamp).toISOString()
    }] : [];
  }) : [];
  return {
    schema: 'phi.watchtower.workspace.v1',
    theme: r.theme === 'light' ? 'light' : 'dark',
    desk: NEWS_DESKS.includes(r.desk) ? r.desk : 'global',
    query: newsText(r.query, 120), topic: newsText(r.topic, 48), region: newsText(r.region, 24),
    timeWindow: ['24', '168', 'all'].includes(r.timeWindow) ? r.timeWindow : '168',
    compact: r.compact === true, includeObservations: r.includeObservations === true,
    retentionDays: [7, 30, 90].includes(r.retentionDays) ? r.retentionDays : 30,
    watchlist, savedViews, pins: ids(r.pins), separateIds: ids(r.separateIds), notes
  };
}

export function loadNewsPreferences(storage) {
  try { return normalizeNewsPreferences(JSON.parse(storage.getItem(NEWS_PREFERENCES_KEY) || '{}')); }
  catch { return normalizeNewsPreferences({}); }
}
export function saveNewsPreferences(storage, value) {
  try { storage.setItem(NEWS_PREFERENCES_KEY, JSON.stringify(normalizeNewsPreferences(value))); return true; }
  catch { return false; }
}

export function mergeNewsArchive(previous, incoming, { now = Date.now(), retentionDays = 30 } = {}) {
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(nowMs)) return [];
  const days = [7, 30, 90].includes(retentionDays) ? retentionDays : 30;
  const rows = new Map(), identities = new Map();
  for (const raw of [...(Array.isArray(previous) ? previous : []), ...(Array.isArray(incoming) ? incoming : [])].slice(-6000)) {
    const record = normalizeNewsRecord(raw, nowMs);
    if (!record || Date.parse(record.retrievedAt) < nowMs - days * 86400000) continue;
    const identity = identities.get(record.id);
    if (identity && identity !== record.canonicalUrl) continue;
    identities.set(record.id, record.canonicalUrl);
    const key = record.sourceId + ':' + record.canonicalUrl;
    const old = rows.get(key);
    if (!old || record.retrievedAt >= old.retrievedAt) rows.set(key, record);
  }
  return [...rows.values()].sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt) || a.id.localeCompare(b.id)).slice(0, NEWS_ARCHIVE_LIMIT);
}

export function makeNewsArchive(records, now = new Date().toISOString()) {
  const generatedAt = new Date(now).toISOString();
  const candidates = mergeNewsArchive([], records, { now: generatedAt, retentionDays: 90 });
  const accepted = [];
  // Reserve envelope/formatting space, and count UTF-8 bytes rather than characters.
  // Export uses compact JSON so a file this app emits is always importable here.
  let bytes = 1000;
  for (const record of candidates) {
    const size = new TextEncoder().encode(JSON.stringify(record)).byteLength + 1;
    if (bytes + size > NEWS_ARCHIVE_BYTES) break;
    bytes += size; accepted.push(record);
  }
  return {
    schema: NEWS_ARCHIVE_SCHEMA, generatedAt,
    scope: { publicMetadataOnly: true, privateNotesIncluded: false, watchlistsIncluded: false, browserLocationIncluded: false },
    count: accepted.length, omittedCount: candidates.length - accepted.length,
    records: accepted
  };
}

export function readNewsArchiveImport(text, now = Date.now()) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > NEWS_ARCHIVE_BYTES) throw new Error('Choose a public archive smaller than 3 MB.');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (value?.schema !== NEWS_ARCHIVE_SCHEMA || !Array.isArray(value.records) || value.records.length > NEWS_ARCHIVE_LIMIT) throw new Error('Unsupported public archive schema or record count.');
  const identities = new Map();
  const rows = value.records.map(raw => {
    const valid = normalizeNewsRecord(raw, now);
    if (!valid) throw new Error('The archive contains an unsafe or malformed record. Nothing was imported.');
    // A user-selected file is not authenticated provider evidence. Preserve the public
    // receipt and its dates while making its unreviewed import origin explicit.
    const imported = normalizeNewsRecord({ ...valid, id: 'manual-import-' + valid.fingerprint + '-' + valid.id.slice(-48),
      sourceId: 'manual', publisher: 'Imported · ' + valid.publisher, originGroup: new URL(valid.url).hostname,
      evidenceType: 'uncorroborated_claim' }, now);
    const previousUrl = identities.get(imported.id);
    if (previousUrl && previousUrl !== imported.canonicalUrl) throw new Error('The archive contains conflicting record identities. Nothing was imported.');
    identities.set(imported.id, imported.canonicalUrl);
    return imported;
  });
  return mergeNewsArchive([], rows, { now, retentionDays: 90 });
}

export function matchesNewsQuery(record, query) {
  const terms = newsText(query, 120).toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const text = [record.title, record.summary, record.publisher, ...(record.topics || []), record.region?.label].join(' ').toLocaleLowerCase();
  return terms.every(term => text.includes(term));
}

// One bounded, local-only object store. Failure or private-browsing restrictions
// degrade to an in-memory session rather than blocking the newsroom.
function localDatabase(factory) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(new Error('Browser storage is unavailable.'));
    let settled = false;
    const request = factory.open('watchtower-news-v1', 1);
    const timer = setTimeout(() => { settled = true; reject(new Error('Browser storage timed out.')); }, 5000);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state'); };
    request.onerror = () => { settled = true; clearTimeout(timer); reject(new Error('Browser storage could not open.')); };
    request.onblocked = () => { settled = true; clearTimeout(timer); reject(new Error('Close another Watchtower tab to update local storage.')); };
    request.onsuccess = () => { clearTimeout(timer); if (settled) request.result.close(); else resolve(request.result); };
  });
}

export async function readNewsStorage(factory = globalThis.indexedDB) {
  const db = await localDatabase(factory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly'), store = tx.objectStore('state');
    const archive = store.get('archive'), snapshot = store.get('snapshot');
    tx.oncomplete = () => { db.close(); resolve({ archive: archive.result || [], snapshot: snapshot.result || null }); };
    tx.onerror = () => { db.close(); reject(new Error('Could not read local news history.')); };
    tx.onabort = tx.onerror;
  });
}
export async function writeNewsStorage(archive, snapshot, factory = globalThis.indexedDB) {
  const db = await localDatabase(factory);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state');
    store.put(archive.slice(0, NEWS_ARCHIVE_LIMIT), 'archive');
    if (snapshot) store.put(snapshot, 'snapshot'); else store.delete('snapshot');
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(new Error('News history could not be saved on this device.')); };
    tx.onabort = tx.onerror;
  });
}
