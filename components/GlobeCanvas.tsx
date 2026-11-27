import { useEffect, useRef, useState } from 'react';
import { geoCircle, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { orthographicPoint } from '../lib/globeProjection.mjs';
import { clusterProjectedSignals, normalizeMapView } from '../lib/mapGeometry.mjs';
import { WORLD_ATLAS, WORLD_COUNTRIES } from '../lib/worldAtlas';
import type { AtlasSignal, MapViewport, WatchZone } from './mapTypes';
type Props = { signals: AtlasSignal[]; selectedId?: string; onSelect: (id: string) => void; zone: WatchZone;
  view?: MapViewport; onViewChange?: (view: MapViewport) => void; onCounts?: (counts: {eligible: number; visible: number; markers: number}) => void };
type Hit = { id: string; count: number; x: number; y: number; radius: number };
export function GlobeCanvas({ signals, selectedId, onSelect, zone, view, onViewChange, onCounts }: Props) {
  const ref = useRef<HTMLCanvasElement>(null), hits = useRef<Hit[]>([]);
  const [local, setLocal] = useState<MapViewport>({ lat: zone.lat, lon: zone.lon, zoom: 0 });
  const center = view || local;
  const change = (next: MapViewport) => onViewChange ? onViewChange(next) : setLocal(next);
  const drag = useRef<{x: number; y: number; view: MapViewport; moved: boolean} | null>(null);
  const current = useRef({ center, change }); current.current = { center, change };
  useEffect(() => {
    const canvas = ref.current, parent = canvas?.parentElement; if (!canvas || !parent) return;
    let frame = 0;
    const draw = () => {
      const { width, height } = parent.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const radius = Math.min(width, height) * 0.43 * 2 ** Math.max(-1, Math.min(5, center.zoom));
      const projection = geoOrthographic().rotate([-center.lon, -center.lat]).translate([width / 2, height / 2]).scale(radius).clipExtent([[0, 0], [width, height]]);
      const path = geoPath(projection, ctx);
      ctx.fillStyle = '#020b16'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#0c2334'; ctx.beginPath(); path({type: 'Sphere'}); ctx.fill();
      ctx.strokeStyle = '#315367'; ctx.lineWidth = 0.7; ctx.beginPath(); path(geoGraticule10()); ctx.stroke();
      ctx.fillStyle = '#29494d'; ctx.strokeStyle = '#7faaa4'; ctx.lineWidth = 0.8;
      for (const country of WORLD_COUNTRIES) { ctx.beginPath(); path(country); ctx.fill(); ctx.stroke(); }
      ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const occupied: {x: number; y: number; width: number}[] = [];
      for (const country of [...WORLD_COUNTRIES].sort((a,b)=>a.properties.rank-b.properties.rank)) {
        const [lon, lat] = country.properties.label;
        if (country.properties.rank > 3 || !orthographicPoint(lat, lon, center.lat, center.lon)) continue;
        const p = projection([lon, lat]); if (!p || p[0] < 20 || p[0] > width - 20 || p[1] < 25 || p[1] > height - 35) continue;
        const labelWidth = ctx.measureText(country.properties.name).width;
        if(occupied.some(item=>Math.abs(item.y-p[1])<15 && Math.abs(item.x-p[0])<(item.width+labelWidth)/2+4)) continue;
        occupied.push({x:p[0],y:p[1],width:labelWidth});
        ctx.strokeStyle = '#102b34'; ctx.lineWidth = 3; ctx.strokeText(country.properties.name, ...p);
        ctx.fillStyle = '#c9dbcc'; ctx.fillText(country.properties.name, ...p);
      }
      const selected = signals.find(s => s.id === selectedId);
      if (selected?.type === 'news' && selected.radiusKm && typeof selected.lon === 'number' && typeof selected.lat === 'number') {
        ctx.beginPath(); path(geoCircle().center([selected.lon, selected.lat]).radius(Math.min(180, selected.radiusKm / 111.2))());
        ctx.fillStyle = '#70d7dd19'; ctx.strokeStyle = '#7bf3ed'; ctx.setLineDash([3, 5]); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
      const result = clusterProjectedSignals(signals, (lon: number, lat: number) => {
        if (!orthographicPoint(lat, lon, center.lat, center.lon)) return null;
        const p = projection([lon, lat]); return p ? {x: p[0], y: p[1]} : null;
      }, width, height, {selectedId});
      hits.current = result.markers;
      for (const m of result.markers) {
        ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = m.selected ? '#ff83bc' : m.count > 1 ? '#176d77' : m.type === 'earthquake' ? '#ffd365' : m.type === 'wildfire' ? '#ff884d' : '#54e8e4'; ctx.fill();
        ctx.strokeStyle = m.selected ? '#ffffff' : '#8bebe2'; ctx.lineWidth = m.selected ? 2.5 : 1; ctx.stroke();
        if (m.count > 1) { ctx.fillStyle = '#f4ffff'; ctx.font = 'bold 11px system-ui'; ctx.fillText(String(m.count), m.x, m.y); }
      }
      ctx.strokeStyle = '#7defff'; ctx.lineWidth = 1.2; ctx.beginPath(); path({type: 'Sphere'}); ctx.stroke();
      canvas.dataset.countryCount = String(WORLD_ATLAS.features.length); canvas.dataset.geographyPainted = 'true';
      canvas.dataset.eligibleCount = String(result.eligibleCount); canvas.dataset.visibleCount = String(result.visibleCount); canvas.dataset.markerCount = String(result.markers.length);
      onCounts?.({eligible: result.eligibleCount, visible: result.visibleCount, markers: result.markers.length});
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const observer = new ResizeObserver(schedule); observer.observe(parent); schedule();
    const wheel = (event: WheelEvent) => { event.preventDefault(); const c = current.current; c.change(normalizeMapView({...c.center, zoom: c.center.zoom + Math.max(-0.5, Math.min(0.5, -event.deltaY / 350))})); };
    canvas.addEventListener('wheel', wheel, {passive: false});
    return () => { observer.disconnect(); cancelAnimationFrame(frame); canvas.removeEventListener('wheel', wheel); };
  }, [signals, selectedId, center, onCounts]);
  return <canvas ref={ref} className="geographic-globe" role="img" tabIndex={0} aria-label="Interactive orthographic globe with country boundaries and public signal markers. Drag to rotate, wheel to zoom."
    onPointerDown={e => { drag.current = {x: e.clientX, y: e.clientY, view: center, moved: false}; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { const d = drag.current; if (!d) return; const r = e.currentTarget.getBoundingClientRect(), k = 180 / Math.max(300, Math.min(r.width, r.height)) / 2 ** Math.max(0, center.zoom);
      const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) change(normalizeMapView({...d.view, lon: d.view.lon - dx * k, lat: d.view.lat + dy * k})); }}
    onPointerUp={e => { const d = drag.current; drag.current = null; if (!d || d.moved) return;
      const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const m = hits.current.map(h => ({...h, distance: Math.hypot(x - h.x, y - h.y)})).filter(h => h.distance < h.radius + 8).sort((a, b) => a.distance - b.distance)[0];
      if (m) { onSelect(m.id); if (m.count > 1) change(normalizeMapView({...center, zoom: center.zoom + 1})); } }}
    onPointerCancel={() => { drag.current = null; }}
    onKeyDown={e => { const delta: Record<string, [number, number]> = {ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10]};
      if (delta[e.key]) { e.preventDefault(); const [lon, lat] = delta[e.key]; change(normalizeMapView({...center, lon: center.lon + lon, lat: center.lat + lat})); }
      else if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); change(normalizeMapView({...center, zoom: center.zoom + (e.key === '-' ? -1 : 1)})); }
      else if (e.key === 'Enter' && hits.current[0]) onSelect(hits.current[0].id);
    }} style={{touchAction: 'none', cursor: 'grab'}} />;
}
