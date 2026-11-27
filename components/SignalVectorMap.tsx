import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { OPENFREE_MAP_STYLE, toMapFeatures } from "../lib/vectorMap.mjs";

type MapSignal = {
  id: string;
  type: string;
  lat?: number;
  lon?: number;
  title?: string;
  source?: string;
  privacyClass: "public" | "consent_based" | "private_local";
  magnitude?: number;
};
type Props = {
  signals: MapSignal[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUnavailable: (reason: string) => void;
  zone: { lat: number; lon: number };
  radiusKm: number;
};

const SRC = "watchtower-events";
const CLUSTER = "watchtower-clusters";
const COUNT = "watchtower-cluster-count";
const POINTS = "watchtower-points";

const safeZoom = (radiusKm: number) => radiusKm >= 850 ? 4 : radiusKm >= 420 ? 5 : radiusKm >= 180 ? 6 : radiusKm >= 90 ? 7 : 8;

export function SignalVectorMap({ signals, selectedId, onSelect, onUnavailable, zone, radiusKm }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectRef = useRef(onSelect);
  const unavailableRef = useRef(onUnavailable);
  const signalsRef = useRef(signals);
  const selectedRef = useRef(selectedId);
  selectRef.current = onSelect;
  unavailableRef.current = onUnavailable;
  signalsRef.current = signals;
  selectedRef.current = selectedId;

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;
    let disposed = false;
    let errors = 0;
    // MapLibre 6 has no supported() export. Construction below is the actual
    // capability check; its failure restores Lite without a runtime TypeError.
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: div,
        style: OPENFREE_MAP_STYLE,
        center: [zone.lon, zone.lat],
        zoom: safeZoom(radiusKm),
        pitch: 0,
        attributionControl: false,
        maxZoom: 16,
        renderWorldCopies: false
      });
    } catch {
      unavailableRef.current("Vector basemap could not initialize; showing Lite Atlas.");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const failureTimer = window.setTimeout(() => {
      if (!disposed && !map.isStyleLoaded()) unavailableRef.current("Vector basemap did not load; showing Lite Atlas.");
    }, 14000);

    map.on("error", (event) => {
      if (disposed) return;
      errors += 1;
      // Rendering failures are not allowed to become a backdrop of error imagery.
      if (errors >= 3) {
        unavailableRef.current("Vector map provider or renderer failed; using Lite Atlas.");
      }
    });
    map.on("load", () => {
      if (disposed) return;
      window.clearTimeout(failureTimer);
      const sourceData = toMapFeatures(signalsRef.current, selectedRef.current);
      map.addSource(SRC, {
        type: "geojson",
        data: sourceData as any,
        cluster: true,
        clusterRadius: 52,
        clusterMaxZoom: 12,
        maxzoom: 16
      });
      map.addLayer({
        id: CLUSTER,
        type: "circle",
        source: SRC,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#175a72", 25, "#167f92", 100, "#d48d3a"],
          "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 29],
          "circle-stroke-color": "#8cffff",
          "circle-stroke-width": 1.4,
          "circle-opacity": 0.85
        }
      });
      map.addLayer({
        id: COUNT,
        type: "symbol",
        source: SRC,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12 },
        paint: { "text-color": "#e9fcff" }
      });
      map.addLayer({
        id: POINTS,
        type: "circle",
        source: SRC,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], 1], 9,
            ["interpolate", ["linear"], ["get", "magnitude"], 1, 4, 5, 8, 10, 12]],
          "circle-color": ["match", ["get", "type"],
            "earthquake", "#ffd365",
            "wildfire", "#ff7847",
            "satellite", "#af9bff",
            "orbit", "#7baeff",
            "news", "#52edfa",
            "#3ed9bd"],
          "circle-stroke-color": ["case", ["==", ["get", "selected"], 1], "#ffffff", "#03203a"],
          "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 2.5, 1],
          "circle-opacity": 0.94
        }
      });
      map.on("click", CLUSTER, async (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: [CLUSTER] })[0];
        const count = hit?.properties?.cluster_id;
        if (typeof count !== "number") return;
        const src = map.getSource(SRC) as GeoJSONSource;
        try {
          const next = await src.getClusterExpansionZoom(count);
          if (!disposed) map.easeTo({ center: (hit.geometry as any).coordinates, zoom: Math.min(16, next), duration: 400 });
        } catch { /* no action when a cluster disappears during a data refresh */ }
      });
      map.on("click", POINTS, (event) => {
        const hit = map.queryRenderedFeatures(event.point, { layers: [POINTS] })[0];
        if (typeof hit?.properties?.id === "string") selectRef.current(hit.properties.id);
      });
      map.on("mouseenter", POINTS, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", POINTS, () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", CLUSTER, () => { map.getCanvas().style.cursor = "zoom-in"; });
      map.on("mouseleave", CLUSTER, () => { map.getCanvas().style.cursor = ""; });
    });
    return () => {
      disposed = true;
      window.clearTimeout(failureTimer);
      mapRef.current = null;
      map.remove();
    };
    // Provider instance must remain stable across periodic signal loads and marker selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource(SRC) as GeoJSONSource | undefined;
      if (source) source.setData(toMapFeatures(signals, selectedId) as any);
    };
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
    return () => { map.off("load", update); };
  }, [signals, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [zone.lon, zone.lat], zoom: safeZoom(radiusKm), duration: 400 });
  }, [zone.lat, zone.lon, radiusKm]);

  return <>
    <div className="vector-map" ref={divRef} aria-label="Interactive Watchtower vector map with clustered public signals"/>
    <div className="map-attribution">
      <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
      {" · "}
      <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a>
      {" · Data from "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
    </div>
  </>;
}
