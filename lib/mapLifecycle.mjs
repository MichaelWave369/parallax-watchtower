// Attempt-scoped state machine. Rendering is derived from this state, never log text.
export const MAP_PHASES = Object.freeze(['initializing', 'loading_style', 'loading_geography', 'ready', 'degraded', 'recovering', 'offline_atlas']);
export const MAP_ATTEMPT_TIMEOUT_MS = 10000;
export function initialMapState() {
  return { phase: 'offline_atlas', provider: 'offline', attempt: 0, renderer: 'offline', reason: 'Bundled geographic atlas', diagnostics: [] };
}
export function mapLifecycle(state, event) {
  if (!event || typeof event.type !== 'string') return state;
  if (event.type === 'START') return { ...state, phase: 'initializing', provider: 'openfreemap', attempt: state.attempt + 1, renderer: 'offline', reason: 'Initializing vector renderer; bundled geography remains visible.' };
  if (event.type === 'OFFLINE') return state.phase === 'offline_atlas' ? state : { ...state, phase: 'offline_atlas', provider: 'offline', attempt: state.attempt + 1, renderer: 'offline', reason: event.reason || 'Bundled geographic atlas selected.' };
  if (event.type === 'GLOBE') return { ...state, phase: 'ready', provider: 'globe', attempt: state.attempt + 1, renderer: 'globe', reason: 'Bundled geographic globe.' };
  if (event.attempt !== state.attempt || state.provider === 'offline' || state.provider === 'globe') return state;
  if (event.type === 'STYLE_LOADING' && state.phase === 'initializing') return { ...state, phase: 'loading_style', reason: 'Loading vector style; bundled geography remains visible.' };
  if (event.type === 'STYLE_READY' && ['initializing', 'loading_style'].includes(state.phase)) return { ...state, phase: 'loading_geography', reason: 'Waiting for rendered geographic features; bundled geography remains visible.' };
  if (event.type === 'GEOGRAPHY_READY' && ['initializing', 'loading_style', 'loading_geography'].includes(state.phase) && event.featureCount > 0) return { ...state, phase: 'ready', renderer: 'vector', reason: `${state.provider === 'openfreemap' ? 'OpenFreeMap' : 'Bundled Natural Earth vector'} geography rendered.` };
  if (event.type === 'FAIL' && !['degraded', 'recovering', 'offline_atlas'].includes(state.phase)) {
    const reason = String(event.reason || 'Vector renderer unavailable.').slice(0, 600);
    return { ...state, phase: 'degraded', renderer: 'offline', reason,
      diagnostics: [...state.diagnostics, { attempt: state.attempt, provider: state.provider, reason }].slice(-12) };
  }
  if (event.type === 'RECOVER' && state.phase === 'degraded') return { ...state, phase: 'recovering', renderer: 'offline', reason: state.provider === 'openfreemap' ? 'Recovering with independent bundled vector geography.' : 'Recovering to the geographic Canvas atlas.' };
  if (event.type === 'NEXT' && state.phase === 'recovering') {
    if (state.provider === 'openfreemap') return { ...state, phase: 'initializing', provider: 'bundled', attempt: state.attempt + 1, renderer: 'offline', reason: 'Initializing independent bundled vector geography.' };
    return { ...state, phase: 'offline_atlas', provider: 'offline', attempt: state.attempt + 1, renderer: 'offline', reason: 'Vector attempts exhausted. Bundled geographic atlas is active.' };
  }
  return state;
}
