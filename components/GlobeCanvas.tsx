import { useEffect, useRef, useState } from "react";
import { orthographicPoint } from "../lib/globeProjection.mjs";

type GlobeSignal = { id: string; type: string; lat?: number; lon?: number; magnitude?: number };
type Props = {
  signals: GlobeSignal[];
  selectedId?: string;
  onSelect: (id: string) => void;
  zone: { lat: number; lon: number };
};

export function GlobeCanvas({ signals, selectedId, onSelect, zone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitsRef = useRef<{ id: string; x: number; y: number; radius: number }[]>([]);
  const dragRef = useRef<{ x: number; y: number; lat: number; lon: number; moved: boolean } | null>(null);
  const [center, setCenter] = useState({ lat: zone.lat, lon: zone.lon });

  useEffect(() => setCenter({ lat: zone.lat, lon: zone.lon }), [zone.lat, zone.lon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    let width = 1, height = 1;
    const draw = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = width / 2, cy = height / 2;
      const radius = Math.max(1, Math.min(width, height) * 0.43);
      ctx.fillStyle = "#020b16";
      ctx.fillRect(0, 0, width, height);
      const atmosphere = ctx.createRadialGradient(cx, cy, radius * 0.83, cx, cy, radius * 1.22);
      atmosphere.addColorStop(0, "rgba(35,210,242,0.03)");
      atmosphere.addColorStop(0.72, "rgba(35,210,242,0.15)");
      atmosphere.addColorStop(1, "rgba(35,210,242,0)");
      ctx.fillStyle = atmosphere;
      ctx.beginPath(); ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2); ctx.fill();
      const ocean = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.48, radius * 0.05, cx, cy, radius);
      ocean.addColorStop(0, "#1c6881");
      ocean.addColorStop(0.5, "#0b3651");
      ocean.addColorStop(1, "#041522");
      ctx.fillStyle = ocean;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();

      function graticule(points: { lat: number; lon: number }[]) {
        ctx.beginPath(); let drawing = false;
        for (const point of points) {
          const p = orthographicPoint(point.lat, point.lon, center.lat, center.lon);
          if (!p) { drawing = false; continue; }
          if (!drawing) ctx.moveTo(cx + p.x * radius, cy + p.y * radius);
          else ctx.lineTo(cx + p.x * radius, cy + p.y * radius);
          drawing = true;
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(120,230,245,0.28)";
      ctx.lineWidth = 0.85;
      for (let lat = -60; lat <= 60; lat += 30) {
        const points = [];
        for (let lon = -180; lon <= 180; lon += 2) points.push({ lat, lon });
        graticule(points);
      }
      for (let lon = -180; lon < 180; lon += 30) {
        const points = [];
        for (let lat = -90; lat <= 90; lat += 2) points.push({ lat, lon });
        graticule(points);
      }
      const hits: { id: string; x: number; y: number; radius: number }[] = [];
      // Visual markers are only rendered for public, geocoded source records.
      for (const signal of signals.slice(0, 1500)) {
        if (signal.lat === undefined || signal.lon === undefined) continue;
        const p = orthographicPoint(signal.lat, signal.lon, center.lat, center.lon);
        if (!p) continue;
        const x = cx + p.x * radius, y = cy + p.y * radius;
        const selected = signal.id === selectedId;
        const color = selected ? "#ff8ad2" : signal.type === "wildfire" ? "#ff8a38"
          : signal.type === "earthquake" ? "#ffcd70" : signal.type === "news" ? "#70e7ff" : "#82e4bc";
        const size = selected ? 7 : Math.min(6, Math.max(2.4, (signal.magnitude ?? 1) * 1.2));
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = selected ? 18 : 8;
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        hits.push({ id: signal.id, x, y, radius: Math.max(13, size + 7) });
      }
      hitsRef.current = hits;
      ctx.restore();
      ctx.strokeStyle = "rgba(125,239,255,0.65)";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#a7d9e4";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("DRAG TO ROTATE · ORTHOGRAPHIC PROJECTION", cx, Math.min(height - 18, cy + radius + 29));
    };
    draw();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(draw) : null;
    observer?.observe(parent);
    return () => observer?.disconnect();
  }, [signals, selectedId, center]);

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY, lat: center.lat, lon: center.lon, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sensitivity = 180 / Math.max(300, Math.min(rect.width, rect.height));
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const lon = ((((drag.lon - dx * sensitivity) + 180) % 360) + 360) % 360 - 180;
    setCenter({ lat: Math.min(85, Math.max(-85, drag.lat + dy * sensitivity)), lon });
  }
  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const match = hitsRef.current.map((hit) => ({ ...hit, distance: Math.hypot(x - hit.x, y - hit.y) }))
      .filter((hit) => hit.distance <= hit.radius).sort((a, b) => a.distance - b.distance)[0];
    if (match) onSelect(match.id);
  }
  return <canvas ref={canvasRef} role="img" aria-label="Interactive orthographic globe of mapped public signals. Drag to rotate and select visible event markers." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragRef.current = null; }} style={{ touchAction: "none", cursor: "grab" }}/>;
}
