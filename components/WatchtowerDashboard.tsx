"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SignalType = "earthquake" | "news" | "market";
type Confidence = "verified_official" | "reported" | "approximate" | "unknown";
type TimeWindow = "24h" | "7d";
type SourceStatus = "fresh" | "stale" | "down" | "demo";
type AlertScope = "local_magnitude" | "visible_magnitude" | "news_count";

type WatchZone = { name: string; lat: number; lon: number; radiusKm: number; source?: "built-in" | "saved" | "custom" };
type AlertRule = { id: string; name: string; scope: AlertScope; threshold: number; radiusKm?: number; enabled: boolean };

type SignalRecord = {
  id: string;
  type: SignalType;
  title: string;
  summary?: string;
  source: string;
  sourceUrl?: string;
  timestamp: string;
  lat?: number;
  lon?: number;
  depthKm?: number;
  radiusKm?: number;
  locationLabel?: string;
  magnitude?: number;
  confidence: Confidence;
  confidenceNotes?: string;
  privacyClass: "public" | "consent_based" | "private_local";
  facts?: Record<string, string | number | null | undefined>;
};

type SourceLedgerEntry = { name: string; status: SourceStatus; lastChecked?: string; message: string };
type GdeltArticle = { title?: string; url?: string; seendate?: string; domain?: string; sourceCommonName?: string; language?: string; sourceCountry?: string };
type Props = { defaultZone: WatchZone };

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const MARKET_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true";
const NEWS_QUERY = "\"Northern California\" OR \"Mt Shasta\" OR Redding OR \"Tehama County\" OR Sacramento OR earthquake OR wildfire OR infrastructure";
const PROXY_STORAGE_KEY = "watchtower:gdeltProxyUrl";
const WATCH_ZONES_STORAGE_KEY = "watchtower:savedZones";
const ALERT_RULES_STORAGE_KEY = "watchtower:alertRules";

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function ageLabel(timestamp?: string) {
  if (!timestamp) return "pending";
  const minutes = Math.max(0, Math.round((Date.now() - Number(new Date(timestamp))) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function safeGet(key: string) {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function defaultAlertRules(): AlertRule[] {
  return [
    { id: "local-m3", name: "Local M3+", scope: "local_magnitude", threshold: 3, radiusKm: 250, enabled: true },
    { id: "visible-m5", name: "Visible M5+", scope: "visible_magnitude", threshold: 5, enabled: true },
    { id: "news-present", name: "News signals present", scope: "news_count", threshold: 1, enabled: true }
  ];
}

function safeInitialSavedZones(): WatchZone[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATCH_ZONES_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((z) => typeof z?.name === "string" && Number.isFinite(z.lat) && Number.isFinite(z.lon) && Number.isFinite(z.radiusKm)).map((z) => ({ ...z, source: "saved" })) : [];
  } catch { return []; }
}

function safeInitialAlertRules(): AlertRule[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ALERT_RULES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultAlertRules();
    return parsed.filter((r) => typeof r?.name === "string" && ["local_magnitude", "visible_magnitude", "news_count"].includes(r.scope) && Number.isFinite(r.threshold)).map((r) => ({
      id: typeof r.id === "string" ? r.id : crypto.randomUUID(),
      name: r.name,
      scope: r.scope as AlertScope,
      threshold: Number(r.threshold),
      radiusKm: Number.isFinite(r.radiusKm) ? Number(r.radiusKm) : undefined,
      enabled: Boolean(r.enabled)
    }));
  } catch { return defaultAlertRules(); }
}

function parseGdeltDate(raw?: string) {
  if (!raw) return new Date().toISOString();
  const asDate = new Date(raw);
  if (!Number.isNaN(Number(asDate))) return asDate.toISOString();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 14) return new Date(Date.UTC(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)) - 1, Number(digits.slice(6, 8)), Number(digits.slice(8, 10)), Number(digits.slice(10, 12)), Number(digits.slice(12, 14)))).toISOString();
  return new Date().toISOString();
}

function inferNewsLocation(article: GdeltArticle) {
  const text = `${article.title ?? ""} ${article.url ?? ""} ${article.domain ?? ""}`.toLowerCase();
  if (text.includes("shasta")) return { lat: 41.4099, lon: -122.1949, radiusKm: 90, locationLabel: "Mt. Shasta / Siskiyou lens" };
  if (text.includes("corning") || text.includes("tehama")) return { lat: 39.9277, lon: -122.1792, radiusKm: 80, locationLabel: "Corning / Tehama lens" };
  if (text.includes("redding") || text.includes("shasta county")) return { lat: 40.5865, lon: -122.3917, radiusKm: 90, locationLabel: "Redding / Shasta County lens" };
  if (text.includes("sacramento")) return { lat: 38.5816, lon: -121.4944, radiusKm: 90, locationLabel: "Sacramento lens" };
  if (text.includes("california") || text.includes("wildfire") || text.includes("earthquake")) return { lat: 39.6, lon: -121.9, radiusKm: 350, locationLabel: "Northern California approximate lens" };
  return {};
}

