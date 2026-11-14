// Federated navigation using Peekaboo's published product hash; no camera ingestion.
export const PEEKABOO_URL = "https://michaelwave369.github.io/Peekaboo/";
export function buildPeekabooPublicViewsUrl({ lat, lon }, zoom = 9) {
  if (![lat, lon, zoom].every((n) => typeof n === "number" && Number.isFinite(n)) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180 || zoom < 2 || zoom > 18) return PEEKABOO_URL;
  const params = new URLSearchParams();
  params.set("map", `${Math.round(zoom)}/${lat.toFixed(5)}/${lon.toFixed(5)}`);
  params.set("layers", "");
  params.set("mode", "public");
  return `${PEEKABOO_URL}#${params.toString()}`;
}
