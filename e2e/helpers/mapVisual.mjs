import { PNG } from 'pngjs';
import assert from 'node:assert/strict';
// Analyze the geographic surface itself, excluding controls and attribution.
// Uniform backgrounds, black/transparent canvases and grid-only atlases fail.
export function inspectMapPixels(buffer, { bundled = false, markers = true, globe = false } = {}) {
  const png = PNG.sync.read(buffer), colors = new Map();
  let land = 0, ocean = 0, signal = 0, opaque = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const [r,g,b,a] = png.data.subarray(i,i+4); if (a < 240) continue; opaque++;
    const key = `${r >> 3},${g >> 3},${b >> 3}`; colors.set(key,(colors.get(key)||0)+1);
    if (Math.abs(r-41)<3 && Math.abs(g-73)<3 && Math.abs(b-77)<3) land++;
    if (Math.abs(r-12)<3 && Math.abs(g-35)<3 && Math.abs(b-52)<3) ocean++;
    if ((r>235 && g>180 && b<135) || (r>240 && g>100 && g<170 && b>160) || (r<45 && g>85 && g<135 && b>95 && b<150)) signal++;
  }
  const pixels=png.width*png.height, dominant=Math.max(0,...colors.values())/pixels;
  assert.ok(png.width>=250 && png.height>=250,'usable canvas dimensions');
  assert.ok(opaque/pixels>0.8,'actual opaque geographic surface');
  assert.ok(colors.size>35 && dominant<0.94,`blank/nearly uniform map: ${colors.size} colors, dominant ${dominant}`);
  if(bundled) { assert.ok(land/pixels>0.015,`continental land missing: ${land}`); assert.ok(ocean/pixels>(globe ? 0.025 : 0.1),`ocean missing: ${ocean}/${pixels}`); }
  if(markers) assert.ok(signal>30,`visible signal pixels missing: ${signal}`);
  return {width:png.width,height:png.height,colors:colors.size,dominantFraction:dominant,landPixels:land,oceanPixels:ocean,signalPixels:signal};
}
