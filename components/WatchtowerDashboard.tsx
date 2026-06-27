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

type SourceLedgerEntry = {
  name: string;
  status: SourceStatus;
  lastChecked?: string;
  message: string;
};

type GdeltArticle = {
  title?: string;
  url?: string;
  seendate?: string;
  domain?: string;
  sourceCommonName?: string;
  language?: string;
  sourceCountry?: string;
};

type Props = { defaultZone: WatchZone };

const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
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

function defaultAlertRules(): AlertRule[] {
  return [
    { id: "local-m3", name: "Local M3+", scope: "local_magnitude", threshold: 3, radiusKm: 250, enabled: true },
    { id: "visible-m5", name: "Visible M5+", scope: "visible_magnitude", threshold: 5, enabled: true },
    { id: "news-present", name: "News signals present", scope: "news_count", threshold: 1, enabled: true }
  ];
}

function safeInitialProxyUrl() {
  try {
    return localStorage.getItem(PROXY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function safeInitialSavedZones(): WatchZone[] {
  try {
    const raw = localStorage.getItem(WATCH_ZONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((zone) => typeof zone?.name === "string" && Number.isFinite(zone.lat) && Number.isFinite(zone.lon) && Number.isFinite(zone.radiusKm)).map((zone) => ({ ...zone, source: "saved" }));
  } catch {
    return [];
  }
}

function safeInitialAlertRules(): AlertRule[] {
  try {
    const raw = localStorage.getItem(ALERT_RULES_STORAGE_KEY);
    if (!raw) return defaultAlertRules();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultAlertRules();
    const safeRules = parsed.filter((rule) => typeof rule?.name === "string" && ["local_magnitude", "visible_magnitude", "news_count"].includes(rule.scope) && Number.isFinite(rule.threshold)).map((rule) => ({
      id: typeof rule.id === "string" ? rule.id : crypto.randomUUID(),
      name: rule.name,
      scope: rule.scope as AlertScope,
      threshold: Number(rule.threshold),
      radiusKm: Number.isFinite(rule.radiusKm) ? Number(rule.radiusKm) : undefined,
      enabled: Boolean(rule.enabled)
    }));
    return safeRules.length ? safeRules : defaultAlertRules();
  } catch {
    return defaultAlertRules();
  }
}

function parseGdeltDate(raw?: string) {
  if (!raw) return new Date().toISOString();
  const asDate = new Date(raw);
  if (!Number.isNaN(Number(asDate))) return asDate.toISOString();
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 14) {
    const y = Number(digits.slice(0, 4));
    const m = Number(digits.slice(4, 6));
    const d = Number(digits.slice(6, 8));
    const h = Number(digits.slice(8, 10));
    const min = Number(digits.slice(10, 12));
    const s = Number(digits.slice(12, 14));
    return new Date(Date.UTC(y, m - 1, d, h, min, s)).toISOString();
  }
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

function buildDirectGdeltUrl() {
  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set("query", NEWS_QUERY);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "20");
  url.searchParams.set("sort", "HybridRel");
  return url.toString();
}

function buildProxyUrl(rawProxyUrl: string) {
  const trimmed = rawProxyUrl.trim();
  if (!trimmed) return "";
  const url = new URL(trimmed, window.location.origin);
  url.searchParams.set("query", NEWS_QUERY);
  url.searchParams.set("maxrecords", "20");
  return url.toString();
}

async function fetchNewsSignals(now: string, proxyUrl: string) {
  const endpoints = [] as { name: string; url: string; mode: "proxy" | "direct" }[];
  const builtProxy = buildProxyUrl(proxyUrl);
  if (builtProxy) endpoints.push({ name: "Proxy GDELT News Adapter", url: builtProxy, mode: "proxy" });
  endpoints.push({ name: "GDELT News Adapter", url: buildDirectGdeltUrl(), mode: "direct" });

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
          confidenceNotes: location.lat ? `Public article via ${endpoint.mode} news path with approximate place lens` : `Public article via ${endpoint.mode} news path; no precise location inferred`,
          privacyClass: "public",
          facts: {
            sourceMode: endpoint.mode,
            domain: article.domain,
            sourceCommonName: article.sourceCommonName,
            language: article.language,
            sourceCountry: article.sourceCountry,
            seendate: article.seendate
          },
          ...location
        } as SignalRecord;
      });

      return {
        records,
        ledger: { name: endpoint.name, status: records.length ? "fresh" as SourceStatus : "stale" as SourceStatus, lastChecked: now, message: `${records.length} public news records in ${Date.now() - started}ms via ${endpoint.mode}` },
        log: `${endpoint.name} returned ${records.length} records`,
        mode: endpoint.mode
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : `${endpoint.name} failed`;
    }
  }

  throw new Error(lastError);
}

