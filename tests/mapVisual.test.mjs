import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {inspectMapPixels} from '../e2e/helpers/mapVisual.mjs';
test('visual acceptance rejects black, transparent, and grid-only maps even when signals are painted',()=>{
 for(const mode of ['black','transparent','grid']){
  const png=new PNG({width:500,height:400});
  for(let y=0;y<400;y++)for(let x=0;x<500;x++){
   const i=(y*500+x)*4,line=mode==='grid' && (x%40===0 || y%40===0);
   png.data[i]=line?60:0;png.data[i+1]=line?90:0;png.data[i+2]=line?120:0;png.data[i+3]=mode==='transparent'?0:255;
  }
  assert.throws(()=>inspectMapPixels(PNG.sync.write(png),{bundled:true}),undefined,mode);
 }
});
