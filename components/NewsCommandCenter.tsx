import { useEffect, useMemo, useRef, useState } from 'react';
import { NEWS_SOURCES } from '../lib/newsSources.mjs';
import { mergeNewsRevisions, revisionsForRecord } from '../lib/newsRevisions.mjs';
import { buildCoverage } from '../lib/newsCoverage.mjs';
import { normalizeNewsRecord, validateNewsSnapshot, validateNewsHealth } from '../lib/newsContract.mjs';
import { clusterEvents, deduplicateNews, makeNewsBriefing, briefingToMarkdown, newsRecordFreshness } from '../lib/newsIntelligence.mjs';
import { loadNewsPreferences, normalizeNewsPreferences, saveNewsPreferences, mergeNewsArchive, makeNewsArchive, readNewsArchiveImport, matchesNewsQuery, readNewsStorage, writeNewsStorage, NEWS_ARCHIVE_BYTES } from '../lib/newsWorkspace.mjs';
import { readBoundedJson } from '../lib/browserRequests.mjs';
import { GlobeCanvas } from './GlobeCanvas';
import './newsroom.css';

type NewsRecord = {
  id: string; sourceId: string; publisher: string; originGroup: string; title: string; url: string;
  canonicalUrl: string; summary: string; language: string; topics: string[];
  region: { code: string; label: string; precision: string };
  publishedAt: string | null; eventAt: string | null; modifiedAt: string | null; retrievedAt: string;
  kind: string; evidenceType: string; fingerprint: string; privacyClass: string; demo: boolean;
};
type SavedView = { id: string; name: string; query: string; topic: string; region: string; language: string; sourceId: string; desk: string; timeWindow: string; compact: boolean; includeObservations: boolean };
type ResearchNote = { id: string; recordId: string; kind: string; text: string; referenceUrl: string | null; createdAt: string };
type Preferences = {
  schema: string; theme: string; desk: string; query: string; topic: string; region: string; language: string; sourceId: string;
  timeWindow: string; compact: boolean; includeObservations: boolean; retentionDays: number; watchlist: { id: string; query: string }[];
  savedViews: SavedView[]; pins: string[]; separateIds: string[]; notes: ResearchNote[];
};
type Snapshot = { schema: string; generatedAt: string; sources: any[]; records: NewsRecord[] };
const DESKS = [
  ['global', '01', 'Global Command'], ['affairs', '02', 'World Affairs'], ['science', '03', 'Science & Technology'],
  ['hazards', '04', 'Natural Hazards'], ['policy', '05', 'Policy & Economics'], ['watchlist', '06', 'My Watchlist'],
  ['briefing', '07', 'Intelligence Brief'], ['research', '08', 'Research Room'], ['sources', '09', 'Source Observatory']
] as const;
const TOPIC_GROUPS: Record<string, string[]> = {
  affairs: ['world', 'world-affairs', 'humanitarian', 'human-rights', 'diplomacy', 'international'],
  science: ['science', 'technology', 'space', 'research', 'artificial-intelligence', 'ai'],
  hazards: ['earthquake', 'earthquakes', 'hazards', 'natural-hazards', 'environment', 'wildfire', 'weather'],
  policy: ['policy', 'government', 'economics', 'economy', 'finance', 'markets', 'monetary-policy', 'regulation']
};
const label = (value: string) => value.replaceAll('_', ' ').replaceAll('-', ' ');
function stamp(value: string | null | undefined) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isFinite(+date) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC' : 'Not supplied';
}
function download(value: string, name: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const clock = () => new Date().toISOString();

export function NewsCommandCenter({ onOpenAtlas }: { onOpenAtlas: () => void }) {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try { return loadNewsPreferences(window.localStorage) as Preferences; } catch { return normalizeNewsPreferences({}) as Preferences; }
  });
  const [archive, setArchive] = useState<NewsRecord[]>([]);
  const [revisions, setRevisions] = useState<NewsRecord[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [now, setNow] = useState(clock);
  const [loading, setLoading] = useState(true);
  const [networkNote, setNetworkNote] = useState('Reading the shared source snapshot…');
  const [storageNote, setStorageNote] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [inspector, setInspector] = useState<'evidence' | 'compare' | 'timeline'>('evidence');
  const [comparisonId, setComparisonId] = useState('');
  const [pageSize, setPageSize] = useState(30);
  const [noteText, setNoteText] = useState('');
  const [noteKind, setNoteKind] = useState('note');
  const [noteUrl, setNoteUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [importing, setImporting] = useState(false);
  const initialized = useRef(false);
  const refreshRef = useRef<null | (() => Promise<void>)>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const centerRef = useRef<HTMLElement>(null);
  const lastRefresh = useRef(0);
  const preferencesRef = useRef(prefs);
  preferencesRef.current = prefs;

  const update = (patch: Partial<Preferences>) => setPrefs(old => normalizeNewsPreferences({ ...old, ...patch }) as Preferences);
  useEffect(() => {
    document.documentElement.dataset.newsTheme = prefs.theme;
    let saved = false;
    try { saved = saveNewsPreferences(window.localStorage, prefs); } catch {}
    if (!saved) setStorageNote('Settings cannot be saved in this browser. This session still works.');
    return () => { delete document.documentElement.dataset.newsTheme; };
  }, [prefs]);

  useEffect(() => {
    const controller = new AbortController(); let disposed = false; let busy = false;
    async function refresh() {
      if (busy || Date.now() - lastRefresh.current < 60000) return;
      busy = true; lastRefresh.current = Date.now(); setLoading(true);
      const [news, status] = await Promise.allSettled([
        readBoundedJson(import.meta.env.BASE_URL + 'data/news.v1.json', { signal: controller.signal }),
        readBoundedJson(import.meta.env.BASE_URL + 'data/news-health.v1.json', { signal: controller.signal, maxBytes: 100000 })
      ]);
      if (disposed) return;
      const time = clock(); setNow(time);
      if (status.status === 'fulfilled') setHealth(validateNewsHealth(status.value, Date.parse(time)));
      if (news.status === 'fulfilled') {
        const good = validateNewsSnapshot(news.value, Date.parse(time)) as Snapshot | null;
        if (good) {
          setSnapshot(good);
          setRevisions(old => mergeNewsRevisions(old, good.records, { now: Date.parse(time), retentionDays: preferencesRef.current.retentionDays }) as NewsRecord[]);
          setArchive(old => mergeNewsArchive(old, good.records, { now: Date.parse(time), retentionDays: preferencesRef.current.retentionDays }));
          setNetworkNote('Shared snapshot loaded. Retrieval success does not verify an event.');
        } else setNetworkNote('The source snapshot failed validation. Showing previously stored public records, if available.');
      } else setNetworkNote('Source snapshot unavailable. Showing previously stored public records, if available.');
      setLoading(false); busy = false;
    }
    refreshRef.current = refresh;
    (async () => {
      try {
        const stored: any = await readNewsStorage();
        if (disposed) return;
        setArchive(mergeNewsArchive([], stored.archive, { retentionDays: prefs.retentionDays }));
        const cached = validateNewsSnapshot(stored.snapshot);
        setRevisions(mergeNewsRevisions(stored.revisions, cached?.records || [], { retentionDays: preferencesRef.current.retentionDays }) as NewsRecord[]);
        if (cached) setSnapshot(cached as Snapshot);
      } catch { if (!disposed) setStorageNote('Local history is unavailable. Records will remain in memory for this session.'); }
      if (!disposed) { initialized.current = true; await refresh(); }
    })();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300000);
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); refreshRef.current = null; lastRefresh.current = 0; };
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      writeNewsStorage(archive, snapshot, undefined, revisions).catch(() => { if (!cancelled) setStorageNote('Local history could not be saved. This session still works.'); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [archive, snapshot, revisions]);
  useEffect(() => { setArchive(old => mergeNewsArchive([], old, { retentionDays: prefs.retentionDays })); setRevisions(old => mergeNewsRevisions(old, [], { retentionDays: prefs.retentionDays }) as NewsRecord[]); }, [prefs.retentionDays]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(clock()), 60000);
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === '/') { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === 'Escape') { update({ query: '' }); searchRef.current?.blur(); }
    };
    document.addEventListener('keydown', handler);
    return () => { clearInterval(timer); document.removeEventListener('keydown', handler); };
  }, []);

  const dedup = useMemo(() => deduplicateNews(archive, { now: Date.parse(now) }), [archive, now]);
  const records = dedup.records as NewsRecord[];
  const sourceHealth = health && (!snapshot || health.generatedAt >= snapshot.generatedAt) ? health.sources : (snapshot?.sources || []);
  const coverage = buildCoverage(NEWS_SOURCES, snapshot?.records || [], sourceHealth, now);
  const healthy = sourceHealth.filter((s: any) => s.status === 'ok' && s.lastSuccessAt && Date.parse(now) - Date.parse(s.lastSuccessAt) <= 36 * 3600000).length;
  const snapshotStale = !snapshot || Date.parse(now) - Date.parse(snapshot.generatedAt) > 36 * 3600000;
  const topics = useMemo(() => [...new Set(records.flatMap(row => row.topics))].sort(), [records]);
  const regions = useMemo(() => [...new Map(records.map(row => [row.region.code, row.region.code === 'GLOBAL' ? 'Global / mixed or unspecified locations' : row.region.label])).entries()].sort(), [records]);
  const languages = useMemo(() => [...new Set(records.map(row => row.language))].sort(), [records]);
  const publisherOptions = useMemo(() => [...new Map(records.map(row => [row.sourceId, row.sourceId === 'manual' ? 'Local submissions' : row.publisher])).entries()].sort((a,b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])), [records]);
  const filtered = useMemo(() => records.filter(row => {
    if (prefs.desk === 'global' && !prefs.includeObservations && row.kind === 'public_data') return false;
    if (prefs.desk === 'research' && !prefs.pins.includes(row.id)) return false;
    if (prefs.desk === 'watchlist' && !prefs.watchlist.some(rule => matchesNewsQuery(row, rule.query))) return false;
    if (TOPIC_GROUPS[prefs.desk] && !row.topics.some(topic => TOPIC_GROUPS[prefs.desk].includes(topic))) return false;
    if (prefs.topic && !row.topics.includes(prefs.topic)) return false;
    if (prefs.region && row.region.code !== prefs.region) return false;
    if (prefs.language && row.language !== prefs.language) return false;
    if (prefs.sourceId && row.sourceId !== prefs.sourceId) return false;
    if (!matchesNewsQuery(row, prefs.query)) return false;
    const known = row.publishedAt || row.eventAt || row.modifiedAt;
    if (prefs.timeWindow !== 'all' && (!known || Date.parse(known) < Date.parse(now) - Number(prefs.timeWindow) * 3600000)) return false;
    return true;
  }).sort((a, b) => (b.publishedAt || b.eventAt || b.modifiedAt || '').localeCompare(a.publishedAt || a.eventAt || a.modifiedAt || '') || a.id.localeCompare(b.id)), [records, prefs, now]);
  const events = useMemo(() => clusterEvents(filtered, { separateIds: prefs.separateIds, now: Date.parse(now) }), [filtered, prefs.separateIds, now]);
  const selected = (filtered.find(row => row.id === selectedId) || filtered[0]) as NewsRecord | undefined;
  const selectedEvent: any = selected ? events.find((event: any) => event.articles.some((row: NewsRecord) => row.id === selected.id)) : null;
  const brief = useMemo(() => makeNewsBriefing(filtered, { now: Date.parse(now), windowHours: prefs.timeWindow === '24' ? 24 : 168, maxItems: 30 }), [filtered, now, prefs.timeWindow]);
  const observedRevisions = revisionsForRecord(revisions, selected) as NewsRecord[];
  const notes = selected ? prefs.notes.filter(note => note.recordId === selected.id) : [];
  const compareRows: NewsRecord[] = [...(selectedEvent?.articles || (selected ? [selected] : []))];
  const manualComparison = records.find(row => row.id === comparisonId && row.id !== selected?.id);
  if (manualComparison && !compareRows.some(row => row.id === manualComparison.id)) compareRows.push(manualComparison);
  const deskName = DESKS.find(desk => desk[0] === prefs.desk)?.[2] || 'Global Command';
  useEffect(() => setPageSize(30), [prefs.query, prefs.topic, prefs.region, prefs.language, prefs.sourceId, prefs.desk, prefs.timeWindow]);
  useEffect(() => { setNoteText(''); setNoteUrl(''); setNoteKind('note'); setComparisonId(''); }, [selected?.id]);

  function pin(row: NewsRecord) {
    update({ pins: prefs.pins.includes(row.id) ? prefs.pins.filter(id => id !== row.id) : [...prefs.pins, row.id] });
  }
  async function fullScreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await centerRef.current?.requestFullscreen(); }
    catch { setActionNote('Fullscreen is unavailable in this browser.'); }
  }
  function addWatch() {
    if (!prefs.query.trim()) { setActionNote('Enter a search before adding a watch.'); searchRef.current?.focus(); return; }
    if (prefs.watchlist.some(rule => rule.query === prefs.query)) { setActionNote('This watch already exists.'); return; }
    update({ watchlist: [...prefs.watchlist, { id: crypto.randomUUID(), query: prefs.query }] });
    setActionNote('Watch saved on this device. No browser notifications are sent.');
  }
  function addNote() {
    if (!selected || !noteText.trim()) return;
    update({ notes: [...prefs.notes, { id: crypto.randomUUID(), recordId: selected.id, kind: noteKind, text: noteText, referenceUrl: noteUrl || null, createdAt: clock() }] });
    setNoteText(''); setNoteUrl(''); setActionNote('Research annotation saved locally. It does not change source verification.');
  }
  function addManual(event: React.FormEvent) {
    event.preventDefault();
    const publishedMs = manualDate ? Date.parse(manualDate + 'Z') : null;
    if (manualDate && !Number.isFinite(publishedMs)) { setActionNote('Enter a valid UTC publication date or leave it blank.'); return; }
    const row = normalizeNewsRecord({ sourceId: 'manual', publisher: 'User-submitted source', originGroup: 'user-submitted',
      title: manualTitle, url: manualUrl, summary: 'Manually nominated public source. Not fetched or independently verified.',
      publishedAt: publishedMs === null ? null : new Date(publishedMs).toISOString(), eventAt: null, modifiedAt: null, retrievedAt: clock(),
      language: 'und', topics: ['research'], region: { code: 'GLOBAL', label: 'Location not specified', precision: 'global' },
      kind: 'article', evidenceType: 'uncorroborated_claim', privacyClass: 'public', demo: false });
    if (!row) { setActionNote('Use a public HTTPS receipt, a title, and an optional valid past publication date.'); return; }
    row.originGroup = new URL(row.url).hostname;
    setArchive(old => mergeNewsArchive(old, [row], { retentionDays: prefs.retentionDays }));
    update({ pins: [...prefs.pins, row.id], timeWindow: 'all', query: '', topic: '', region: '', language: '', sourceId: '' });
    setManualTitle(''); setManualUrl(''); setManualDate(''); setActionNote('Public source nominated for local review. No remote page was fetched.');
  }
  async function importArchive(file: File | undefined) {
    if (!file) return;
    if (file.size > NEWS_ARCHIVE_BYTES) { setActionNote('Choose a public archive smaller than 3 MB.'); return; }
    setImporting(true);
    try {
      const rows = readNewsArchiveImport(await file.text());
      setArchive(old => mergeNewsArchive(old, rows, { retentionDays: prefs.retentionDays }));
      setActionNote(`${rows.length} public records imported as unreviewed user submissions. Personal notes were not imported.`);
    } catch (error) { setActionNote(error instanceof Error ? error.message : 'Import failed.'); }
    finally { setImporting(false); }
  }
  function clearArchive() {
    setArchive([]); setRevisions([]); setSnapshot(null); setHealth(null); update({ pins: [], separateIds: [], notes: [] });
    setActionNote('Local news history and research annotations cleared. A future refresh can load the public snapshot again.');
  }

  return <section className={`newsroom ${prefs.compact ? 'newsroom-compact' : ''}`} aria-label="News command center" ref={centerRef}>
    <div className="nr-topline"><span><i className="nr-indicator" /> PUBLIC SOURCE DESK <span className="nr-version">/ ASCENSION 01</span></span><time dateTime={now}>{stamp(now)}</time></div>
    <div className="nr-toolbar">
      <div className="nr-search"><label htmlFor="news-search">Search public records</label><input id="news-search" ref={searchRef} type="search" placeholder="Search a topic, place, institution…" maxLength={120} value={prefs.query} onChange={event => update({ query: event.target.value })} /><kbd>/</kbd></div>
      <button className="nr-button" onClick={addWatch}>+ Watch search</button>
      <button className="nr-icon-button" aria-label="Toggle light theme" onClick={() => update({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>{prefs.theme === 'dark' ? '☀' : '☾'}</button>
      <button className="nr-icon-button" aria-label="Fullscreen command mode" onClick={fullScreen}>⛶</button>
    </div>
    <div className="nr-status" role="status"><span className={snapshotStale ? 'nr-warning' : 'nr-ok'}>{loading ? 'READING SNAPSHOT' : snapshotStale ? 'STALE / NO CURRENT SNAPSHOT' : 'CACHED PUBLIC SOURCES'}</span><span>{networkNote}</span><button disabled={loading} onClick={() => { void refreshRef.current?.(); setActionNote('Refreshes are limited to once per minute. Providers are collected centrally.'); }}>Refresh cache</button></div>
    {storageNote && <p className="nr-notice">{storageNote}</p>}
    {actionNote && <p className="nr-notice" role="status">{actionNote}</p>}
    <div className="nr-layout">
      <aside className="nr-sidebar" aria-label="News desks">
        <p className="nr-overline">WORKSPACES</p>
        <nav>{DESKS.map(([id, number, name]) => <button key={id} aria-current={prefs.desk === id ? 'page' : undefined} onClick={() => { update({ desk: id, topic: '', region: '', language: '', sourceId: '', query: '', timeWindow: id === 'briefing' && prefs.timeWindow === 'all' ? '168' : prefs.timeWindow }); setSelectedId(''); }}><span>{number}</span>{name}{id === 'research' && <small>{prefs.pins.length}</small>}</button>)}</nav>
        <div className="nr-side-section"><p className="nr-overline">SAVED VIEWS <span>{prefs.savedViews.length}/18</span></p><button className="nr-side-action" disabled={prefs.savedViews.length >= 18} onClick={() => { update({ savedViews: [...prefs.savedViews, { id: crypto.randomUUID(), name: prefs.query || deskName, query: prefs.query, topic: prefs.topic, region: prefs.region, language: prefs.language, sourceId: prefs.sourceId, desk: prefs.desk, timeWindow: prefs.timeWindow, compact: prefs.compact, includeObservations: prefs.includeObservations }] }); setActionNote('View saved on this device.'); }}>+ Save current filters</button>{prefs.savedViews.map(view => <div className="nr-saved" key={view.id}><button onClick={() => update({ desk: view.desk, query: view.query, topic: view.topic, region: view.region, language: view.language, sourceId: view.sourceId, timeWindow: view.timeWindow, compact: view.compact, includeObservations: view.includeObservations })}>{view.name}</button><button aria-label={`Remove saved view ${view.name}`} onClick={() => update({ savedViews: prefs.savedViews.filter(row => row.id !== view.id) })}>×</button></div>)}</div>
        <div className="nr-side-section"><p className="nr-overline">WATCHLIST <span>{prefs.watchlist.length}/30</span></p>{prefs.watchlist.length ? prefs.watchlist.map(rule => <div className="nr-saved" key={rule.id}><button onClick={() => update({ desk: 'global', query: rule.query, language: '', sourceId: '' })}>{rule.query}</button><button aria-label={`Remove watch ${rule.query}`} onClick={() => update({ watchlist: prefs.watchlist.filter(row => row.id !== rule.id) })}>×</button></div>) : <p className="nr-muted">Save a search to follow a topic locally.</p>}</div>
        <div className="nr-side-footer"><strong>TRUTH ABOVE SLOP.</strong><p>Receipts over hype.<br />Public sources. Local research.</p><button className="nr-side-action" onClick={onOpenAtlas}>Open interactive atlas ↗</button></div>
      </aside>
      <div className="nr-main">
        <header className="nr-desk-heading"><div><div className="nr-overline">PHI369 LABS / WORLD DESK</div><h2>{deskName}</h2><p>{prefs.desk === 'sources' ? 'Availability, permissions, provenance, and limits for every connected adapter.' : 'Understand the report. Inspect the source. Keep the uncertainty.'}</p></div><span className="nr-edition">EDITION 01<br /><strong>PUBLIC INTELLIGENCE</strong></span></header>
        <div className="nr-metrics"><div><span>PUBLIC RECORDS</span><strong>{records.length.toString().padStart(2, '0')}</strong><small>{dedup.duplicates.length} duplicates collapsed</small></div><div><span>REPORT GROUPS</span><strong>{events.length.toString().padStart(2, '0')}</strong><small>Heuristic · reviewable</small></div><div><span>SOURCE RETRIEVAL</span><strong>{healthy}<em> / {NEWS_SOURCES.length}</em></strong><small>{snapshot ? stamp(snapshot.generatedAt) : 'No successful snapshot'}</small></div></div>
        {prefs.desk === 'sources' ? <div className="nr-observatory">
          <p className="nr-muted">Adapter availability describes retrieval. It is not a rating of the publisher or independent confirmation of its claims. Only these adapters are in the news cache; the atlas has a separate source ledger.</p>
          <section className="nr-coverage-matrix" aria-label="Planetary coverage matrix">
<h3>Planetary coverage matrix</h3>
<p className="nr-muted">Current shared snapshot only; local submissions and archived copies are excluded. A global remit is not evidence of local coverage. Publisher remit does not locate a story.</p>
<p>{coverage.configured} configured feeds · {coverage.originFamilies} origin families · {coverage.healthy} healthy retrievals · {coverage.freshRecords} recently retrieved records of {coverage.records}</p>
<div className="nr-coverage-grid">{coverage.regions.map(row => <div key={String(row.label)} className="nr-coverage-cell"><strong>{String(row.label)}</strong><span>{row.feeds ? `${row.feeds} declared feed(s) · ${row.originFamilies} origin families` : 'No dedicated remit'}</span><span>{row.healthy} healthy · {row.freshRecords} recent records</span></div>)}</div>
<h4>Languages in shared metadata</h4><div className="nr-coverage-grid">{coverage.languages.map(row => <div key={String(row.language)} className="nr-coverage-cell"><strong>{String(row.language).toUpperCase()}</strong><span>{row.feeds} configured · {row.records} records</span><span>{row.freshRecords} recently retrieved</span></div>)}</div>
<h4>Record types</h4><div className="nr-coverage-grid">{coverage.kinds.map(row => <div key={row.kind} className="nr-coverage-cell"><strong>{label(row.kind)}</strong><span>{row.records} records</span></div>)}</div>
<p className="nr-muted">Regions may overlap. Recent retrieval means within 36 hours, not that the event is recent or true. Article metadata does not establish independent reporting.</p>
</section>
          {NEWS_SOURCES.map((source: any) => { const status = sourceHealth.find((row: any) => row.id === source.id); const stale = !status?.lastSuccessAt || Date.parse(now) - Date.parse(status.lastSuccessAt) > 36 * 3600000; return <article className="nr-source" key={source.id}><header><div><span className="nr-overline">{source.format?.toUpperCase()} / {source.language}</span><h3>{source.name}</h3></div><span className={`nr-tag ${status?.status === 'ok' && !stale ? 'nr-ok' : 'nr-warning'}`}>{status?.status === 'ok' && stale ? 'stale snapshot' : status?.status || 'not checked'}</span></header><p>{source.knownLimitations || source.limitations}</p><dl><dt>Coverage</dt><dd>{Array.isArray(source.geographicCoverage) ? source.geographicCoverage.join(', ') : source.geographicCoverage || source.coverage}</dd><dt>Last success</dt><dd>{stamp(status?.lastSuccessAt)}</dd><dt>Last failure</dt><dd>{stamp(status?.lastFailureAt)}</dd><dt>Records</dt><dd>{status?.recordCount ?? 0}</dd><dt>Retrieval note</dt><dd>{status?.message || 'No collection receipt available.'}</dd><dt>Attribution</dt><dd>{source.attributionRequirements || source.attribution}</dd><dt>License limits</dt><dd>{source.licensingConstraints || source.license}</dd><dt>Update interval</dt><dd>{source.expectedUpdateFrequency || `${source.minIntervalMs / 3600000} hours`}</dd></dl><div className="nr-link-row"><a href={source.documentationUrl || source.policyUrls?.[0] || source.homepage || source.url} target="_blank" rel="noopener noreferrer">Provider documentation ↗</a><a href={source.policyUrl || source.policyUrls?.[source.policyUrls.length - 1] || source.licenseUrl || source.url} target="_blank" rel="noopener noreferrer">Usage policy ↗</a></div></article>; })}
          <a href={import.meta.env.BASE_URL + 'data/news-sources.v1.json'} target="_blank" rel="noopener noreferrer">Machine-readable news source registry ↗</a>
        </div> : <>
          <div className="nr-filters"><label>Window<select aria-label="News time window" value={prefs.timeWindow} onChange={event => update({ timeWindow: event.target.value })}><option value="24">Last 24 hours</option><option value="168">Last seven days</option><option value="all" disabled={prefs.desk === "briefing"}>Local archive · all dates</option></select></label><label>Topic<select aria-label="Filter news topic" value={prefs.topic} onChange={event => update({ topic: event.target.value })}><option value="">All topics</option>{topics.map(topic => <option key={topic} value={topic}>{label(topic)}</option>)}</select></label><label>Reported location<select aria-label="Filter reported location" value={prefs.region} onChange={event => update({ region: event.target.value })}><option value="">All locations</option>{regions.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>Language<select aria-label="Filter news language" value={prefs.language} onChange={event => update({ language: event.target.value })}><option value="">All languages</option>{prefs.language && !languages.includes(prefs.language) && <option value={prefs.language}>{prefs.language.toUpperCase()} (not in archive)</option>}{languages.map(language => <option key={language} value={language}>{language.toUpperCase()}</option>)}</select></label><label>Publisher feed<select aria-label="Filter news publisher" value={prefs.sourceId} onChange={event => update({ sourceId: event.target.value })}><option value="">All publisher feeds</option>{prefs.sourceId && !publisherOptions.some(([id]) => id === prefs.sourceId) && <option value={prefs.sourceId}>{prefs.sourceId} (not in archive)</option>}{publisherOptions.map(([id, name]) => <option key={id} value={id}>{name} ({id})</option>)}</select></label><button className="nr-button" aria-pressed={prefs.compact} onClick={() => update({ compact: !prefs.compact })}>{prefs.compact ? 'Comfortable' : 'Compact'}</button></div>
          {prefs.desk === 'briefing' ? <section className="nr-briefing" aria-label="Deterministic intelligence briefing"><div className="nr-section-head"><h3>Source-backed brief</h3><span className="nr-tag">DETERMINISTIC · NO MODEL</span></div><p className="nr-muted">{brief.rankingMethod}</p><div className="nr-actions"><button className="nr-button" onClick={() => download(briefingToMarkdown(brief), 'watchtower-brief.md', 'text/markdown')}>Export Markdown brief</button><button className="nr-button" onClick={() => download(JSON.stringify(brief, null, 2), 'watchtower-brief.json')}>Export JSON brief</button><button className="nr-button" onClick={() => window.print()}>Print brief</button></div><pre className="nr-brief-text">{briefingToMarkdown(brief)}</pre></section> : <>
            {prefs.desk === 'global' && <label className="nr-observation-toggle"><input type="checkbox" checked={prefs.includeObservations} onChange={event => update({ includeObservations: event.target.checked })} />Include public observation catalogs in the newsroom stream</label>}
            <div className="nr-section-head"><h3>{prefs.desk === 'research' ? 'Saved public evidence' : 'Chronological news stream'}</h3><span>{filtered.length} RECORDS / UTC</span></div>
            {!filtered.length && <div className="nr-empty"><span>◎</span><h3>{loading ? 'Opening the source desk…' : 'No reports in this view'}</h3><p>{prefs.desk === 'research' ? 'Save a report to this room or nominate a public source below.' : prefs.desk === 'watchlist' ? 'Save a search to build a local watchlist, then return here.' : 'Try a wider time window or clear your filters. Unavailable feeds do not create synthetic headlines.'}</p><button className="nr-button" onClick={() => update({ query: '', topic: '', region: '', language: '', sourceId: '', timeWindow: 'all' })}>Show available archive</button></div>}
            <div className="nr-stream" aria-label="Public news records">{filtered.slice(0, pageSize).map(row => { const freshness = newsRecordFreshness(row, Date.parse(now)); return <article key={row.id} className={`nr-story ${selected?.id === row.id ? 'selected' : ''}`}><div className="nr-story-time"><time dateTime={row.publishedAt || row.eventAt || row.modifiedAt || undefined}>{stamp(row.publishedAt || row.eventAt || row.modifiedAt)}</time><span>{row.publishedAt ? 'PUBLISHED' : row.eventAt ? 'EVENT TIME' : row.modifiedAt ? 'MODIFIED' : 'DATE UNKNOWN'}</span></div><div className="nr-story-main"><div className="nr-story-kicker"><span>{row.publisher}</span><span>{row.language.toUpperCase()}</span><span className={freshness.state === 'stale' ? 'nr-warning' : ''}>{freshness.state === 'stale' ? 'STALE RETRIEVAL' : row.sourceId === 'manual' ? 'USER SUBMISSION' : 'CACHED'}</span></div><button className="nr-headline" lang={row.language === "und" ? undefined : row.language} dir="auto" onClick={() => { setSelectedId(row.id); setInspector('evidence'); }}>{row.title}</button>{row.summary && <p>{row.summary}</p>}<div className="nr-story-footer"><span>{row.topics.slice(0, 2).map(label).join(' / ') || label(row.kind)}</span><span>{label(row.evidenceType)}</span><button onClick={() => pin(row)} aria-label={`${prefs.pins.includes(row.id) ? 'Unsave' : 'Save'} report: ${row.title}`}>{prefs.pins.includes(row.id) ? 'Saved ✓' : '+ Save'}</button></div></div></article>; })}</div>
            {filtered.length > pageSize && <button className="nr-button nr-load-more" onClick={() => setPageSize(size => size + 30)}>Show next 30 reports</button>}
            <div className="nr-footnote">{records.filter(row => !row.publishedAt && !row.eventAt && !row.modifiedAt).length} records have no exact source time; use the all-dates archive view to inspect them. Publication, occurrence, modification, and retrieval are separate clocks. An institutional statement is an attributed claim, not independent verification. Unknown story locations stay off the map.</div>
          </>}
          {prefs.desk === 'research' && <section className="nr-research-tools"><h3>Nominate a public source</h3><p className="nr-muted">A link and your title stay local. Submission does not retrieve the page or verify its claims.</p><form className="nr-form" onSubmit={addManual}><label>Public source title<input required maxLength={280} value={manualTitle} onChange={event => setManualTitle(event.target.value)} /></label><label>Public source URL (HTTPS)<input required type="url" maxLength={2048} value={manualUrl} onChange={event => setManualUrl(event.target.value)} /></label><label>Publication time (optional, UTC)<input type="datetime-local" value={manualDate} onChange={event => setManualDate(event.target.value)} /></label><button className="nr-button">Add public source to research</button></form></section>}
        </>}
        <details className="nr-storage"><summary>Local history &amp; portable data</summary><p>Public metadata is stored on this device. Notes, watches, and saved views are never included in public exports. Imports are untrusted user submissions.</p><label>Keep local news for <select aria-label="Local news retention" value={prefs.retentionDays} onChange={event => update({ retentionDays: Number(event.target.value) })}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label><div className="nr-actions"><button className="nr-button" onClick={() => { const pack = makeNewsArchive(records); download(JSON.stringify(pack), 'watchtower-public-archive.json'); setActionNote(`${pack.count} public records exported; ${pack.omittedCount} omitted to keep the file within the import limit.`); }}>Export public archive</button><label className="nr-button nr-file-label">{importing ? 'Importing…' : 'Import public archive'}<input type="file" accept="application/json,.json" disabled={importing} onChange={event => { void importArchive(event.target.files?.[0]); event.target.value = ''; }} /></label><button className="nr-button nr-danger" onClick={clearArchive}>Clear local news &amp; notes</button></div></details>
      </div>
      <aside className="nr-inspector" aria-label="Evidence inspector">
        <div className="nr-section-head"><h3>Evidence desk</h3><span>RECEIPTS / CONTEXT</span></div>
        {selected ? <>
          <div className="nr-inspector-title"><span className="nr-tag">{label(selected.evidenceType)}</span><h3>{selected.title}</h3><a href={selected.url} target="_blank" rel="noopener noreferrer">Read original source ↗</a></div>
          <nav className="nr-inspector-tabs" aria-label="Evidence views">{(['evidence', 'compare', 'timeline'] as const).map(view => <button aria-pressed={inspector === view} key={view} onClick={() => setInspector(view)}>{view === 'evidence' ? 'Receipt' : view === 'compare' ? 'Compare' : 'Timeline'}</button>)}</nav>
          {inspector === 'evidence' ? <div className="nr-receipt"><dl><dt>Attributed to</dt><dd>{selected.publisher}</dd><dt>Publication</dt><dd>{stamp(selected.publishedAt)}</dd><dt>Occurrence</dt><dd>{stamp(selected.eventAt)}</dd><dt>Modification</dt><dd>{stamp(selected.modifiedAt)}</dd><dt>Retrieval</dt><dd>{stamp(selected.retrievedAt)}</dd><dt>Geography</dt><dd>{selected.region.label} · {selected.region.precision}</dd><dt>Evidence state</dt><dd>Source-attributed · not independently verified</dd><dt>Origin family</dt><dd>{selected.originGroup}</dd></dl><p className="nr-caveat">A feed receipt records what the publisher supplied. It does not establish that every claim is true.</p></div> : inspector === 'compare' ? <div className="nr-comparison"><label className="nr-compare-select">Compare another saved report<select aria-label="Compare saved evidence" value={comparisonId} onChange={event => setComparisonId(event.target.value)}><option value="">Suggested group only</option>{records.filter(row => prefs.pins.includes(row.id) && row.id !== selected.id).map(row => <option key={row.id} value={row.id}>{row.publisher}: {row.title}</option>)}</select></label>{manualComparison && <p className="nr-muted">User-selected comparison; no relationship is inferred.</p>}<p className="nr-caveat">Headline and metadata comparison only. Quoted parties, factual disagreements, omissions, and causality require human review.</p>{compareRows.map((row: NewsRecord) => <article key={row.id}><strong>{row.publisher}</strong><p>{row.title}</p><span>{stamp(row.publishedAt)} / {row.originGroup}</span><a href={row.url} target="_blank" rel="noopener noreferrer">Inspect report ↗</a></article>)}<p className="nr-muted">{new Set(compareRows.map(row => row.originGroup)).size} origin families. Independence not assessed; syndicated copies are not confirmations.</p></div> : <ol className="nr-timeline">{(selectedEvent?.timeline || []).map((entry: { type: string; at: string; recordId: string; sourceUrl: string }) => <li key={entry.recordId + entry.type + entry.at}><time dateTime={entry.at}>{stamp(entry.at)}</time><strong>{records.find(row => row.id === entry.recordId)?.publisher || 'Attributed source'}</strong><span>{entry.type === 'event' ? 'Source-reported occurrence' : entry.type === 'publication' ? 'Publication; occurrence may differ' : entry.type === 'modification' ? 'Source modification' : 'Retrieval receipt; not occurrence'}</span><a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Source receipt ↗</a></li>)}</ol>}
          <details className="nr-revisions"><summary>Observed metadata history ({observedRevisions.length})</summary><p className="nr-muted">Only shared-feed versions observed on this device. Retrieval timestamps are not publication or correction times. Missing intermediate versions are possible; changes do not prove a correction or a false claim. Local retention and storage limits apply.</p>{observedRevisions.length === 0 && <p className="nr-muted">No shared-feed observations retained for this receipt.</p>}{observedRevisions.map((version, index) => <article className="nr-revision" key={version.retrievedAt}><time dateTime={version.retrievedAt}>Retrieved {stamp(version.retrievedAt)}</time><strong>{version.title}</strong>{version.summary && <p>{version.summary}</p>}<span>Publication: {stamp(version.publishedAt)} · Modification: {stamp(version.modifiedAt)}</span><span>{index === observedRevisions.length - 1 ? 'Earliest retained metadata' : 'Later observed metadata'}</span><a href={version.url} target="_blank" rel="noopener noreferrer">Original receipt ↗</a></article>)}</details>
          <details className="nr-grouping"><summary>Report grouping method</summary><p>Group {selectedEvent?.id || "unassigned"} · {selectedEvent?.reportCount || 1} reports. Conservative headline, topic, location, and time comparison suggests related reports. Groups are provisional and do not establish corroboration or causation.</p><button className="nr-button" onClick={() => update({ separateIds: prefs.separateIds.includes(selected.id) ? prefs.separateIds.filter(id => id !== selected.id) : [...prefs.separateIds, selected.id] })}>{prefs.separateIds.includes(selected.id) ? 'Allow automatic grouping' : 'Keep this report separate'}</button></details>
          <details className="nr-annotations" open={prefs.desk === 'research'}><summary>Local research annotations ({notes.length})</summary><p className="nr-muted">Personal notes and hypotheses stay distinct from source claims.</p>{notes.map(note => <article key={note.id} className="nr-note"><span>{label(note.kind)} · user annotation</span><p>{note.text}</p>{note.referenceUrl && <a href={note.referenceUrl} target="_blank" rel="noopener noreferrer">Supporting / challenging receipt ↗</a>}<button aria-label="Delete research annotation" onClick={() => update({ notes: prefs.notes.filter(row => row.id !== note.id) })}>Remove</button></article>)}<label>Annotation type<select aria-label="Research annotation type" value={noteKind} onChange={event => setNoteKind(event.target.value)}><option value="note">Personal note</option><option value="hypothesis">Hypothesis</option><option value="counterevidence">Disconfirming evidence</option><option value="disputed">Disputed claim</option><option value="correction">Correction to review</option></select></label><label>Research annotation<textarea aria-label="Research annotation" maxLength={1200} rows={3} value={noteText} onChange={event => setNoteText(event.target.value)} /></label><label>Evidence URL (optional)<input aria-label="Annotation evidence URL" type="url" value={noteUrl} onChange={event => setNoteUrl(event.target.value)} maxLength={2048} /></label><button className="nr-button" onClick={addNote} disabled={!noteText.trim()}>Save local annotation</button></details>
        </> : <p className="nr-inspector-empty">Select a report to inspect its receipt, timestamps, source family, and open questions.</p>}
        <div className="nr-atlas-preview"><div className="nr-globe"><GlobeCanvas signals={[]} onSelect={() => {}} zone={{ lat: 20, lon: -30 }} /></div><div><span className="nr-overline">GLOBAL ATLAS</span><p>Explore source-published event locations with Lite, Map, and Globe.</p><button className="nr-button" onClick={onOpenAtlas}>Open live signals ↗</button></div></div>
        <div className="nr-coverage"><span className="nr-overline">COVERAGE NOTE</span><p>This edition covers selected public institutions, science, policy, and hazards. It is not a comprehensive world news feed or an official emergency warning service.</p><a href={import.meta.env.BASE_URL + 'data/news-sources.v1.json'} target="_blank" rel="noopener noreferrer">Source and policy manifest ↗</a></div>
      </aside>
    </div>
  </section>;
}
