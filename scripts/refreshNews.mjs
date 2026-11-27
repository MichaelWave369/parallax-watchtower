// Centrally cached public metadata. Never fetch article bodies or caller-provided URLs.
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectNews } from '../lib/newsAdapters.mjs';
import { makeNewsSourceManifest } from '../lib/newsSources.mjs';

async function readJson(path) { try { return JSON.parse(await readFile(path,'utf8')); } catch { return null; } }
async function atomicJson(path,value) {
  await mkdir(dirname(path),{recursive:true});
  const temp=path+'.tmp';
  await writeFile(temp,JSON.stringify(value,null,2)+'\n','utf8');await rename(temp,path);
}
export async function refreshNews({outputDir='public/data',now=Date.now(),fetchImpl=fetch,timeoutMs=22000}={}) {
  const newsPath=resolve(outputDir,'news.v1.json'),healthPath=resolve(outputDir,'news-health.v1.json');
  const [previous,previousHealth]=await Promise.all([readJson(newsPath),readJson(healthPath)]);
  const result=await collectNews({previous,previousHealth,now,fetchImpl,timeoutMs});
  if(result.unchanged) { console.log('News cache is within source cooldowns; no provider calls or writes.');return result; }
  // Health survives complete upstream failure; last good news snapshot is untouched.
  await atomicJson(healthPath,result.health);
  await atomicJson(resolve(outputDir,'news-sources.v1.json'),makeNewsSourceManifest());
  if(result.publish) {
    await atomicJson(newsPath,result.snapshot);
    console.log(`News metadata: ${result.snapshot.records.length} records; ${result.succeeded}/${result.attempted} source attempts succeeded.`);
  } else console.error('No source retrieval succeeded. Last good news snapshot preserved; health/backoff state updated.');
  return result;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { const result=await refreshNews();if(!result.publish && !result.unchanged)process.exitCode=1; }
  catch(error) { console.error(error instanceof Error?error.message:'News refresh failed');process.exitCode=1; }
}
