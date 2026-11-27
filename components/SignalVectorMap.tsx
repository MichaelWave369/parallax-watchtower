import { useEffect, useRef } from 'react';
import { Map as MapLibre, setWorkerCount, setWorkerUrl } from 'maplibre-gl';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { OPENFREE_MAP_STYLE } from '../lib/vectorMap.mjs';
import { projectMapPoint, wrapLongitude } from '../lib/mapGeometry.mjs';
import { WORLD_ATLAS } from '../lib/worldAtlas';
import type { MapStage, MapViewport } from './mapTypes';

// Vite must emit the real module worker. MapLibre's default import.meta.url
// lookup otherwise points at a nonexistent sibling of the application chunk.
setWorkerUrl(workerUrl);
setWorkerCount(2);
const bundledStyle: StyleSpecification = {
  version: 8, name: 'Bundled Natural Earth — public domain',
  sources: { countries: { type: 'geojson', data: WORLD_ATLAS } },
  layers: [
    { id: 'ocean', type: 'background', paint: { 'background-color': '#0c2334' } },
    { id: 'countries', type: 'fill', source: 'countries', paint: { 'fill-color': '#29494d' } },
    { id: 'boundaries', type: 'line', source: 'countries', paint: { 'line-color': '#7faaa4', 'line-width': 0.8 } }
  ]
};
type Props = { provider: 'openfreemap' | 'bundled'; attempt: number; view: MapViewport; onStage: (stage: MapStage) => void };

export function SignalVectorMap({ provider, attempt, view, onStage }: Props) {
  const divRef = useRef<HTMLDivElement>(null), mapRef = useRef<MapLibreMap | null>(null);
  const current = useRef({ view, onStage }); current.current = { view, onStage };
  useEffect(() => {
    const div = divRef.current; if (!div) return;
    let disposed = false, ready = false, failed = false;
    let map: MapLibreMap;
    const stage = (type: MapStage['type'], detail: Partial<MapStage> = {}) => { if (!disposed) current.current.onStage({ attempt, type, ...detail }); };
    const fail = (reason: string) => { if (!failed) { failed = true; stage('FAIL', { reason }); } };
    stage('STYLE_LOADING');
    try {
      map = new MapLibre({ container: div, style: provider === 'openfreemap' ? OPENFREE_MAP_STYLE : bundledStyle,
        center: [current.current.view.lon, current.current.view.lat], zoom: current.current.view.zoom,
        minZoom: -2, maxZoom: 12, pitch: 0, interactive: false, attributionControl: false,
        renderWorldCopies: true, transformConstrain: (center, zoom) => ({ center, zoom }), canvasContextAttributes: { preserveDrawingBuffer: true } });
    } catch (error) {
      fail(`WebGL initialization: ${error instanceof Error ? error.message : String(error)}`); return;
    }
    mapRef.current = map;
    const contextLost = (event: Event) => { event.preventDefault(); fail('WebGL context lost.'); };
    map.getCanvas().addEventListener('webglcontextlost', contextLost);
    map.on('error', event => fail(`${provider}: ${event.error?.message || 'MapLibre source or worker failure'}`));
    map.on('style.load', () => stage('STYLE_READY'));
    // A constructor, style.load, or empty background is not a usable basemap.
    // Only uncover GL after geographic source features have actually rendered.
    map.on('render', () => {
      const v=current.current.view, width=div.clientWidth, height=div.clientHeight;
      const expected=projectMapPoint(wrapLongitude(v.lon+30),0,v,width,height), actual=map.project([v.lon+30,0]);
      const alignment=expected ? Math.hypot(expected.x-actual.x,expected.y-actual.y) : Infinity;
      div.dataset.projectionError=String(alignment);
      if (ready || failed || disposed || !map.isStyleLoaded()) return;
      const layers = (map.getStyle()?.layers || []).filter(layer => layer.type !== 'background' && 'source' in layer).map(layer => layer.id);
      if (!layers.length) return;
      const count = map.queryRenderedFeatures(undefined, { layers }).filter(f => f.geometry.type !== 'Point').length;
      if (count > 0 && alignment < 0.5 && map.getCanvas().width > 0 && map.getCanvas().height > 0) {
        ready = true; div.dataset.geographicFeatures = String(count); div.dataset.workerUrl = workerUrl;
        stage('GEOGRAPHY_READY', { featureCount: count });
      }
    });
    const observer = new ResizeObserver(() => { if (!disposed) map.resize(); }); observer.observe(div);
    return () => {
      disposed = true; observer.disconnect(); map.getCanvas().removeEventListener('webglcontextlost', contextLost);
      mapRef.current = null; map.remove();
    };
  }, [provider, attempt]);
  useEffect(() => { mapRef.current?.jumpTo({ center: [view.lon, view.lat], zoom: view.zoom }); }, [view]);
  return <div className="vector-map" ref={divRef} aria-label={`${provider === 'openfreemap' ? 'OpenFreeMap' : 'Bundled Natural Earth'} vector geography`} />;
}
