export type MapViewport = { lon: number; lat: number; zoom: number };
export type AtlasSignal = { id: string; type: string; title?: string; source?: string; lat?: number; lon?: number; magnitude?: number; radiusKm?: number; confidence?: string; locationLabel?: string; privacyClass: 'public' | 'consent_based' | 'private_local' };
export type WatchZone = { name?: string; lat: number; lon: number; radiusKm?: number };
export type MapStage = { attempt: number; type: 'STYLE_LOADING' | 'STYLE_READY' | 'GEOGRAPHY_READY' | 'FAIL'; reason?: string; featureCount?: number };
