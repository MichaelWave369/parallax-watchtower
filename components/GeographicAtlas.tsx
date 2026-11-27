import { useEffect, useRef } from 'react';
import { geoEquirectangular, geoGraticule10, geoMercator, geoPath } from 'd3-geo';
import { WORLD_ATLAS, WORLD_COUNTRIES } from '../lib/worldAtlas';
import { clusterMapSignals, invertMapPoint, mapKmPerPixel, panMapView, projectMapPoint, zoomMapView } from '../lib/mapGeometry.mjs';
import type { AtlasSignal, MapViewport, WatchZone } from './mapTypes';

type Props = {
  referenceLabels?: boolean; layer: 'geography' | 'signals'; signals: AtlasSignal[]; selectedId?: string; view: MapViewport;
  zone: WatchZone; radiusKm: number; onSelect: (id: string) => void; onViewChange: (view: MapViewport) => void;
  onCounts?: (counts: { eligible: number; visible: number; markers: number }) => void;
};
const signalColor = (type: string) => type === 'earthquake' ? '#ffd365' : type === 'wildfire' ? '#ff884d' : type === 'orbit' ? '#88b5ff' : type === 'satellite' ? '#c3a9ff' : '#54e8e4';
type Marker = { id: string; ids: string[]; x: number; y: number; radius: number; count: number; selected: boolean; type: string };

