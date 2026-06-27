"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SignalType = "earthquake" | "news" | "market";
type Confidence = "verified_official" | "reported" | "approximate" | "unknown";

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
  privacyClass: "public" | "consent_based" | "private_local";
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
    signals.filter((s) => s.lat !== undefined && s.lon !== undefined).slice(0, 900).forEach((s) => {
      const p = project(s.lat as number, s.lon as number);
      const mag = s.magnitude ?? 1;
      const size = Math.max(3, Math.min(16, mag * 2.3));
      ctx.beginPath();
      ctx.fillStyle = s.id === selectedId ? "#ff5fa0" : s.type === "earthquake" ? "#ff9d45" : s.type === "news" ? "#54f2ff" : "#ffd66e";
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

  const lenses = [defaultZone, { name: "Mt. Shasta Watch Lens", lat: 41.4099, lon: -122.1949, radiusKm: 200 }, { name: "Northern California Lens", lat: 39.6, lon: -121.9, radiusKm: 350 }, { name: "West Coast Lens", lat: 38.5, lon: -123.5, radiusKm: 900 }];

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(FEED_URL, { cache: "no-store" });
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
        privacyClass: "public"
      }));
      const demos: SignalRecord[] = [
        { id: "demo-news-shasta", type: "news", title: "Demo news lens: Mt. Shasta infrastructure watch", summary: "Placeholder for the upcoming GDELT/news adapter.", source: "Demo News Adapter", timestamp: now, lat: 41.4099, lon: -122.1949, confidence: "reported", privacyClass: "public" },
        { id: "demo-market-btc", type: "market", title: "Demo BTC market pulse", summary: "Placeholder for future market adapter with delay labels.", source: "Demo Market Adapter", timestamp: now, confidence: "reported", privacyClass: "public" }
      ];
      setSignals([...quakes, ...demos].sort((a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer); }, []);

  const visible = useMemo(() => signals.filter((s) => enabled.includes(s.type) && (s.type !== "earthquake" || (s.magnitude ?? 0) >= minMag) && (!localOnly || (s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= radiusKm))), [signals, enabled, minMag, localOnly, activeZone, radiusKm]);
  const selected = visible.find((s) => s.id === selectedId) ?? visible[0];
  const maxMag = visible.reduce((m, s) => Math.max(m, s.magnitude ?? 0), 0);
  const localHits = visible.filter((s) => s.lat !== undefined && s.lon !== undefined && distanceKm(activeZone.lat, activeZone.lon, s.lat, s.lon) <= radiusKm).length;

  function toggle(type: SignalType) { setEnabled((old) => old.includes(type) ? old.filter((t) => t !== type) : [...old, type]); }
  function useMyLocation() { navigator.geolocation?.getCurrentPosition((p) => setActiveZone({ name: "My Local Lens", lat: p.coords.latitude, lon: p.coords.longitude, radiusKm })); }

  return <main className="shell">
    <header className="header"><div className="brand"><div className="mark">⌂</div><div><div className="eyebrow">PARALLAX</div><h1>WATCHTOWER</h1><div className="subtitle">Real-time signal atlas & OSINT field ledger. See more. Know sooner. Act smarter.</div></div></div><div className="stats"><div className="stat"><strong>{visible.length}</strong><span>Visible signals</span></div><div className="stat"><strong>{localHits}</strong><span>Local radius hits</span></div><div className="stat"><strong>{maxMag.toFixed(1)}</strong><span>Max magnitude</span></div></div></header>
    <div className="status-strip"><span className="pill good">Field online</span><span className="pill">USGS feed {loading ? "loading" : "loaded"}</span><span className="pill">Lite Atlas mode</span></div>
    {error && <p className="error">{error}</p>}
    <section className="grid"><aside className="panel panel-pad"><h2 className="panel-title">Controls</h2><div className="control-group"><div className="label">Signal layers</div><div className="toggle-row">{(["earthquake", "news", "market"] as SignalType[]).map((t) => <button className={`toggle ${enabled.includes(t) ? "" : "off"}`} key={t} onClick={() => toggle(t)}>{t}</button>)}</div></div><div className="control-group"><div className="label">Minimum earthquake magnitude</div><input className="slider" type="range" min="0" max="7" step="0.1" value={minMag} onChange={(e) => setMinMag(Number(e.target.value))}/><p className="small">M {minMag.toFixed(1)}+</p></div><div className="control-group zone-card"><div className="label">Local lens</div><strong>{activeZone.name}</strong><p className="small">{activeZone.lat.toFixed(4)}, {activeZone.lon.toFixed(4)}</p><select className="toggle" value={activeZone.name} onChange={(e) => { const z = lenses.find((l) => l.name === e.target.value); if (z) { setActiveZone(z); setRadiusKm(z.radiusKm); } }}>{lenses.map((z) => <option key={z.name}>{z.name}</option>)}</select><div className="zone-row"><button className="btn" onClick={useMyLocation}>Use my location</button><button className="btn" onClick={() => setActiveZone(defaultZone)}>Reset Corning</button></div><label className="checkline"><input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)}/> show local radius only</label><input className="slider" type="range" min="25" max="900" step="25" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}/><p className="small">{radiusKm} km radius</p></div><ul className="boundary-list"><li>Consent-based location only</li><li>Public/official sources preferred</li><li>Receipts over hype</li><li>Correlation does not equal causation</li></ul></aside><section className="panel map-panel"><div className="map-head"><div><h2 className="panel-title">Lite Atlas Field Map</h2><div className="small">Canvas fallback: no external map tiles, Android-safe first.</div></div><div className="legend"><span className="badge verified_official">Verified official</span><span className="badge reported">Reported</span></div></div><div className="canvas-wrap"><span className="map-chip">{visible.filter((s) => s.lat !== undefined).length} mapped signals • tap marker for receipt</span><CanvasMap signals={visible} selectedId={selected?.id} onSelect={setSelectedId} zone={activeZone} radiusKm={radiusKm}/></div></section><aside className="panel panel-pad"><h2 className="panel-title">Signal Feed</h2><div className="feed-list">{visible.slice(0, 28).map((s) => <button key={s.id} className={`feed-item ${s.id === selected?.id ? "active" : ""}`} onClick={() => setSelectedId(s.id)}><div className="feed-title">{s.magnitude ? `M ${s.magnitude.toFixed(1)} - ` : ""}{s.title}</div><div className="small">{s.source} • {new Date(s.timestamp).toLocaleString()}</div><span className={`badge ${s.confidence}`}>{s.confidence.replace("_", " ")}</span></button>)}</div>{selected && <div className="receipt"><h2 className="panel-title">Event Receipt</h2><dl><dt>Title</dt><dd>{selected.title}</dd><dt>Source</dt><dd>{selected.source}</dd><dt>Time</dt><dd>{new Date(selected.timestamp).toLocaleString()}</dd><dt>Location</dt><dd>{selected.lat?.toFixed(4) ?? "unmapped"}, {selected.lon?.toFixed(4) ?? ""}</dd><dt>Magnitude</dt><dd>{selected.magnitude ?? "n/a"}</dd><dt>Depth</dt><dd>{selected.depthKm ?? "n/a"} km</dd><dt>Privacy</dt><dd>{selected.privacyClass}</dd><dt>Receipt</dt><dd>{selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank">Open source</a> : "demo record"}</dd></dl></div>}</aside></section>
  </main>;
}