function gdeltDirectUrl() {
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set("query", NEWS_QUERY);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "20");
  url.searchParams.set("sort", "HybridRel");
  return url.toString();
}

function gdeltProxyUrl(rawProxyUrl: string) {
  const trimmed = rawProxyUrl.trim();
  if (!trimmed) return "";
  const url = new URL(trimmed, window.location.origin);
  url.searchParams.set("query", NEWS_QUERY);
  url.searchParams.set("maxrecords", "20");
  return url.toString();
}

async function fetchNewsSignals(now: string, proxyUrl: string) {
  const endpoints = [] as { name: string; url: string; mode: "proxy" | "direct" }[];
  const proxy = gdeltProxyUrl(proxyUrl);
  if (proxy) endpoints.push({ name: "Proxy GDELT News Adapter", url: proxy, mode: "proxy" });
  endpoints.push({ name: "GDELT News Adapter", url: gdeltDirectUrl(), mode: "direct" });
  let lastError = "No news endpoint attempted";

  for (const endpoint of endpoints) {
    const started = Date.now();
    try {
      const res = await fetch(endpoint.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${endpoint.name} returned ${res.status}`);
      const json = await res.json();
      const articles: GdeltArticle[] = Array.isArray(json.articles) ? json.articles : [];
      const records: SignalRecord[] = articles.slice(0, 20).map((article, index) => {
        const location = inferNewsLocation(article);
        return {
          id: `gdelt-${endpoint.mode}-${index}-${encodeURIComponent(article.url ?? article.title ?? String(index)).slice(0, 64)}`,
          type: "news",
          title: article.title ?? "Untitled public news signal",
          summary: article.sourceCommonName ?? article.domain ?? "GDELT public news article",
          source: endpoint.name,
          sourceUrl: article.url,
          timestamp: parseGdeltDate(article.seendate),
          confidence: location.lat ? "reported" : "approximate",
          confidenceNotes: location.lat ? `Public article via ${endpoint.mode} path with approximate place lens` : `Public article via ${endpoint.mode} path; no precise location inferred`,
          privacyClass: "public",
          facts: { sourceMode: endpoint.mode, domain: article.domain, sourceCommonName: article.sourceCommonName, language: article.language, sourceCountry: article.sourceCountry, seendate: article.seendate },
          ...location
        };
      });
      return { records, ledger: { name: endpoint.name, status: records.length ? "fresh" as SourceStatus : "stale" as SourceStatus, lastChecked: now, message: `${records.length} public news records in ${Date.now() - started}ms via ${endpoint.mode}` }, log: `${endpoint.name} returned ${records.length} records` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${endpoint.name} failed`;
    }
  }
  throw new Error(lastError);
}

async function fetchMarketSignals(now: string) {
  const started = Date.now();
  const res = await fetch(MARKET_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);
  const json = await res.json();
  const names: Record<string, string> = { bitcoin: "BTC", ethereum: "ETH", solana: "SOL" };
  const records: SignalRecord[] = Object.entries(names).map(([id, symbol]) => {
    const price = Number(json?.[id]?.usd ?? 0);
    const change = Number(json?.[id]?.usd_24h_change ?? 0);
    const updated = json?.[id]?.last_updated_at ? new Date(Number(json[id].last_updated_at) * 1000).toISOString() : now;
    return {
      id: `coingecko-${id}`,
      type: "market",
      title: `${symbol} market pulse: $${price.toLocaleString(undefined, { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}`,
      summary: `${change >= 0 ? "+" : ""}${change.toFixed(2)}% over 24h`,
      source: "CoinGecko Market Adapter",
      sourceUrl: "https://www.coingecko.com/",
      timestamp: updated,
      confidence: "reported",
      confidenceNotes: "Public market API snapshot; not financial advice",
      privacyClass: "public",
      facts: { symbol, priceUsd: price, change24hPct: Number(change.toFixed(3)), provider: "CoinGecko" }
    };
  });
  return { records, ledger: { name: "CoinGecko Market Adapter", status: "fresh" as SourceStatus, lastChecked: now, message: `${records.length} market records in ${Date.now() - started}ms` }, log: `CoinGecko market adapter returned ${records.length} records` };
}

function worldPoint(lat: number, lon: number, zoom: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function zoomForRadius(radiusKm: number) {
  if (radiusKm >= 850) return 4;
  if (radiusKm >= 420) return 5;
  if (radiusKm >= 180) return 6;
  if (radiusKm >= 90) return 7;
  return 8;
}

function ActualMapCanvas({ signals, selectedId, onSelect, zone, radiusKm }: { signals: SignalRecord[]; selectedId?: string; onSelect: (id: string) => void; zone: WatchZone; radiusKm: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const hitRef = useRef<{ id: string; x: number; y: number; r: number }[]>([]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const zoom = zoomForRadius(radiusKm);
    const center = worldPoint(zone.lat, zone.lon, zoom);
    const tileSize = 256;
    let cancelled = false;

    const project = (lat: number, lon: number) => {
      const p = worldPoint(lat, lon, zoom);
      return { x: w / 2 + (p.x - center.x), y: h / 2 + (p.y - center.y) };
    };

    function drawGrid() {
      ctx.strokeStyle = "rgba(84,242,255,0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += w / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += h / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }

    function drawMarkers() {
      const hits: { id: string; x: number; y: number; r: number }[] = [];
      const c = project(zone.lat, zone.lon);
      ctx.strokeStyle = "rgba(84,242,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(24, Math.min(150, radiusKm / 1.9)), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#54f2ff";
      ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fill();

      signals.filter((s) => s.lat !== undefined && s.lon !== undefined).slice(0, 900).forEach((s) => {
        const p = project(s.lat as number, s.lon as number);
        if (p.x < -24 || p.x > w + 24 || p.y < -24 || p.y > h + 24) return;
        const mag = s.magnitude ?? (s.type === "news" ? 1.6 : 1);
        const size = Math.max(4, Math.min(18, mag * 2.4));
        const color = s.id === selectedId ? "#ff5fa0" : s.type === "earthquake" ? (mag >= 5 ? "#ff5fa0" : mag >= 3 ? "#ff9d45" : "#ffd66e") : s.type === "news" ? "#54f2ff" : "#1ed6b7";
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        hits.push({ id: s.id, x: p.x, y: p.y, r: Math.max(18, size + 8) });
      });
      hitRef.current = hits;
    }

    function repaintOverlays() {
      if (cancelled) return;
      drawGrid();
      drawMarkers();
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#031326";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.62;

    const minTileX = Math.floor((center.x - w / 2) / tileSize) - 1;
    const maxTileX = Math.floor((center.x + w / 2) / tileSize) + 1;
    const minTileY = Math.floor((center.y - h / 2) / tileSize) - 1;
    const maxTileY = Math.floor((center.y + h / 2) / tileSize) + 1;
    const maxTile = 2 ** zoom;

    for (let tx = minTileX; tx <= maxTileX; tx += 1) {
      for (let ty = minTileY; ty <= maxTileY; ty += 1) {
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile;
        const dx = w / 2 + tx * tileSize - center.x;
        const dy = h / 2 + ty * tileSize - center.y;
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => {
          if (cancelled) return;
          ctx.globalAlpha = 0.56;
          ctx.drawImage(img, dx, dy, tileSize, tileSize);
          ctx.globalAlpha = 1;
          repaintOverlays();
        };
        img.onerror = () => repaintOverlays();
        img.src = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`;
      }
    }
    ctx.globalAlpha = 1;
    repaintOverlays();
    return () => { cancelled = true; };
  }, [signals, selectedId, zone, radiusKm]);

  function pick(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const best = hitRef.current.map((hit) => ({ ...hit, d: Math.hypot(mx - hit.x, my - hit.y) })).filter((hit) => hit.d <= hit.r).sort((a, b) => a.d - b.d)[0];
    if (best) onSelect(best.id);
  }

  return <canvas ref={ref} onClick={pick} aria-label="Actual map signal canvas with OpenStreetMap tile background" />;
}

export function WatchtowerDashboard({ defaultZone }: Props) {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [minMag, setMinMag] = useState(0);
  const [localOnly, setLocalOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(defaultZone.radiusKm);
  const [activeZone, setActiveZone] = useState<WatchZone>(defaultZone);
  const [enabled, setEnabled] = useState<SignalType[]>(["earthquake", "news", "market"]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [fieldNote, setFieldNote] = useState("Ready");
  const [proxyInput, setProxyInput] = useState(() => safeGet(PROXY_STORAGE_KEY));
  const [proxyUrl, setProxyUrl] = useState(() => safeGet(PROXY_STORAGE_KEY));
  const [savedZones, setSavedZones] = useState<WatchZone[]>(safeInitialSavedZones);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(safeInitialAlertRules);
  const [zoneName, setZoneName] = useState("Custom Watch Zone");
  const [zoneLat, setZoneLat] = useState(String(defaultZone.lat));
  const [zoneLon, setZoneLon] = useState(String(defaultZone.lon));
  const [zoneRadius, setZoneRadius] = useState(String(defaultZone.radiusKm));
  const [ruleName, setRuleName] = useState("Custom alert rule");
  const [ruleScope, setRuleScope] = useState<AlertScope>("local_magnitude");
  const [ruleThreshold, setRuleThreshold] = useState("3");
  const [ruleRadius, setRuleRadius] = useState(String(defaultZone.radiusKm));
  const [sourceLedger, setSourceLedger] = useState<SourceLedgerEntry[]>([
    { name: "USGS Earthquake Feed", status: "stale", message: "Waiting for first pull" },
    { name: "GDELT News Adapter", status: "stale", message: "Waiting for first pull" },
    { name: "CoinGecko Market Adapter", status: "stale", message: "Waiting for first pull" }
  ]);
  const [watchtowerLog, setWatchtowerLog] = useState<string[]>(["Watchtower booted with actual OSM tile background"]);

  const builtInLenses: WatchZone[] = [defaultZone, { name: "Mt. Shasta Watch Lens", lat: 41.4099, lon: -122.1949, radiusKm: 200, source: "built-in" }, { name: "Northern California Lens", lat: 39.6, lon: -121.9, radiusKm: 350, source: "built-in" }, { name: "West Coast Lens", lat: 38.5, lon: -123.5, radiusKm: 900, source: "built-in" }];
  const lenses = [...builtInLenses, ...savedZones];

  function pushLog(message: string) { setWatchtowerLog((old) => [`${new Date().toLocaleTimeString()} — ${message}`, ...old].slice(0, 8)); }
  function persistZones(nextZones: WatchZone[]) { const normalized = nextZones.map((z) => ({ name: z.name, lat: z.lat, lon: z.lon, radiusKm: z.radiusKm, source: "saved" as const })); setSavedZones(normalized); try { localStorage.setItem(WATCH_ZONES_STORAGE_KEY, JSON.stringify(normalized)); } catch { setFieldNote("Could not persist watch zones"); } }
  function persistAlertRules(nextRules: AlertRule[]) { setAlertRules(nextRules); try { localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(nextRules)); } catch { setFieldNote("Could not persist alert rules"); } }

  async function load() {
    setLoading(true);
    setError(undefined);
    const now = new Date().toISOString();
    let quakes: SignalRecord[] = [];
    let newsRecords: SignalRecord[] = [];
    let marketRecords: SignalRecord[] = [];
    let usgsLedger: SourceLedgerEntry = { name: "USGS Earthquake Feed", status: "stale", lastChecked: now, message: "No records loaded" };
    let newsLedger: SourceLedgerEntry = { name: proxyUrl.trim() ? "Proxy GDELT News Adapter" : "GDELT News Adapter", status: "stale", lastChecked: now, message: "No records loaded" };
    let marketLedger: SourceLedgerEntry = { name: "CoinGecko Market Adapter", status: "stale", lastChecked: now, message: "No records loaded" };

    try {
      const started = Date.now();
      const res = await fetch(USGS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`USGS returned ${res.status}`);
      const json = await res.json();
      quakes = (json.features ?? []).filter((f: any) => f.properties?.type === "earthquake").map((f: any) => ({
        id: `usgs-${f.id}`, type: "earthquake", title: f.properties.title ?? `M ${f.properties.mag ?? "?"} earthquake`, summary: f.properties.place ?? undefined, source: "USGS Earthquake Feed", sourceUrl: f.properties.url ?? undefined, timestamp: new Date(f.properties.time).toISOString(), lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0], depthKm: f.geometry?.coordinates?.[2], magnitude: typeof f.properties.mag === "number" ? f.properties.mag : undefined, confidence: "verified_official", confidenceNotes: f.properties.status === "reviewed" ? "USGS reviewed event" : "USGS automatic event", privacyClass: "public", facts: { usgsId: f.id, status: f.properties.status, magType: f.properties.magType, feltReports: f.properties.felt, cdi: f.properties.cdi, mmi: f.properties.mmi, alert: f.properties.alert, tsunamiFlag: f.properties.tsunami, significance: f.properties.sig, network: f.properties.net, code: f.properties.code }
      }));
      usgsLedger = { name: "USGS Earthquake Feed", status: "fresh", lastChecked: now, message: `${quakes.length} earthquake records in ${Date.now() - started}ms` };
      pushLog(`USGS feed passed with ${quakes.length} records`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "USGS load failed";
      usgsLedger = { name: "USGS Earthquake Feed", status: "down", lastChecked: now, message };
      setError(message);
      pushLog(`USGS feed failed: ${message}`);
    }

    try { const result = await fetchNewsSignals(now, proxyUrl); newsRecords = result.records; newsLedger = result.ledger; pushLog(result.log); }
    catch (err) { const message = err instanceof Error ? err.message : "GDELT load failed"; newsRecords = [{ id: "fallback-news-shasta", type: "news", title: "Fallback news lens: Mt. Shasta infrastructure watch", summary: "News did not load in this browser session, so Watchtower kept a safe placeholder record.", source: "Fallback News Adapter", timestamp: now, lat: 41.4099, lon: -122.1949, radiusKm: 90, locationLabel: "Mt. Shasta fallback lens", confidence: "approximate", confidenceNotes: "Fallback record only", privacyClass: "public", facts: { adapter: "fallback", reason: message } }]; newsLedger = { name: proxyUrl.trim() ? "Proxy GDELT News Adapter" : "GDELT News Adapter", status: "down", lastChecked: now, message: `Fallback active: ${message}` }; pushLog(`News adapter failed: ${message}`); }

    try { const result = await fetchMarketSignals(now); marketRecords = result.records; marketLedger = result.ledger; pushLog(result.log); }
    catch (err) { const message = err instanceof Error ? err.message : "market load failed"; marketRecords = [{ id: "fallback-market", type: "market", title: "Fallback market pulse", summary: "Market source did not load; live market adapter stayed claim-safe.", source: "Fallback Market Adapter", timestamp: now, confidence: "approximate", confidenceNotes: "Fallback record only; not financial advice", privacyClass: "public", facts: { reason: message } }]; marketLedger = { name: "CoinGecko Market Adapter", status: "down", lastChecked: now, message: `Fallback active: ${message}` }; pushLog(`Market adapter failed: ${message}`); }

    setSignals([...quakes, ...newsRecords, ...marketRecords].sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp))));
    setLastUpdated(now);
    setFieldNote(`Loaded ${quakes.length} quakes + ${newsRecords.length} news + ${marketRecords.length} market records`);
    setSourceLedger([usgsLedger, newsLedger, marketLedger]);
    setLoading(false);
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, [proxyUrl]);

  const visible = useMemo(() => signals.filter((s) => {
    if (!enabled.includes(s.type)) return false;
    if (s.type === "earthquake" && (s.magnitude ?? 0) < minMag) return false;
    if (timeWindow === "24h" && Number(new Date(s.timestamp)) < Date.now() - 24 * 60 * 60 * 1000) return false;
    if (query.trim()) { const haystack = `${s.title} ${s.summary ?? ""} ${s.source} ${s.locationLabel ?? ""}`.toLowerCase(); if (!haystack.includes(query.trim().toLowerCase())) return false; }
    if (localOnly) { if (s.lat === undefined || s.lon === undefined) return false; if (distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) > radiusKm) return false; }
    return true;
  }), [signals, enabled, minMag, localOnly, activeZone, radiusKm, timeWindow, query]);

  const selected = visible.find((s) => s.id === selectedId) ?? visible[0];
  const maxMag = visible.reduce((m, s) => Math.max(m, s.magnitude ?? 0), 0);
  const localSignals = visible.filter((s) => s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= radiusKm);
  const localHits = localSignals.length;
  const localM3 = localSignals.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= 3).length;
  const regionalM5 = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= 5).length;
  const newsCount = visible.filter((s) => s.type === "news").length;
  const marketCount = visible.filter((s) => s.type === "market").length;

  const evaluatedAlerts = useMemo(() => alertRules.map((rule) => {
    let count = 0; let detail = "";
    if (rule.scope === "local_magnitude") { const scopeRadius = rule.radiusKm ?? radiusKm; count = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= rule.threshold && s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= scopeRadius).length; detail = `M${rule.threshold}+ within ${scopeRadius} km of ${activeZone.name}`; }
    if (rule.scope === "visible_magnitude") { count = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= rule.threshold).length; detail = `M${rule.threshold}+ anywhere in current filters`; }
    if (rule.scope === "news_count") { count = newsCount; detail = `${rule.threshold}+ news signals in current filters`; }
    const requiredCount = rule.scope === "news_count" ? rule.threshold : 1;
    return { rule, count, detail, triggered: rule.enabled && count >= requiredCount };
  }), [alertRules, activeZone, radiusKm, visible, newsCount]);
  const triggeredAlerts = evaluatedAlerts.filter((entry) => entry.triggered);

  const alertCards = [
    { title: "Local M3+", value: localM3, detail: `${radiusKm} km around ${activeZone.name}` },
    { title: "Visible M5+", value: regionalM5, detail: "Strong events in current filters" },
    { title: "News Signals", value: newsCount, detail: "Public-news adapter records" },
    { title: "Market Signals", value: marketCount, detail: "Public market snapshots" },
    { title: "Alert Rules", value: triggeredAlerts.length, detail: `${alertRules.filter((r) => r.enabled).length} enabled / ${alertRules.length} total` }
  ];

  function toggle(type: SignalType) { setEnabled((old) => old.includes(type) ? old.filter((t) => t !== type) : [...old, type]); }
  function useMyLocation() { navigator.geolocation?.getCurrentPosition((p) => setActiveZone({ name: "My Local Lens", lat: p.coords.latitude, lon: p.coords.longitude, radiusKm, source: "custom" })); }
  function saveProxy() { const saved = proxyInput.trim(); try { saved ? localStorage.setItem(PROXY_STORAGE_KEY, saved) : localStorage.removeItem(PROXY_STORAGE_KEY); } catch { setFieldNote("Could not persist news proxy"); } setProxyUrl(saved); setFieldNote(saved ? "News proxy saved" : "News proxy cleared"); pushLog(saved ? "News proxy URL saved" : "News proxy URL cleared"); }
  function persistCurrentZone(zone: WatchZone) { const clean = { name: zone.name.trim() || "Custom Watch Zone", lat: zone.lat, lon: zone.lon, radiusKm: zone.radiusKm, source: "saved" as const }; if (!Number.isFinite(clean.lat) || !Number.isFinite(clean.lon) || !Number.isFinite(clean.radiusKm)) { setFieldNote("Watch zone has invalid coordinates"); return; } const next = [...savedZones.filter((z) => z.name !== clean.name), clean].slice(-12); setSavedZones(next); localStorage.setItem(WATCH_ZONES_STORAGE_KEY, JSON.stringify(next)); setActiveZone(clean); setRadiusKm(clean.radiusKm); setFieldNote(`Saved watch zone: ${clean.name}`); pushLog(`Saved watch zone ${clean.name}`); }
  function addAlertRule() { const threshold = Number(ruleThreshold); const radius = Number(ruleRadius); if (!Number.isFinite(threshold) || threshold <= 0) { setFieldNote("Alert threshold must be positive"); return; } const rule: AlertRule = { id: crypto.randomUUID(), name: ruleName.trim() || "Custom alert rule", scope: ruleScope, threshold, radiusKm: ruleScope === "local_magnitude" && Number.isFinite(radius) ? radius : undefined, enabled: true }; const next = [...alertRules, rule].slice(-16); setAlertRules(next); localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(next)); setFieldNote(`Saved alert rule: ${rule.name}`); }
  async function copyFieldReport() { const report = `Parallax Watchtower field report\nLens: ${activeZone.name}\nVisible signals: ${visible.length}\nLocal radius hits: ${localHits}\nLocal M3+: ${localM3}\nVisible M5+: ${regionalM5}\nNews signals: ${newsCount}\nMarket signals: ${marketCount}\nTriggered alert rules: ${triggeredAlerts.length}\nMax magnitude: ${maxMag.toFixed(1)}\nUpdated: ${lastUpdated ?? "pending"}`; await navigator.clipboard?.writeText(report); setFieldNote("Field report copied to clipboard"); }

  return <main className="shell">
    <header className="header"><div className="brand"><div className="mark">⌂</div><div><div className="eyebrow">PARALLAX</div><h1>WATCHTOWER</h1><div className="subtitle">Real-time signal atlas & OSINT field ledger. Actual map tiles, public news, and market snapshots.</div></div></div><div className="stats"><div className="stat"><strong>{visible.length}</strong><span>Visible signals</span></div><div className="stat"><strong>{localHits}</strong><span>Local radius hits</span></div><div className="stat"><strong>{maxMag.toFixed(1)}</strong><span>Max magnitude</span></div></div></header>
    <div className="status-strip"><span className="pill good">Field online</span><span className="pill">Feeds {loading ? "loading" : "loaded"}</span><span className="pill">Actual OSM map</span><span className="pill">News {proxyUrl.trim() ? "proxy-ready" : "direct/fallback"}</span><span className="pill">Market {marketCount ? "live/fallback" : "pending"}</span><span className="pill">{fieldNote}</span></div>
    {error && <p className="error">{error}</p>}
    <section className="grid"><aside className="panel panel-pad"><h2 className="panel-title">Controls</h2><div className="control-group"><div className="label">Signal layers</div><div className="toggle-row">{(["earthquake", "news", "market"] as SignalType[]).map((t) => <button className={`toggle ${enabled.includes(t) ? "" : "off"}`} key={t} onClick={() => toggle(t)}>{t}</button>)}</div></div><div className="control-group"><div className="label">Time window</div><div className="toggle-row"><button className={`toggle ${timeWindow === "24h" ? "" : "off"}`} onClick={() => setTimeWindow("24h")}>24h</button><button className={`toggle ${timeWindow === "7d" ? "" : "off"}`} onClick={() => setTimeWindow("7d")}>7d</button></div></div><div className="control-group"><div className="label">Search field</div><input className="toggle" style={{ width: "100%" }} value={query} placeholder="place, source, keyword" onChange={(e) => setQuery(e.target.value)}/></div><div className="control-group"><div className="label">Minimum earthquake magnitude</div><input className="slider" type="range" min="0" max="7" step="0.1" value={minMag} onChange={(e) => setMinMag(Number(e.target.value))}/><p className="small">M {minMag.toFixed(1)}+</p></div><div className="control-group zone-card"><div className="label">Local lens</div><strong>{activeZone.name}</strong><p className="small">{activeZone.lat.toFixed(4)}, {activeZone.lon.toFixed(4)}</p><select className="toggle" value={activeZone.name} onChange={(e) => { const z = lenses.find((l) => l.name === e.target.value); if (z) { setActiveZone(z); setRadiusKm(z.radiusKm); setZoneName(z.name); setZoneLat(String(z.lat)); setZoneLon(String(z.lon)); setZoneRadius(String(z.radiusKm)); } }}>{lenses.map((z) => <option key={`${z.name}-${z.lat}-${z.lon}`}>{z.name}</option>)}</select><div className="zone-row"><button className="btn" onClick={useMyLocation}>Use my location</button><button className="btn" onClick={() => { setActiveZone(defaultZone); setRadiusKm(defaultZone.radiusKm); }}>Reset Corning</button></div><label className="checkline"><input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)}/> show local radius only</label><input className="slider" type="range" min="25" max="900" step="25" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}/><p className="small">{radiusKm} km radius</p></div><div className="control-group zone-card"><div className="label">Watch Zones</div><input className="toggle" style={{ width: "100%", marginBottom: 8 }} value={zoneName} placeholder="Zone name" onChange={(e) => setZoneName(e.target.value)}/><div className="zone-row"><input className="toggle" value={zoneLat} placeholder="lat" onChange={(e) => setZoneLat(e.target.value)}/><input className="toggle" value={zoneLon} placeholder="lon" onChange={(e) => setZoneLon(e.target.value)}/></div><input className="toggle" style={{ width: "100%", marginTop: 8 }} value={zoneRadius} placeholder="radius km" onChange={(e) => setZoneRadius(e.target.value)}/><div className="zone-row"><button className="btn" onClick={() => persistCurrentZone({ name: zoneName, lat: Number(zoneLat), lon: Number(zoneLon), radiusKm: Number(zoneRadius) })}>Save custom</button><button className="btn" onClick={() => persistCurrentZone({ ...activeZone, name: `${activeZone.name} Saved`, radiusKm })}>Save current</button></div>{savedZones.map((zone) => <p className="small" key={zone.name}><strong>{zone.name}</strong><br />{zone.lat.toFixed(4)}, {zone.lon.toFixed(4)} • {zone.radiusKm} km<br /><button className="btn" onClick={() => { setActiveZone(zone); setRadiusKm(zone.radiusKm); }}>Activate</button> <button className="btn" onClick={() => { const next = savedZones.filter((z) => z.name !== zone.name); setSavedZones(next); localStorage.setItem(WATCH_ZONES_STORAGE_KEY, JSON.stringify(next)); }}>Remove</button></p>)}</div><div className="control-group zone-card"><div className="label">Alert Rules</div><input className="toggle" style={{ width: "100%", marginBottom: 8 }} value={ruleName} placeholder="Rule name" onChange={(e) => setRuleName(e.target.value)}/><select className="toggle" style={{ width: "100%" }} value={ruleScope} onChange={(e) => setRuleScope(e.target.value as AlertScope)}><option value="local_magnitude">Local magnitude threshold</option><option value="visible_magnitude">Visible magnitude threshold</option><option value="news_count">News count threshold</option></select><div className="zone-row"><input className="toggle" value={ruleThreshold} placeholder="threshold" onChange={(e) => setRuleThreshold(e.target.value)}/><input className="toggle" value={ruleRadius} placeholder="radius km" onChange={(e) => setRuleRadius(e.target.value)}/></div><button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={addAlertRule}>Save alert rule</button>{evaluatedAlerts.map(({ rule, count, detail, triggered }) => <p className="small" key={rule.id}><span className={`badge ${triggered ? "verified_official" : rule.enabled ? "reported" : "unknown"}`}>{triggered ? "triggered" : rule.enabled ? "quiet" : "paused"}</span><br /><strong>{rule.name}</strong><br />{detail}<br />Hits: {count}<br /><button className="btn" onClick={() => { const next = alertRules.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r); setAlertRules(next); localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(next)); }}>{rule.enabled ? "Pause" : "Enable"}</button> <button className="btn" onClick={() => { const next = alertRules.filter((r) => r.id !== rule.id); setAlertRules(next); localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(next)); }}>Remove</button></p>)}</div><div className="control-group zone-card"><div className="label">News Proxy Mode</div><p className="small">Optional Netlify/Vercel function URL for GDELT.</p><input className="toggle" style={{ width: "100%" }} value={proxyInput} placeholder="https://your-site.netlify.app/.netlify/functions/gdelt-proxy" onChange={(e) => setProxyInput(e.target.value)}/><div className="zone-row"><button className="btn" onClick={saveProxy}>Save proxy</button><button className="btn" onClick={() => { setProxyInput(""); setProxyUrl(""); localStorage.removeItem(PROXY_STORAGE_KEY); }}>Clear</button></div></div><div className="control-group zone-card"><div className="label">Alert preview</div>{alertCards.map((card) => <p className="small" key={card.title}><strong>{card.title}: {card.value}</strong><br />{card.detail}</p>)}<button className="btn" onClick={copyFieldReport}>Copy field report</button></div><div className="control-group zone-card"><div className="label">Source Ledger</div>{sourceLedger.map((source) => <p className="small" key={source.name}><span className={`badge ${source.status === "fresh" ? "verified_official" : source.status === "demo" ? "reported" : "unknown"}`}>{source.status}</span><br /><strong>{source.name}</strong><br />{source.message}<br />{source.lastChecked ? ageLabel(source.lastChecked) : "not checked"}</p>)}</div><div className="control-group zone-card"><div className="label">Watchtower Log</div>{watchtowerLog.map((entry) => <p className="small" key={entry}>{entry}</p>)}</div><ul className="boundary-list"><li>Consent-based location only</li><li>Public/official sources preferred</li><li>Receipts over hype</li><li>Correlation does not equal causation</li><li>Market snapshots are not financial advice</li></ul></aside><section className="panel map-panel"><div className="map-head"><div><h2 className="panel-title">Actual Map Field View</h2><div className="small">OpenStreetMap tile background with Watchtower signal overlay. Lite canvas remains tile-failure safe.</div></div><div className="legend"><span className="badge verified_official">Verified official</span><span className="badge reported">Reported</span></div></div><div className="canvas-wrap"><span className="map-chip">{visible.filter((s) => s.lat !== undefined).length} mapped signals • tap marker for receipt</span><ActualMapCanvas signals={visible} selectedId={selected?.id} onSelect={setSelectedId} zone={activeZone} radiusKm={radiusKm}/></div></section><aside className="panel panel-pad"><h2 className="panel-title">Signal Feed</h2><div className="feed-list">{visible.slice(0, 42).map((s) => <button key={s.id} className={`feed-item ${s.id === selected?.id ? "active" : ""}`} onClick={() => setSelectedId(s.id)}><div className="feed-title">{s.magnitude ? `M ${s.magnitude.toFixed(1)} - ` : ""}{s.title}</div><div className="small">{s.source} • {ageLabel(s.timestamp)} • {s.locationLabel ?? s.summary ?? new Date(s.timestamp).toLocaleString()}</div><span className={`badge ${s.confidence}`}>{s.confidence.replace("_", " ")}</span></button>)}</div>{selected && <div className="receipt"><h2 className="panel-title">Event Receipt</h2><dl><dt>Title</dt><dd>{selected.title}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Time</dt><dd>{new Date(selected.timestamp).toLocaleString()}</dd><dt>Age</dt><dd>{ageLabel(selected.timestamp)}</dd><dt>Confidence</dt><dd>{selected.confidenceNotes ?? selected.confidence}</dd><dt>Location</dt><dd>{selected.locationLabel ?? ""} {selected.lat?.toFixed(4) ?? "unmapped"}, {selected.lon?.toFixed(4) ?? ""}</dd><dt>Distance</dt><dd>{selected.lat !== undefined && selected.lon !== undefined ? `${distanceKm(activeZone.lat, activeZone.lon, selected.lat, selected.lon).toFixed(1)} km from ${activeZone.name}` : "n/a"}</dd><dt>Magnitude</dt><dd>{selected.magnitude ?? "n/a"}</dd><dt>Depth</dt><dd>{selected.depthKm ?? "n/a"} km</dd><dt>Privacy</dt><dd>{selected.privacyClass}</dd><dt>Receipt</dt><dd>{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank">Open source</a> : "fallback/demo record"}</dd>{selected.facts && Object.entries(selected.facts).filter(([, value]) => value !== undefined && value !== null && value !== "").flatMap(([key, value]) => [<dt key={`${key}-dt`}>{key}</dt>, <dd key={`${key}-dd`}>{String(value)}</dd>])}</dl></div>}</aside></section>
  </main>;
}
