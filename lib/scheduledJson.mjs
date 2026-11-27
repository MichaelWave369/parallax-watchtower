// Transport for the four existing fixed scheduled-cache URLs only. Not a proxy.
import { ORBITAL_GROUPS } from './orbitalCatalog.mjs';
import { USGS_DISCOVERY_URL, EONET_DISCOVERY_URL } from './discoveryCache.mjs';
import { readNewsResponse } from './newsAdapters.mjs';
const endpoints=new Map([
  ...[USGS_DISCOVERY_URL,EONET_DISCOVERY_URL].map(url=>[url,{maxBytes:2_000_000,timeoutMs:22000,userAgent:'WatchtowerLive/1.0 (scheduled public-source discovery cache)'}]),
  ...ORBITAL_GROUPS.map(group=>[group.url,{maxBytes:3_000_000,timeoutMs:25000,userAgent:'WatchtowerLive/0.2 (GitHub Actions cached public orbital catalog)'}])
]);
export async function fetchScheduledJson(url,{fetchImpl=fetch,timeoutMs}={}) {
  const policy=endpoints.get(url);
  if(!policy)throw new Error('Scheduled source URL is not allowlisted');
  const controller=new AbortController();
  const deadline=Number.isFinite(timeoutMs)?Math.max(1,Math.min(timeoutMs,policy.timeoutMs)):policy.timeoutMs;
  const timer=setTimeout(()=>controller.abort(),deadline);
  let response;
  try{
    response=await fetchImpl(url,{cache:'no-store',redirect:'manual',signal:controller.signal,
      headers:{Accept:'application/json','User-Agent':policy.userAgent}});
    if(response.status!==200)throw new Error('HTTP '+response.status+'; stopping without retry');
    if(response.url && response.url!==url)throw new Error('Unexpected scheduled-source response URL');
    return JSON.parse(await readNewsResponse(response,controller.signal,policy.maxBytes));
  }finally{
    controller.abort();clearTimeout(timer);
    try{if(response?.body&&!response.body.locked)Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}
  }
}