function CanvasMap({ signals, selectedId, onSelect, zone, radiusKm }: { signals: SignalRecord[]; selectedId?: string; onSelect: (id: string) => void; zone: WatchZone; radiusKm: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#031326";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(84,242,255,0.12)";
    for (let x = 0; x < w; x += w / 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += h / 6) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const project = (lat: number, lon: number) => ({ x: ((lon + 180) / 360) * w, y: ((90 - lat) / 180) * h });
    const c = project(zone.lat, zone.lon);
    ctx.strokeStyle = "rgba(84,242,255,0.65)";
    ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(18, Math.min(120, radiusKm / 2.4)), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#54f2ff";
    ctx.beginPath(); ctx.arc(c.x, c.y, 5, 0, Math.PI * 2); ctx.fill();
    signals.filter((s) => s.lat !== undefined && s.lon !== undefined).slice(0, 900).forEach((s) => {
      const p = project(s.lat as number, s.lon as number);
      const mag = s.magnitude ?? (s.type === "news" ? 1.6 : 1);
      const size = Math.max(3, Math.min(16, mag * 2.3));
      ctx.beginPath();
      ctx.fillStyle = s.id === selectedId ? "#ff5fa0" : s.type === "earthquake" ? (mag >= 5 ? "#ff5fa0" : mag >= 3 ? "#ff9d45" : "#ffd66e") : s.type === "news" ? "#54f2ff" : "#1ed6b7";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }, [signals, selectedId, zone, radiusKm]);

  function pick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    let best: { id: string; d: number } | undefined;
    for (const s of signals) {
      if (s.lat === undefined || s.lon === undefined) continue;
      const x = ((s.lon + 180) / 360) * rect.width;
      const y = ((90 - s.lat) / 180) * rect.height;
      const d = Math.hypot(mx - x, my - y);
      if (d < 18 && (!best || d < best.d)) best = { id: s.id, d };
    }
    if (best) onSelect(best.id);
  }

  return <canvas ref={ref} onClick={pick} aria-label="Lite Atlas signal map" />;
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
  const [proxyInput, setProxyInput] = useState(safeInitialProxyUrl);
  const [proxyUrl, setProxyUrl] = useState(safeInitialProxyUrl);
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
    { name: "Demo Market Adapter", status: "demo", message: "Placeholder until real market adapter lands" }
  ]);
  const [watchtowerLog, setWatchtowerLog] = useState<string[]>(["Watchtower booted in Lite Atlas mode"]);

  const builtInLenses: WatchZone[] = [defaultZone, { name: "Mt. Shasta Watch Lens", lat: 41.4099, lon: -122.1949, radiusKm: 200, source: "built-in" }, { name: "Northern California Lens", lat: 39.6, lon: -121.9, radiusKm: 350, source: "built-in" }, { name: "West Coast Lens", lat: 38.5, lon: -123.5, radiusKm: 900, source: "built-in" }];
  const lenses = [...builtInLenses, ...savedZones];

  function pushLog(message: string) {
    setWatchtowerLog((old) => [`${new Date().toLocaleTimeString()} — ${message}`, ...old].slice(0, 8));
  }

  function persistZones(nextZones: WatchZone[]) {
    const normalized = nextZones.map((zone) => ({ name: zone.name, lat: zone.lat, lon: zone.lon, radiusKm: zone.radiusKm, source: "saved" as const }));
    setSavedZones(normalized);
    try {
      localStorage.setItem(WATCH_ZONES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      setFieldNote("Could not persist watch zones in this browser");
    }
  }

  function persistAlertRules(nextRules: AlertRule[]) {
    setAlertRules(nextRules);
    try {
      localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(nextRules));
    } catch {
      setFieldNote("Could not persist alert rules in this browser");
    }
  }

  function saveWatchZone(zone: WatchZone) {
    const cleanName = zone.name.trim() || "Custom Watch Zone";
    const cleanZone = { name: cleanName, lat: zone.lat, lon: zone.lon, radiusKm: zone.radiusKm, source: "saved" as const };
    if (!Number.isFinite(cleanZone.lat) || !Number.isFinite(cleanZone.lon) || !Number.isFinite(cleanZone.radiusKm)) {
      setFieldNote("Watch zone has invalid coordinates");
      return;
    }
    const nextZones = [...savedZones.filter((existing) => existing.name !== cleanName), cleanZone].slice(-12);
    persistZones(nextZones);
    setActiveZone(cleanZone);
    setRadiusKm(cleanZone.radiusKm);
    setFieldNote(`Saved watch zone: ${cleanName}`);
    pushLog(`Saved watch zone ${cleanName}`);
  }

  function saveDraftZone() {
    saveWatchZone({ name: zoneName, lat: Number(zoneLat), lon: Number(zoneLon), radiusKm: Number(zoneRadius), source: "custom" });
  }

  function saveCurrentZone() {
    saveWatchZone({ ...activeZone, name: activeZone.name.includes("Saved") ? activeZone.name : `${activeZone.name} Saved`, radiusKm });
  }

  function removeSavedZone(name: string) {
    const nextZones = savedZones.filter((zone) => zone.name !== name);
    persistZones(nextZones);
    setFieldNote(`Removed watch zone: ${name}`);
    pushLog(`Removed watch zone ${name}`);
    if (activeZone.name === name) {
      setActiveZone(defaultZone);
      setRadiusKm(defaultZone.radiusKm);
    }
  }

  function addAlertRule() {
    const threshold = Number(ruleThreshold);
    const radius = Number(ruleRadius);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setFieldNote("Alert threshold must be a positive number");
      return;
    }
    if (ruleScope === "local_magnitude" && (!Number.isFinite(radius) || radius <= 0)) {
      setFieldNote("Local alert radius must be a positive number");
      return;
    }
    const rule: AlertRule = {
      id: crypto.randomUUID(),
      name: ruleName.trim() || "Custom alert rule",
      scope: ruleScope,
      threshold,
      radiusKm: ruleScope === "local_magnitude" ? radius : undefined,
      enabled: true
    };
    persistAlertRules([...alertRules, rule].slice(-16));
    setFieldNote(`Saved alert rule: ${rule.name}`);
    pushLog(`Saved alert rule ${rule.name}`);
  }

  function toggleAlertRule(id: string) {
    const nextRules = alertRules.map((rule) => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule);
    persistAlertRules(nextRules);
  }

  function removeAlertRule(id: string) {
    const removed = alertRules.find((rule) => rule.id === id);
    persistAlertRules(alertRules.filter((rule) => rule.id !== id));
    if (removed) pushLog(`Removed alert rule ${removed.name}`);
  }

  async function load() {
    setLoading(true);
    setError(undefined);
    const now = new Date().toISOString();
    let quakes: SignalRecord[] = [];
    let newsRecords: SignalRecord[] = [];
    let usgsLedger: SourceLedgerEntry = { name: "USGS Earthquake Feed", status: "stale", lastChecked: now, message: "No records loaded yet" };
    let newsLedger: SourceLedgerEntry = { name: proxyUrl.trim() ? "Proxy GDELT News Adapter" : "GDELT News Adapter", status: "stale", lastChecked: now, message: "No records loaded yet" };

    try {
      const started = Date.now();
      const res = await fetch(FEED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`USGS returned ${res.status}`);
      const json = await res.json();
      quakes = (json.features ?? []).filter((f: any) => f.properties?.type === "earthquake").map((f: any) => ({
        id: `usgs-${f.id}`,
        type: "earthquake",
        title: f.properties.title ?? `M ${f.properties.mag ?? "?"} earthquake`,
        summary: f.properties.place ?? undefined,
        source: "USGS Earthquake Feed",
        sourceUrl: f.properties.url ?? undefined,
        timestamp: new Date(f.properties.time).toISOString(),
        lat: f.geometry?.coordinates?.[1],
        lon: f.geometry?.coordinates?.[0],
        depthKm: f.geometry?.coordinates?.[2],
        magnitude: typeof f.properties.mag === "number" ? f.properties.mag : undefined,
        confidence: "verified_official",
        confidenceNotes: f.properties.status === "reviewed" ? "USGS reviewed event" : "USGS automatic event",
        privacyClass: "public",
        facts: {
          usgsId: f.id,
          status: f.properties.status,
          magType: f.properties.magType,
          feltReports: f.properties.felt,
          cdi: f.properties.cdi,
          mmi: f.properties.mmi,
          alert: f.properties.alert,
          tsunamiFlag: f.properties.tsunami,
          significance: f.properties.sig,
          network: f.properties.net,
          code: f.properties.code
        }
      }));
      usgsLedger = { name: "USGS Earthquake Feed", status: "fresh", lastChecked: now, message: `${quakes.length} earthquake records in ${Date.now() - started}ms` };
      pushLog(`USGS feed passed with ${quakes.length} records`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "USGS load failed";
      usgsLedger = { name: "USGS Earthquake Feed", status: "down", lastChecked: now, message };
      setError(message);
      pushLog(`USGS feed failed: ${message}`);
    }

    try {
      const newsResult = await fetchNewsSignals(now, proxyUrl);
      newsRecords = newsResult.records;
      newsLedger = newsResult.ledger;
      pushLog(newsResult.log);
    } catch (err) {
      const message = err instanceof Error ? err.message : "GDELT load failed";
      newsRecords = [{ id: "demo-news-shasta", type: "news", title: "Fallback news lens: Mt. Shasta infrastructure watch", summary: "GDELT did not load in this browser session, so Watchtower kept a safe placeholder record.", source: "Fallback News Adapter", timestamp: now, lat: 41.4099, lon: -122.1949, radiusKm: 90, locationLabel: "Mt. Shasta fallback lens", confidence: "approximate", confidenceNotes: "Fallback record only", privacyClass: "public", facts: { adapter: "fallback", reason: message } }];
      newsLedger = { name: proxyUrl.trim() ? "Proxy GDELT News Adapter" : "GDELT News Adapter", status: "down", lastChecked: now, message: `Fallback active: ${message}` };
      pushLog(`News adapter failed: ${message}`);
    }

    const marketDemo: SignalRecord = { id: "demo-market-btc", type: "market", title: "Demo BTC market pulse", summary: "Placeholder for future market adapter with delay labels.", source: "Demo Market Adapter", timestamp: now, confidence: "reported", privacyClass: "public", facts: { adapter: "demo", delay: "not live market data" } };
    setSignals([...quakes, ...newsRecords, marketDemo].sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp))));
    setLastUpdated(now);
    setFieldNote(`Loaded ${quakes.length} quakes + ${newsRecords.length} news records`);
    setSourceLedger([
      usgsLedger,
      newsLedger,
      { name: "Demo Market Adapter", status: "demo", lastChecked: now, message: "UI placeholder only" }
    ]);
    setLoading(false);
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, [proxyUrl]);

  const visible = useMemo(() => signals.filter((s) => {
    if (!enabled.includes(s.type)) return false;
    if (s.type === "earthquake" && (s.magnitude ?? 0) < minMag) return false;
    if (timeWindow === "24h" && Number(new Date(s.timestamp)) < Date.now() - 24 * 60 * 60 * 1000) return false;
    if (query.trim()) {
      const haystack = `${s.title} ${s.summary ?? ""} ${s.source} ${s.locationLabel ?? ""}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    if (localOnly) {
      if (s.lat === undefined || s.lon === undefined) return false;
      if (distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) > radiusKm) return false;
    }
    return true;
  }), [signals, enabled, minMag, localOnly, activeZone, radiusKm, timeWindow, query]);

  const selected = visible.find((s) => s.id === selectedId) ?? visible[0];
  const maxMag = visible.reduce((m, s) => Math.max(m, s.magnitude ?? 0), 0);
  const localSignals = visible.filter((s) => s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= radiusKm);
  const localHits = localSignals.length;
  const localM3 = localSignals.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= 3).length;
  const regionalM5 = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= 5).length;
  const newsCount = visible.filter((s) => s.type === "news").length;

  const evaluatedAlerts = useMemo(() => alertRules.map((rule) => {
    let count = 0;
    let detail = "";
    if (rule.scope === "local_magnitude") {
      const scopeRadius = rule.radiusKm ?? radiusKm;
      count = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= rule.threshold && s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= scopeRadius).length;
      detail = `M${rule.threshold}+ within ${scopeRadius} km of ${activeZone.name}`;
    }
    if (rule.scope === "visible_magnitude") {
      count = visible.filter((s) => s.type === "earthquake" && (s.magnitude ?? 0) >= rule.threshold).length;
      detail = `M${rule.threshold}+ anywhere in current filters`;
    }
    if (rule.scope === "news_count") {
      count = newsCount;
      detail = `${rule.threshold}+ news signals in current filters`;
    }
    const requiredCount = rule.scope === "news_count" ? rule.threshold : 1;
    return { rule, count, detail, triggered: rule.enabled && count >= requiredCount };
  }), [alertRules, activeZone, radiusKm, visible, newsCount]);

  const triggeredAlerts = evaluatedAlerts.filter((entry) => entry.triggered);

  const alertCards = [
    { title: "Local M3+", value: localM3, detail: `${radiusKm} km around ${activeZone.name}` },
    { title: "Visible M5+", value: regionalM5, detail: "Strong events in current filters" },
    { title: "News Signals", value: newsCount, detail: "Public-news adapter records in current filters" },
    { title: "Alert Rules", value: triggeredAlerts.length, detail: `${alertRules.filter((rule) => rule.enabled).length} enabled / ${alertRules.length} total` },
    { title: "Saved Zones", value: savedZones.length, detail: "Browser-local watch lenses" },
    { title: "Source Freshness", value: lastUpdated ? ageLabel(lastUpdated) : "pending", detail: "Feed refresh target: 60s" }
  ];

  function toggle(type: SignalType) { setEnabled((old) => old.includes(type) ? old.filter((t) => t !== type) : [...old, type]); }
  function useMyLocation() { navigator.geolocation?.getCurrentPosition((p) => setActiveZone({ name: "My Local Lens", lat: p.coords.latitude, lon: p.coords.longitude, radiusKm, source: "custom" })); }
  function saveProxy() { const saved = proxyInput.trim(); try { saved ? localStorage.setItem(PROXY_STORAGE_KEY, saved) : localStorage.removeItem(PROXY_STORAGE_KEY); } catch { setFieldNote("Could not persist news proxy in this browser"); } setProxyUrl(saved); setFieldNote(saved ? "News proxy saved" : "News proxy cleared"); pushLog(saved ? "News proxy URL saved" : "News proxy URL cleared"); }
  async function copyFieldReport() {
    const report = `Parallax Watchtower field report\nLens: ${activeZone.name}\nVisible signals: ${visible.length}\nLocal radius hits: ${localHits}\nLocal M3+: ${localM3}\nVisible M5+: ${regionalM5}\nNews signals: ${newsCount}\nTriggered alert rules: ${triggeredAlerts.length}\nSaved zones: ${savedZones.length}\nNews proxy: ${proxyUrl.trim() ? "configured" : "direct/fallback"}\nMax magnitude: ${maxMag.toFixed(1)}\nUpdated: ${lastUpdated ?? "pending"}`;
    await navigator.clipboard?.writeText(report);
    setFieldNote("Field report copied to clipboard");
    pushLog("Field report copied");
  }

  return <main className="shell">
    <header className="header"><div className="brand"><div className="mark">⌂</div><div><div className="eyebrow">PARALLAX</div><h1>WATCHTOWER</h1><div className="subtitle">Real-time signal atlas & OSINT field ledger. See more. Know sooner. Act smarter.</div></div></div><div className="stats"><div className="stat"><strong>{visible.length}</strong><span>Visible signals</span></div><div className="stat"><strong>{localHits}</strong><span>Local radius hits</span></div><div className="stat"><strong>{maxMag.toFixed(1)}</strong><span>Max magnitude</span></div></div></header>
    <div className="status-strip"><span className="pill good">Field online</span><span className="pill">Feeds {loading ? "loading" : "loaded"}</span><span className="pill">Lite Atlas mode</span><span className="pill">Rules {triggeredAlerts.length} triggered</span><span className="pill">Zones {savedZones.length} saved</span><span className="pill">News {proxyUrl.trim() ? "proxy-ready" : "direct/fallback"}</span><span className="pill">{fieldNote}</span></div>
    {error && <p className="error">{error}</p>}
    <section className="grid"><aside className="panel panel-pad"><h2 className="panel-title">Controls</h2><div className="control-group"><div className="label">Signal layers</div><div className="toggle-row">{(["earthquake", "news", "market"] as SignalType[]).map((t) => <button className={`toggle ${enabled.includes(t) ? "" : "off"}`} key={t} onClick={() => toggle(t)}>{t}</button>)}</div></div><div className="control-group"><div className="label">Time window</div><div className="toggle-row"><button className={`toggle ${timeWindow === "24h" ? "" : "off"}`} onClick={() => setTimeWindow("24h")}>24h</button><button className={`toggle ${timeWindow === "7d" ? "" : "off"}`} onClick={() => setTimeWindow("7d")}>7d</button></div></div><div className="control-group"><div className="label">Search field</div><input className="toggle" style={{ width: "100%" }} value={query} placeholder="place, source, keyword" onChange={(e) => setQuery(e.target.value)}/></div><div className="control-group"><div className="label">Minimum earthquake magnitude</div><input className="slider" type="range" min="0" max="7" step="0.1" value={minMag} onChange={(e) => setMinMag(Number(e.target.value))}/><p className="small">M {minMag.toFixed(1)}+</p></div><div className="control-group zone-card"><div className="label">Local lens</div><strong>{activeZone.name}</strong><p className="small">{activeZone.lat.toFixed(4)}, {activeZone.lon.toFixed(4)}</p><select className="toggle" value={activeZone.name} onChange={(e) => { const z = lenses.find((l) => l.name === e.target.value); if (z) { setActiveZone(z); setRadiusKm(z.radiusKm); setZoneName(z.name); setZoneLat(String(z.lat)); setZoneLon(String(z.lon)); setZoneRadius(String(z.radiusKm)); } }}>{lenses.map((z) => <option key={`${z.name}-${z.lat}-${z.lon}`}>{z.name}</option>)}</select><div className="zone-row"><button className="btn" onClick={useMyLocation}>Use my location</button><button className="btn" onClick={() => { setActiveZone(defaultZone); setRadiusKm(defaultZone.radiusKm); }}>Reset Corning</button></div><label className="checkline"><input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)}/> show local radius only</label><input className="slider" type="range" min="25" max="900" step="25" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}/><p className="small">{radiusKm} km radius</p></div><div className="control-group zone-card"><div className="label">Watch Zones</div><p className="small">Save browser-local lenses. Nothing is uploaded.</p><input className="toggle" style={{ width: "100%", marginBottom: 8 }} value={zoneName} placeholder="Zone name" onChange={(e) => setZoneName(e.target.value)}/><div className="zone-row"><input className="toggle" value={zoneLat} placeholder="lat" onChange={(e) => setZoneLat(e.target.value)}/><input className="toggle" value={zoneLon} placeholder="lon" onChange={(e) => setZoneLon(e.target.value)}/></div><input className="toggle" style={{ width: "100%", marginTop: 8 }} value={zoneRadius} placeholder="radius km" onChange={(e) => setZoneRadius(e.target.value)}/><div className="zone-row"><button className="btn" onClick={saveDraftZone}>Save custom</button><button className="btn" onClick={saveCurrentZone}>Save current</button></div>{savedZones.map((zone) => <p className="small" key={zone.name}><strong>{zone.name}</strong><br />{zone.lat.toFixed(4)}, {zone.lon.toFixed(4)} • {zone.radiusKm} km<br /><button className="btn" onClick={() => { setActiveZone(zone); setRadiusKm(zone.radiusKm); }}>Activate</button> <button className="btn" onClick={() => removeSavedZone(zone.name)}>Remove</button></p>)}</div><div className="control-group zone-card"><div className="label">Alert Rules</div><p className="small">Browser-local evaluations only. No push notifications yet.</p><input className="toggle" style={{ width: "100%", marginBottom: 8 }} value={ruleName} placeholder="Rule name" onChange={(e) => setRuleName(e.target.value)}/><select className="toggle" style={{ width: "100%" }} value={ruleScope} onChange={(e) => setRuleScope(e.target.value as AlertScope)}><option value="local_magnitude">Local magnitude threshold</option><option value="visible_magnitude">Visible magnitude threshold</option><option value="news_count">News count threshold</option></select><div className="zone-row"><input className="toggle" value={ruleThreshold} placeholder="threshold" onChange={(e) => setRuleThreshold(e.target.value)}/><input className="toggle" value={ruleRadius} placeholder="radius km" onChange={(e) => setRuleRadius(e.target.value)}/></div><button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={addAlertRule}>Save alert rule</button>{evaluatedAlerts.map(({ rule, count, detail, triggered }) => <p className="small" key={rule.id}><span className={`badge ${triggered ? "verified_official" : rule.enabled ? "reported" : "unknown"}`}>{triggered ? "triggered" : rule.enabled ? "quiet" : "paused"}</span><br /><strong>{rule.name}</strong><br />{detail}<br />Hits: {count}<br /><button className="btn" onClick={() => toggleAlertRule(rule.id)}>{rule.enabled ? "Pause" : "Enable"}</button> <button className="btn" onClick={() => removeAlertRule(rule.id)}>Remove</button></p>)}</div><div className="control-group zone-card"><div className="label">News Proxy Mode</div><p className="small">Optional Netlify/Vercel function URL for GDELT. Leave blank for direct browser pull + safe fallback.</p><input className="toggle" style={{ width: "100%" }} value={proxyInput} placeholder="https://your-site.netlify.app/.netlify/functions/gdelt-proxy" onChange={(e) => setProxyInput(e.target.value)}/><div className="zone-row"><button className="btn" onClick={saveProxy}>Save proxy</button><button className="btn" onClick={() => { setProxyInput(""); setProxyUrl(""); localStorage.removeItem(PROXY_STORAGE_KEY); setFieldNote("News proxy cleared"); pushLog("News proxy cleared"); }}>Clear</button></div></div><div className="control-group zone-card"><div className="label">Alert preview</div>{alertCards.map((card) => <p className="small" key={card.title}><strong>{card.title}: {card.value}</strong><br />{card.detail}</p>)}<button className="btn" onClick={copyFieldReport}>Copy field report</button></div><div className="control-group zone-card"><div className="label">Source Ledger</div>{sourceLedger.map((source) => <p className="small" key={source.name}><span className={`badge ${source.status === "fresh" ? "verified_official" : source.status === "demo" ? "reported" : "unknown"}`}>{source.status}</span><br /><strong>{source.name}</strong><br />{source.message}<br />{source.lastChecked ? ageLabel(source.lastChecked) : "not checked"}</p>)}</div><div className="control-group zone-card"><div className="label">Watchtower Log</div>{watchtowerLog.map((entry) => <p className="small" key={entry}>{entry}</p>)}</div><ul className="boundary-list"><li>Consent-based location only</li><li>Public/official sources preferred</li><li>Receipts over hype</li><li>Correlation does not equal causation</li></ul></aside><section className="panel map-panel"><div className="map-head"><div><h2 className="panel-title">Lite Atlas Field Map</h2><div className="small">Canvas fallback: no external map tiles, Android-safe first.</div></div><div className="legend"><span className="badge verified_official">Verified official</span><span className="badge reported">Reported</span></div></div><div className="canvas-wrap"><span className="map-chip">{visible.filter((s) => s.lat !== undefined).length} mapped signals • tap marker for receipt</span><CanvasMap signals={visible} selectedId={selected?.id} onSelect={setSelectedId} zone={activeZone} radiusKm={radiusKm}/></div></section><aside className="panel panel-pad"><h2 className="panel-title">Signal Feed</h2><div className="feed-list">{visible.slice(0, 36).map((s) => <button key={s.id} className={`feed-item ${s.id === selected?.id ? "active" : ""}`} onClick={() => setSelectedId(s.id)}><div className="feed-title">{s.magnitude ? `M ${s.magnitude.toFixed(1)} - ` : ""}{s.title}</div><div className="small">{s.source} • {ageLabel(s.timestamp)} • {s.locationLabel ?? new Date(s.timestamp).toLocaleString()}</div><span className={`badge ${s.confidence}`}>{s.confidence.replace("_", " ")}</span></button>)}</div>{selected && <div className="receipt"><h2 className="panel-title">Event Receipt</h2><dl><dt>Title</dt><dd>{selected.title}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Time</dt><dd>{new Date(selected.timestamp).toLocaleString()}</dd><dt>Age</dt><dd>{ageLabel(selected.timestamp)}</dd><dt>Confidence</dt><dd>{selected.confidenceNotes ?? selected.confidence}</dd><dt>Location</dt><dd>{selected.locationLabel ?? ""} {selected.lat?.toFixed(4) ?? "unmapped"}, {selected.lon?.toFixed(4) ?? ""}</dd><dt>Distance</dt><dd>{selected.lat !== undefined && selected.lon !== undefined ? `${distanceKm(activeZone.lat, activeZone.lon, selected.lat, selected.lon).toFixed(1)} km from ${activeZone.name}` : "n/a"}</dd><dt>Magnitude</dt><dd>{selected.magnitude ?? "n/a"}</dd><dt>Depth</dt><dd>{selected.depthKm ?? "n/a"} km</dd><dt>Privacy</dt><dd>{selected.privacyClass}</dd><dt>Receipt</dt><dd>{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank">Open source</a> : "demo record"}</dd>{selected.facts && Object.entries(selected.facts).filter(([, value]) => value !== undefined && value !== null && value !== "").flatMap(([key, value]) => [<dt key={`${key}-dt`}>{key}</dt>, <dd key={`${key}-dd`}>{String(value)}</dd>])}</dl></div>}</aside></section>
  </main>;
}
