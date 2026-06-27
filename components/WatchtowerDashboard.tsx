"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SignalType = "earthquake" | "news" | "market";
type Confidence = "verified_official" | "reported" | "approximate" | "unknown";
type TimeWindow = "24h" | "7d";
type SourceStatus = "fresh" | "stale" | "down" | "demo";

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

type Props = { defaultZone: { name: string; lat: number; lon: number; radiusKm: number } };

const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";

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

function CanvasMap({ signals, selectedId, onSelect, zone, radiusKm }: { signals: SignalRecord[]; selectedId?: string; onSelect: (id: string) => void; zone: Props["defaultZone"]; radiusKm: number }) {
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
      const mag = s.magnitude ?? 1;
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
  const [activeZone, setActiveZone] = useState(defaultZone);
  const [enabled, setEnabled] = useState<SignalType[]>(["earthquake", "news", "market"]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>();
  const [fieldNote, setFieldNote] = useState("Ready");
  const [sourceLedger, setSourceLedger] = useState<SourceLedgerEntry[]>([
    { name: "USGS Earthquake Feed", status: "stale", message: "Waiting for first pull" },
    { name: "Demo News Adapter", status: "demo", message: "Placeholder until real news adapter lands" },
    { name: "Demo Market Adapter", status: "demo", message: "Placeholder until real market adapter lands" }
  ]);
  const [watchtowerLog, setWatchtowerLog] = useState<string[]>(["Watchtower booted in Lite Atlas mode"]);

  const lenses = [defaultZone, { name: "Mt. Shasta Watch Lens", lat: 41.4099, lon: -122.1949, radiusKm: 200 }, { name: "Northern California Lens", lat: 39.6, lon: -121.9, radiusKm: 350 }, { name: "West Coast Lens", lat: 38.5, lon: -123.5, radiusKm: 900 }];

  function pushLog(message: string) {
    setWatchtowerLog((old) => [`${new Date().toLocaleTimeString()} — ${message}`, ...old].slice(0, 8));
  }

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const started = Date.now();
      const res = await fetch(FEED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`USGS returned ${res.status}`);
      const json = await res.json();
      const now = new Date().toISOString();
      const quakes: SignalRecord[] = (json.features ?? []).filter((f: any) => f.properties?.type === "earthquake").map((f: any) => ({
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
      const demos: SignalRecord[] = [
        { id: "demo-news-shasta", type: "news", title: "Demo news lens: Mt. Shasta infrastructure watch", summary: "Placeholder for the upcoming news adapter.", source: "Demo News Adapter", timestamp: now, lat: 41.4099, lon: -122.1949, confidence: "reported", privacyClass: "public", facts: { adapter: "demo", nextStep: "news source route" } },
        { id: "demo-market-btc", type: "market", title: "Demo BTC market pulse", summary: "Placeholder for future market adapter with delay labels.", source: "Demo Market Adapter", timestamp: now, confidence: "reported", privacyClass: "public", facts: { adapter: "demo", delay: "not live market data" } }
      ];
      setSignals([...quakes, ...demos].sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp))));
      setLastUpdated(now);
      setFieldNote(`Loaded ${quakes.length} USGS earthquake records`);
      setSourceLedger([
        { name: "USGS Earthquake Feed", status: "fresh", lastChecked: now, message: `${quakes.length} earthquake records in ${Date.now() - started}ms` },
        { name: "Demo News Adapter", status: "demo", lastChecked: now, message: "UI placeholder only" },
        { name: "Demo Market Adapter", status: "demo", lastChecked: now, message: "UI placeholder only" }
      ]);
      pushLog(`USGS feed passed with ${quakes.length} records`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signal load failed";
      setError(message);
      setFieldNote("Source check failed; retry when network clears");
      setSourceLedger((old) => old.map((source) => source.name === "USGS Earthquake Feed" ? { ...source, status: "down", lastChecked: new Date().toISOString(), message } : source));
      pushLog(`USGS feed failed: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);

  const visible = useMemo(() => signals.filter((s) => {
    if (!enabled.includes(s.type)) return false;
    if (s.type === "earthquake" && (s.magnitude ?? 0) < minMag) return false;
    if (timeWindow === "24h" && Number(new Date(s.timestamp)) < Date.now() - 24 * 60 * 60 * 1000) return false;
    if (query.trim()) {
      const haystack = `${s.title} ${s.summary ?? ""} ${s.source}`.toLowerCase();
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

  const alertCards = [
    { title: "Local M3+", value: localM3, detail: `${radiusKm} km around ${activeZone.name}` },
    { title: "Visible M5+", value: regionalM5, detail: "Strong events in current filters" },
    { title: "Source Freshness", value: lastUpdated ? ageLabel(lastUpdated) : "pending", detail: "USGS feed refresh target: 60s" }
  ];

  function toggle(type: SignalType) { setEnabled((old) => old.includes(type) ? old.filter((t) => t !== type) : [...old, type]); }
  function useMyLocation() { navigator.geolocation?.getCurrentPosition((p) => setActiveZone({ name: "My Local Lens", lat: p.coords.latitude, lon: p.coords.longitude, radiusKm })); }
  async function copyFieldReport() {
    const report = `Parallax Watchtower field report\nLens: ${activeZone.name}\nVisible signals: ${visible.length}\nLocal radius hits: ${localHits}\nLocal M3+: ${localM3}\nVisible M5+: ${regionalM5}\nMax magnitude: ${maxMag.toFixed(1)}\nUpdated: ${lastUpdated ?? "pending"}`;
    await navigator.clipboard?.writeText(report);
    setFieldNote("Field report copied to clipboard");
    pushLog("Field report copied");
  }

  return <main className="shell">
    <header className="header"><div className="brand"><div className="mark">⌂</div><div><div className="eyebrow">PARALLAX</div><h1>WATCHTOWER</h1><div className="subtitle">Real-time signal atlas & OSINT field ledger. See more. Know sooner. Act smarter.</div></div></div><div className="stats"><div className="stat"><strong>{visible.length}</strong><span>Visible signals</span></div><div className="stat"><strong>{localHits}</strong><span>Local radius hits</span></div><div className="stat"><strong>{maxMag.toFixed(1)}</strong><span>Max magnitude</span></div></div></header>
    <div className="status-strip"><span className="pill good">Field online</span><span className="pill">USGS feed {loading ? "loading" : "loaded"}</span><span className="pill">Lite Atlas mode</span><span className="pill">{fieldNote}</span></div>
    {error && <p className="error">{error}</p>}
    <section className="grid"><aside className="panel panel-pad"><h2 className="panel-title">Controls</h2><div className="control-group"><div className="label">Signal layers</div><div className="toggle-row">{(["earthquake", "news", "market"] as SignalType[]).map((t) => <button className={`toggle ${enabled.includes(t) ? "" : "off"}`} key={t} onClick={() => toggle(t)}>{t}</button>)}</div></div><div className="control-group"><div className="label">Time window</div><div className="toggle-row"><button className={`toggle ${timeWindow === "24h" ? "" : "off"}`} onClick={() => setTimeWindow("24h")}>24h</button><button className={`toggle ${timeWindow === "7d" ? "" : "off"}`} onClick={() => setTimeWindow("7d")}>7d</button></div></div><div className="control-group"><div className="label">Search field</div><input className="toggle" style={{ width: "100%" }} value={query} placeholder="place, source, keyword" onChange={(e) => setQuery(e.target.value)}/></div><div className="control-group"><div className="label">Minimum earthquake magnitude</div><input className="slider" type="range" min="0" max="7" step="0.1" value={minMag} onChange={(e) => setMinMag(Number(e.target.value))}/><p className="small">M {minMag.toFixed(1)}+</p></div><div className="control-group zone-card"><div className="label">Local lens</div><strong>{activeZone.name}</strong><p className="small">{activeZone.lat.toFixed(4)}, {activeZone.lon.toFixed(4)}</p><select className="toggle" value={activeZone.name} onChange={(e) => { const z = lenses.find((l) => l.name === e.target.value); if (z) { setActiveZone(z); setRadiusKm(z.radiusKm); } }}>{lenses.map((z) => <option key={z.name}>{z.name}</option>)}</select><div className="zone-row"><button className="btn" onClick={useMyLocation}>Use my location</button><button className="btn" onClick={() => setActiveZone(defaultZone)}>Reset Corning</button></div><label className="checkline"><input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)}/> show local radius only</label><input className="slider" type="range" min="25" max="900" step="25" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}/><p className="small">{radiusKm} km radius</p></div><div className="control-group zone-card"><div className="label">Alert preview</div>{alertCards.map((card) => <p className="small" key={card.title}><strong>{card.title}: {card.value}</strong><br />{card.detail}</p>)}<button className="btn" onClick={copyFieldReport}>Copy field report</button></div><div className="control-group zone-card"><div className="label">Source Ledger</div>{sourceLedger.map((source) => <p className="small" key={source.name}><span className={`badge ${source.status === "fresh" ? "verified_official" : source.status === "demo" ? "reported" : "unknown"}`}>{source.status}</span><br /><strong>{source.name}</strong><br />{source.message}<br />{source.lastChecked ? ageLabel(source.lastChecked) : "not checked"}</p>)}</div><div className="control-group zone-card"><div className="label">Watchtower Log</div>{watchtowerLog.map((entry) => <p className="small" key={entry}>{entry}</p>)}</div><ul className="boundary-list"><li>Consent-based location only</li><li>Public/official sources preferred</li><li>Receipts over hype</li><li>Correlation does not equal causation</li></ul></aside><section className="panel map-panel"><div className="map-head"><div><h2 className="panel-title">Lite Atlas Field Map</h2><div className="small">Canvas fallback: no external map tiles, Android-safe first.</div></div><div className="legend"><span className="badge verified_official">Verified official</span><span className="badge reported">Reported</span></div></div><div className="canvas-wrap"><span className="map-chip">{visible.filter((s) => s.lat !== undefined).length} mapped signals • tap marker for receipt</span><CanvasMap signals={visible} selectedId={selected?.id} onSelect={setSelectedId} zone={activeZone} radiusKm={radiusKm}/></div></section><aside className="panel panel-pad"><h2 className="panel-title">Signal Feed</h2><div className="feed-list">{visible.slice(0, 28).map((s) => <button key={s.id} className={`feed-item ${s.id === selected?.id ? "active" : ""}`} onClick={() => setSelectedId(s.id)}><div className="feed-title">{s.magnitude ? `M ${s.magnitude.toFixed(1)} - ` : ""}{s.title}</div><div className="small">{s.source} • {ageLabel(s.timestamp)} • {new Date(s.timestamp).toLocaleString()}</div><span className={`badge ${s.confidence}`}>{s.confidence.replace("_", " ")}</span></button>)}</div>{selected && <div className="receipt"><h2 className="panel-title">Event Receipt</h2><dl><dt>Title</dt><dd>{selected.title}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Time</dt><dd>{new Date(selected.timestamp).toLocaleString()}</dd><dt>Age</dt><dd>{ageLabel(selected.timestamp)}</dd><dt>Confidence</dt><dd>{selected.confidenceNotes ?? selected.confidence}</dd><dt>Location</dt><dd>{selected.lat?.toFixed(4) ?? "unmapped"}, {selected.lon?.toFixed(4) ?? ""}</dd><dt>Distance</dt><dd>{selected.lat !== undefined && selected.lon !== undefined ? `${distanceKm(activeZone.lat, activeZone.lon, selected.lat, selected.lon).toFixed(1)} km from ${activeZone.name}` : "n/a"}</dd><dt>Magnitude</dt><dd>{selected.magnitude ?? "n/a"}</dd><dt>Depth</dt><dd>{selected.depthKm ?? "n/a"} km</dd><dt>Privacy</dt><dd>{selected.privacyClass}</dd><dt>Receipt</dt><dd>{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank">Open source</a> : "demo record"}</dd>{selected.facts && Object.entries(selected.facts).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => <><dt key={`${key}-dt`}>{key}</dt><dd key={`${key}-dd`}>{String(value)}</dd></>)}</dl></div>}</aside></section>
  </main>;
}