// Geography is always bundled and mounted. The independent signal layer survives
// every provider/worker/WebGL transition and provides the shared camera controls.
export function GeographicAtlas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const hits = useRef<Marker[]>([]);
  const drag = useRef<{ x: number; y: number; view: MapViewport; moved: boolean } | null>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; view: MapViewport; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current, parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    let frame = 0;
    function draw() {
      if (!canvas || !parent) return;
      const { layer, signals, selectedId, view, zone, radiusKm, onCounts } = propsRef.current;
      const rect = parent.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      if (layer === 'geography') {
        ctx.fillStyle = '#0c2334'; ctx.fillRect(0, 0, width, height);
        const projection = geoMercator().scale(512 * 2 ** view.zoom / (2 * Math.PI)).translate([width / 2, height / 2])
          .rotate([-view.lon, 0]).center([0, view.lat]).clipExtent([[0, 0], [width, height]]);
        const path = geoPath(projection, ctx);
        ctx.strokeStyle = '#244959'; ctx.lineWidth = 0.6; ctx.beginPath(); path(geoGraticule10()); ctx.stroke();
        ctx.fillStyle = '#29494d'; ctx.strokeStyle = '#7faaa4'; ctx.lineWidth = 0.8;
        for (const country of WORLD_COUNTRIES) { ctx.beginPath(); path(country); ctx.fill(); ctx.stroke(); }
        // Only basemap reference positions are used for these names, never event coordinates.
        ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const occupied: { x: number; y: number; width: number }[] = [];
        for (const country of [...WORLD_COUNTRIES].sort((a, b) => a.properties.rank - b.properties.rank)) {
          if (country.properties.rank > (view.zoom < 0.5 ? 3 : view.zoom < 2 ? 4 : 6)) continue;
          const p = projection(country.properties.label); if (!p || p[0] < 24 || p[0] > width - 24 || p[1] < 20 || p[1] > height - 30) continue;
          const textWidth = ctx.measureText(country.properties.name).width;
          if (occupied.some(item => Math.abs(item.y - p[1]) < 15 && Math.abs(item.x - p[0]) < (item.width + textWidth) / 2 + 4)) continue;
          occupied.push({ x: p[0], y: p[1], width: textWidth });
          ctx.strokeStyle = '#102b34'; ctx.lineWidth = 3; ctx.strokeText(country.properties.name, p[0], p[1]);
          ctx.fillStyle = '#c9dbcc'; ctx.fillText(country.properties.name, p[0], p[1]);
        }
        canvas.dataset.countryCount = String(WORLD_ATLAS.features.length);
        canvas.dataset.geographyPainted = 'true';
        return;
      }
      if (propsRef.current.referenceLabels) {
        const projection = geoMercator().scale(512 * 2 ** view.zoom / (2 * Math.PI)).translate([width / 2, height / 2]).rotate([-view.lon, 0]).center([0, view.lat]);
        const occupied: { x: number; y: number; width: number }[] = [];
        ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const country of [...WORLD_COUNTRIES].sort((a,b)=>a.properties.rank-b.properties.rank)) {
          if (country.properties.rank > (view.zoom < 0.5 ? 3 : view.zoom < 2 ? 4 : 6)) continue;
          const p=projection(country.properties.label); if(!p || p[0]<24 || p[0]>width-24 || p[1]<20 || p[1]>height-30) continue;
          const w=ctx.measureText(country.properties.name).width;
          if(occupied.some(o=>Math.abs(o.y-p[1])<15 && Math.abs(o.x-p[0])<(o.width+w)/2+4)) continue;
          occupied.push({x:p[0],y:p[1],width:w}); ctx.strokeStyle='#102b34';ctx.lineWidth=3;ctx.strokeText(country.properties.name,...p);ctx.fillStyle='#c9dbcc';ctx.fillText(country.properties.name,...p);
        }
      }
      const result = clusterMapSignals(signals, view, width, height, { selectedId });
      hits.current = result.markers;
      canvas.dataset.eligibleCount = String(result.eligibleCount); canvas.dataset.visibleCount = String(result.visibleCount); canvas.dataset.markerCount = String(result.markers.length);
      const zonePoint = projectMapPoint(zone.lon, zone.lat, view, width, height);
      if (zonePoint) {
        ctx.strokeStyle = '#71d9d0'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
        const radius = Math.max(2, Math.min(3000, radiusKm / mapKmPerPixel(zone.lat, view.zoom)));
        ctx.beginPath(); ctx.arc(zonePoint.x, zonePoint.y, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#b7fff1'; ctx.fillRect(zonePoint.x - 2, zonePoint.y - 2, 4, 4);
      }
      // Published uncertainty is an area, never an invented exact event coordinate.
      const selected = signals.find(row => row.id === selectedId);
      canvas.dataset.uncertaintyRadiusKm = selected?.type === 'news' && selected.radiusKm ? String(selected.radiusKm) : '0';
      if (selected?.type === 'news' && Number.isFinite(selected.radiusKm) && selected.radiusKm! > 0 && Number.isFinite(selected.lat) && Number.isFinite(selected.lon)) {
        const p = projectMapPoint(selected.lon, selected.lat, view, width, height);
        if (p) { const r = Math.min(2500, selected.radiusKm! / mapKmPerPixel(selected.lat, view.zoom)); ctx.setLineDash([3, 5]); ctx.strokeStyle = '#7bf3ed'; ctx.fillStyle = '#70d7dd19'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
      }
      // Generalized data cannot supply street detail at high zoom. Keep a real
      // world overview visible even over an ocean or country interior.
      if (view.zoom > 2) {
        const left=12, top=height-116, w=150, h=86;
        ctx.fillStyle='#0c2334';ctx.fillRect(left,top,w,h);ctx.strokeStyle='#7faaa4';ctx.lineWidth=1;ctx.strokeRect(left,top,w,h);
        const overview=geoEquirectangular().scale(w/(2*Math.PI)).translate([left+w/2,top+h/2]), path=geoPath(overview,ctx);
        ctx.fillStyle='#29494d';ctx.strokeStyle='#7faaa4';ctx.lineWidth=0.4;ctx.beginPath();path(WORLD_ATLAS);ctx.fill();ctx.stroke();
        const p=overview([view.lon,view.lat]);if(p){ctx.fillStyle='#ff83bc';ctx.beginPath();ctx.arc(...p,3,0,Math.PI*2);ctx.fill();}
        ctx.fillStyle='#d1e8df';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText('World context',left+5,top+12);
      }
      for (const marker of result.markers) {
        ctx.beginPath(); ctx.arc(marker.x, marker.y, marker.radius, 0, Math.PI * 2);
        ctx.fillStyle = marker.selected ? '#ff83bc' : marker.count > 1 ? '#176d77' : signalColor(marker.type); ctx.fill();
        ctx.strokeStyle = marker.selected ? '#ffffff' : marker.count > 1 ? '#8bebe2' : '#061a27'; ctx.lineWidth = marker.selected ? 2.5 : 1.2; ctx.stroke();
        if (marker.count > 1) { ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#f4ffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(marker.count), marker.x, marker.y); }
      }
      onCounts?.({ eligible: result.eligibleCount, visible: result.visibleCount, markers: result.markers.length });
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); }
    const observer = new ResizeObserver(schedule); observer.observe(parent);
    canvas.addEventListener('atlaspaint', schedule);
    schedule();
    const wheel = (event: WheelEvent) => {
      if (propsRef.current.layer !== 'signals') return;
      event.preventDefault(); const rect = canvas.getBoundingClientRect();
      propsRef.current.onViewChange(zoomMapView(propsRef.current.view, Math.max(-0.5, Math.min(0.5, -event.deltaY / 350)), event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('atlaspaint', schedule); };
  }, [props.layer]);

  // ResizeObserver covers layout changes; this signal schedules actual data/camera paints.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    // A local resize event does not recreate the rendering surface or fetch anything.
    canvas.dispatchEvent(new Event('atlaspaint'));
  }, [props.view, props.signals, props.selectedId, props.zone.lat, props.zone.lon, props.radiusKm, props.referenceLabels]);

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    if (props.layer !== 'signals') return;
    const rect = event.currentTarget.getBoundingClientRect(), point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    points.current.set(event.pointerId, point); event.currentTarget.setPointerCapture(event.pointerId);
    if (points.current.size === 1) drag.current = { ...point, view: props.view, moved: false };
    if (points.current.size === 2) { const [a, b] = [...points.current.values()]; pinch.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view: props.view, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!points.current.has(event.pointerId)) return;
    const rect = event.currentTarget.getBoundingClientRect(), point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    points.current.set(event.pointerId, point);
    if (points.current.size >= 2 && pinch.current) {
      const [a, b] = [...points.current.values()], p = pinch.current;
      props.onViewChange(zoomMapView(p.view, Math.log2(Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) / p.distance), p.x, p.y, rect.width, rect.height));
      if (drag.current) drag.current.moved = true;
    } else if (drag.current) {
      const d = drag.current, dx = point.x - d.x, dy = point.y - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) props.onViewChange(panMapView(d.view, dx, dy));
    }
  }
  function up(event: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current; points.current.delete(event.pointerId); pinch.current = null;
    if (points.current.size) { drag.current = null; return; }
    drag.current = null; if (!d || d.moved) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    const match = hits.current.map(h => ({ ...h, distance: Math.hypot(x - h.x, y - h.y) })).filter(h => h.distance <= h.radius + 8).sort((a, b) => a.distance - b.distance)[0];
    if (!match) return;
    if (match.count === 1) props.onSelect(match.id);
    else {
      props.onSelect(match.id);
      const center = invertMapPoint(match.x, match.y, props.view, rect.width, rect.height);
      props.onViewChange({ ...center, zoom: Math.min(12, props.view.zoom + 1.5) });
    }
  }
  const label = props.layer === 'geography' ? 'Lite Atlas geographic world map with Natural Earth continental outlines and country boundaries; no external map tiles' : 'Interactive public signal markers. Drag to pan, wheel or plus and minus to zoom, arrow keys to pan, Enter to select a visible signal.';
  return <canvas ref={canvasRef} className={`geographic-atlas-${props.layer}`} role="img" aria-label={label}
    tabIndex={props.layer === 'signals' ? 0 : undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up}
    onPointerCancel={() => { points.current.clear(); drag.current = null; pinch.current = null; }}
    onKeyDown={event => {
      if (props.layer !== 'signals') return;
      const direction: Record<string, [number, number]> = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
      if (direction[event.key]) { event.preventDefault(); props.onViewChange(panMapView(props.view, ...direction[event.key])); }
      else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); props.onViewChange(zoomMapView(props.view, event.key === '-' ? -1 : 1, rect.width / 2, rect.height / 2, rect.width, rect.height)); }
      else if (event.key === 'Enter' && hits.current.length) { event.preventDefault(); props.onSelect(hits.current[0].id); }
    }} />;
}
