// Local user lenses only. Invalid persisted coordinates never reach a renderer.
export const WATCH_ZONE_MAX_RADIUS_KM = 20000;
/** @typedef {{name:string,lat:number,lon:number,radiusKm:number,source:'saved'}} SavedWatchZone */
/**
 * @param {{name?:unknown,lat?:unknown,lon?:unknown,radiusKm?:unknown}|null|undefined} value
 * @returns {SavedWatchZone|null}
 */
export function normalizeWatchZone(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const {lat,lon,radiusKm}=value;
  const name=typeof value.name==='string'?value.name.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80):'';
  if (!name || typeof lat!=='number' || !Number.isFinite(lat) || Math.abs(lat)>90 ||
      typeof lon!=='number' || !Number.isFinite(lon) || Math.abs(lon)>180 ||
      typeof radiusKm!=='number' || !Number.isFinite(radiusKm) || radiusKm<=0 || radiusKm>WATCH_ZONE_MAX_RADIUS_KM) return null;
  return {name,lat,lon,radiusKm,source:'saved'};
}
/** @param {string|null} raw @returns {SavedWatchZone[]} */
export function readSavedWatchZones(raw) {
  try {
    const input=JSON.parse(raw??'[]');
    if(!Array.isArray(input))return [];
    const zones=[], names=new Set();
    for(const value of input.slice(-100)) {
      const zone=normalizeWatchZone(value);
      if(!zone || names.has(zone.name))continue;
      zones.push(zone);names.add(zone.name);
    }
    return zones.slice(-12);
  }catch{return [];}
}
