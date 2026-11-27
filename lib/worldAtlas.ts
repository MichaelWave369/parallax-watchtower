import { geoArea } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import data from './data/world-atlas.v1.json';
export type CountryProperties = { name: string; iso3: string; label: [number, number]; rank: number };
export const WORLD_ATLAS = data as unknown as FeatureCollection<Geometry, CountryProperties>;
export const WORLD_COUNTRIES = WORLD_ATLAS.features;
// Checked when packaging too; this guard does not depend on an external request.
export const WORLD_ATLAS_VALID = WORLD_COUNTRIES.length >= 170 && WORLD_COUNTRIES.every(f => Number.isFinite(geoArea(f)) && geoArea(f) < Math.PI * 2);
