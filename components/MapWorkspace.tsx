import { lazy, Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { GeographicAtlas } from './GeographicAtlas';
import { GlobeCanvas } from './GlobeCanvas';
import { MapRenderBoundary } from './MapRenderBoundary';
import { initialMapState, mapLifecycle, MAP_ATTEMPT_TIMEOUT_MS } from '../lib/mapLifecycle.mjs';
import { globalMapView, watchZoneMapView, normalizeMapView } from '../lib/mapGeometry.mjs';
import type { AtlasSignal, MapStage, MapViewport, WatchZone } from './mapTypes';
const SignalVectorMap = lazy(() => import('./SignalVectorMap').then(m => ({ default: m.SignalVectorMap })));
export type MapMode = 'map' | 'globe' | 'lite';
type Counts = { eligible: number; visible: number; markers: number };
type Props = { signals: AtlasSignal[]; selectedId?: string; onSelect: (id: string) => void; zone: WatchZone; radiusKm: number;
  mode: MapMode; onModeChange: (mode: MapMode) => void; view: MapViewport; onViewChange: (view: MapViewport) => void };
export function MapWorkspace(props: Props) {
  const { signals, selectedId, onSelect, zone, radiusKm, view, onViewChange, mode, onModeChange } = props;
  const [state, dispatch] = useReducer((previous: ReturnType<typeof initialMapState>, event: {type: string; attempt?: number; reason?: string; featureCount?: number}) => mapLifecycle(previous, event), initialMapState());
  const stateRef = useRef(state); stateRef.current = state;
  const [counts, setCounts] = useState<Counts>({ eligible: 0, visible: 0, markers: 0 });
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement>(null), canvasWrapRef = useRef<HTMLDivElement>(null);
  const onCounts = useCallback((next: Counts) => setCounts(old => old.eligible === next.eligible && old.visible === next.visible && old.markers === next.markers ? old : next), []);
  const onStage = useCallback((event: MapStage) => dispatch(event), []);
  useEffect(() => { dispatch({ type: mode === 'map' ? 'START' : mode === 'globe' ? 'GLOBE' : 'OFFLINE' }); }, [mode]);
  useEffect(() => {
    if (!['initializing', 'loading_style', 'loading_geography'].includes(state.phase)) return;
    const timer = window.setTimeout(() => {
      if (stateRef.current.attempt === state.attempt && ['initializing', 'loading_style', 'loading_geography'].includes(stateRef.current.phase))
        dispatch({ type: 'FAIL', attempt: state.attempt, reason: `${state.provider}: geographic rendering exceeded ${MAP_ATTEMPT_TIMEOUT_MS / 1000}s.` });
    }, MAP_ATTEMPT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
    // One deadline per attempt, including the lazy module and worker initialization.
  }, [state.attempt]);
  useEffect(() => {
    if (!['degraded', 'recovering'].includes(state.phase)) return;
    const timer = window.setTimeout(() => dispatch({ type: state.phase === 'degraded' ? 'RECOVER' : 'NEXT', attempt: state.attempt }), 150);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.attempt]);
  useEffect(() => { const changed = () => { if (!document.fullscreenElement) setExpanded(false); }; document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed); }, []);
  const vectorActive = state.renderer === 'vector', globeActive = state.renderer === 'globe';
  const running = ['initializing', 'loading_style', 'loading_geography', 'ready'].includes(state.phase) && ['openfreemap', 'bundled'].includes(state.provider);
  const actualMode = globeActive ? 'globe' : vectorActive ? 'map' : 'lite';
  function choose(next: MapMode) { if (next === mode) dispatch({ type: next === 'map' ? 'START' : next === 'globe' ? 'GLOBE' : 'OFFLINE' }); else onModeChange(next); }
  function dimensions() { const r = canvasWrapRef.current?.getBoundingClientRect(); return [r?.width || 700, r?.height || 520] as const; }
  function fullscreen() {
    if (document.fullscreenElement) { void document.exitFullscreen(); setExpanded(false); }
    else { setExpanded(!expanded); if (!expanded) void panelRef.current?.requestFullscreen?.().catch(() => { /* CSS expansion is also supported. */ }); }
  }
  const atlasProps = { signals, selectedId, onSelect, zone, radiusKm, view, onViewChange };
  return <section ref={panelRef} className={`panel map-panel cartographer ${expanded ? 'map-expanded' : ''}`} data-map-state={state.phase} data-map-provider={state.provider} data-map-renderer={state.renderer} data-map-view={`${view.lon.toFixed(5)},${view.lat.toFixed(5)},${view.zoom.toFixed(5)}`}>
    <div className="map-head"><div><h2 className="panel-title">{globeActive ? 'Global Earth Lens' : vectorActive ? 'Vector Map · Clustered Signals' : 'Lite Atlas · Geographic World'}</h2>
      <div className="small">{globeActive ? 'Country outlines and public signals. Drag to rotate; select markers for receipts.' : 'Country outlines · geographic reference labels · drag to pan · wheel to zoom · select markers for receipts.'}</div>
      <div className="toggle-row" role="group" aria-label="Map display mode">{(['map', 'globe', 'lite'] as const).map(next => <button key={next} className={`toggle ${actualMode === next ? '' : 'off'}`} aria-pressed={actualMode === next} onClick={() => choose(next)}>{next === 'map' ? 'Map' : next === 'globe' ? 'Globe' : 'Lite'}</button>)}</div>
    </div></div>
    <div className="map-toolbar" role="group" aria-label="Geographic map controls">
      <button className="btn" aria-label="Zoom in" onClick={() => onViewChange(normalizeMapView({ ...view, zoom: view.zoom + 1 }))}>+</button>
      <button className="btn" aria-label="Zoom out" onClick={() => onViewChange(normalizeMapView({ ...view, zoom: view.zoom - 1 }))}>−</button>
      <button className="btn" onClick={() => onViewChange(globalMapView(...dimensions()))}>Global view</button>
      <button className="btn" onClick={() => onViewChange(watchZoneMapView(zone, radiusKm, ...dimensions()))}>Local view</button>
      <button className="btn" onClick={fullscreen}>{expanded ? 'Exit fullscreen' : 'Fullscreen map'}</button>
      <button className="btn" onClick={() => choose('map')}>Retry vector map</button>
    </div>
    <div className="map-health" role="status" aria-live="polite"><strong>{state.phase.replaceAll('_', ' ')}</strong> · Active: {globeActive ? 'geographic globe' : vectorActive ? state.provider === 'openfreemap' ? 'OpenFreeMap vector' : 'bundled Natural Earth vector' : 'offline geographic atlas'}. {state.reason}</div>
    <div className="canvas-wrap" ref={canvasWrapRef}>
      {globeActive ? <GlobeCanvas signals={signals} selectedId={selectedId} onSelect={onSelect} zone={zone} view={view} onViewChange={onViewChange} onCounts={onCounts} /> : <>
        <GeographicAtlas layer="geography" {...atlasProps} />
        {running && <div className={`vector-geography ${vectorActive ? 'geography-ready' : ''}`} aria-hidden={!vectorActive} style={{clipPath: `inset(0 max(0px, calc(50% - ${256 * 2 ** view.zoom}px)))`}}>
          <MapRenderBoundary key={state.attempt} onCrash={error => dispatch({ type: 'FAIL', attempt: state.attempt, reason: `Vector module: ${error.message}` })}>
            <Suspense fallback={null}><SignalVectorMap provider={state.provider as 'openfreemap' | 'bundled'} attempt={state.attempt} view={view} onStage={onStage} /></Suspense>
          </MapRenderBoundary>
        </div>}
        <GeographicAtlas layer="signals" referenceLabels={vectorActive && state.provider === 'bundled'} {...atlasProps} onCounts={onCounts} />
      </>}
      <span className="map-chip">{counts.eligible} mapped source signals · {counts.visible} in view · {counts.markers} markers / clusters</span>
      <div className="map-attribution">{vectorActive && state.provider === 'openfreemap' && <><a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> · </>}<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth · public domain</a></div>
    </div>
    <p className="map-precision small">Generalized country boundaries for context. Dashed news areas show published geographic uncertainty; they are not precise incident locations. Layer filters and receipts remain active in every renderer.</p>
    {state.diagnostics.length > 0 && <details className="map-diagnostics"><summary>Map diagnostics ({state.diagnostics.length})</summary><ul>{state.diagnostics.map((d: {attempt: number; provider: string; reason: string}, i: number) => <li key={`${d.attempt}-${i}`}>{d.provider}, attempt {d.attempt}: {d.reason}</li>)}</ul></details>}
  </section>;
}
