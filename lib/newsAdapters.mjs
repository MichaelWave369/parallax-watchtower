import { SaxesParser } from 'saxes';
import { allocateNewsBatches } from './newsBudget.mjs';
import { NEWS_SOURCES, getNewsSource } from './newsSources.mjs';
import { NEWS_SCHEMA, NEWS_MAX_RECORDS, normalizeNewsRecord, canonicalizeNewsUrl, newsTimestamp, newsNow, validateNewsSnapshot, validateNewsHealth } from './newsContract.mjs';

export const NEWS_RESPONSE_MAX_BYTES = 2_000_000;
export const NEWS_SOURCE_MAX_RECORDS = 30;
const HOUR = 60 * 60 * 1000;
const ATOM = 'http://www.w3.org/2005/Atom';
function dateOrNull(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
  if (typeof value !== 'string' || /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  // A timezone is mandatory; do not interpret locale-dependent dates as UTC.
  if (!/(Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(value.trim())) return null;
  if (/^\d{4}-/.test(value) && !newsTimestamp(value, Number.MAX_SAFE_INTEGER)) return null;
  const n = Date.parse(value);
  if (!Number.isFinite(n)) return null;
  const rfc = /(?:^|,\s*)(\d{1,2})\s+([a-z]{3})\s+(\d{4})/i.exec(value.trim());
  if (rfc) {
    const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(rfc[2].toLowerCase());
    const d = new Date(Date.UTC(Number(rfc[3]),month,Number(rfc[1])));
    if (month<0 || d.getUTCMonth()!==month || d.getUTCDate()!==Number(rfc[1])) return null;
  }
  return new Date(n).toISOString();
}
function receipt(raw, source) {
  const url = canonicalizeNewsUrl(raw);
  return url && source.receiptHosts.includes(new URL(url).hostname) ? url : null;
}
export function parseSyndicationFeed(xml, format = 'rss') {
  if (typeof xml !== 'string' || Buffer.byteLength(xml,'utf8') > NEWS_RESPONSE_MAX_BYTES || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Unsafe or oversized XML feed');
  const parser = new SaxesParser({xmlns:true});
  let depth=0,nodes=0,item=null,itemDepth=0,field=null,fieldDepth=0,root=null,channelCount=0;
  const stack=[];
  const rows=[];
  parser.on('error',error=>{throw error;});
  parser.on('doctype',()=>{throw new Error('DOCTYPE is not permitted');});
  parser.on('opentag',tag=>{
    depth++; nodes++;
    if (depth>32 || nodes>30000) throw new Error('XML structure limit exceeded');
    const local=tag.local.toLowerCase();
    const parent=stack[stack.length-1];
    stack.push({local,uri:tag.uri});
    if(format==='rss' && depth===2 && local==='channel' && tag.uri==='') channelCount++;
    if(depth===1) {
      root=local;
      if(format==='atom' ? local!=='feed'||tag.uri!==ATOM : local!=='rss'||tag.uri!=='') throw new Error('Unexpected feed root');
    }
    if ((format==='atom' && local==='entry' && tag.uri===ATOM && depth===2) || (format==='rss' && local==='item' && tag.uri==='' && depth===3 && parent?.local==='channel' && parent?.uri==='')) {
      item={};itemDepth=depth;
    } else if(item && depth===itemDepth+1) {
      const validNS=format==='atom' ? tag.uri===ATOM : tag.uri==='' || (local==='date' && tag.uri==='http://purl.org/dc/elements/1.1/');
      if(validNS && ['title','link','pubdate','published','updated','date'].includes(local)) {
        field=local;fieldDepth=depth;
        if(local==='link' && format==='atom') {
          const attrs=Object.values(tag.attributes);
          const href=attrs.find(a=>a.local==='href' && !a.uri)?.value;
          const rel=attrs.find(a=>a.local==='rel' && !a.uri)?.value;
          if(href && (!rel || rel==='alternate')) item.link=href;
          field=null;
        }
      }
    }
  });
  const onText=text=>{ if(item && field && depth===fieldDepth) item[field]=((item[field]??'')+text).slice(0,4096); };
  parser.on('text',onText);parser.on('cdata',onText);
  parser.on('closetag',()=>{
    if(depth===fieldDepth){field=null;fieldDepth=0;}
    if(item && depth===itemDepth){ if(rows.length<500)rows.push(item);item=null; }
    stack.pop();depth--;
  });
  parser.write(xml).close();
  if(!root || (format==='rss' && channelCount!==1)) throw new Error('Empty or malformed feed container');
  return rows;
}
function sourceRecord(source,row,nowMs) {
  return normalizeNewsRecord({
    sourceId:source.id,publisher:source.publisher,originGroup:source.originGroup,
    language:source.language,topics:source.topics,region:{code:'GLOBAL',label:'Location not specified',precision:'global'},
    kind:source.kind,evidenceType:source.evidenceType,privacyClass:'public',demo:false,
    retrievedAt:new Date(nowMs).toISOString(),publishedAt:null,eventAt:null,modifiedAt:null,summary:'',...row
  },nowMs);
}
export function normalizeSourcePayload(sourceOrId, payload, now = Date.now()) {
  const source=typeof sourceOrId==='string'?getNewsSource(sourceOrId):sourceOrId;
  if(!source || !NEWS_SOURCES.some(s=>s===source)) throw new Error('Unknown source adapter');
  const nowMs=newsNow(now);
  let rows=[], inputCount=0;
  if(['rss','atom'].includes(source.format)) {
    const feedRows=parseSyndicationFeed(payload,source.format);inputCount=feedRows.length;
    rows=feedRows.map(row=>{
      const url=receipt(row.link?.trim(),source);
      if(!url) return null;
      return sourceRecord(source,{url,title:row.title??'',publishedAt:dateOrNull(row.published??row.pubdate??row.date),modifiedAt:source.id==='arxiv-ai'?null:dateOrNull(row.updated)},nowMs);
    });
  } else if(source.id==='usgs-earthquakes') {
    if(payload?.type!=='FeatureCollection' || !Array.isArray(payload.features))throw new Error('Invalid USGS GeoJSON');
    inputCount=payload.features.length;
    rows=payload.features.slice(0,500).map(row=>{
      const p=row?.properties,url=receipt(p?.url,source);
      if(!url || p?.type!=='earthquake' || !Number.isFinite(p.mag) || p.mag<4.5 || !Number.isFinite(p.time))return null;
      return sourceRecord(source,{id:`usgs-${String(row.id).slice(0,120)}`,url,title:p.title,
        summary:typeof p.place==='string'?p.place:'',eventAt:dateOrNull(p.time),modifiedAt:dateOrNull(p.updated),
        region:{code:'GLOBAL',label:typeof p.place==='string'?p.place:'Published place unspecified',precision:'region'}},nowMs);
    });
  } else if(source.id==='federal-register') {
    if(!Array.isArray(payload?.results)) throw new Error('Invalid Federal Register JSON');
    inputCount=payload.results.length;
    rows=payload.results.slice(0,500).map(row=>{
      const url=receipt(row?.html_url,source);if(!url)return null;
      const day=typeof row.publication_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.publication_date)&&newsTimestamp(row.publication_date+'T00:00:00Z',nowMs)?row.publication_date:null;
      return sourceRecord(source,{url,title:row.title,summary:day?`Publication date: ${day} (day precision; exact time unavailable).`:'',
        publishedAt:dateOrNull(row.publication_date),region:{code:'US',label:'United States federal publication',precision:'country'}},nowMs);
    });
  } else throw new Error('Unsupported source adapter');
  if(inputCount>0 && !rows.some(Boolean))throw new Error('Provider returned no valid attributable metadata');
  const seen=new Set();
  return rows.filter(Boolean).sort((a,b)=>Date.parse(b.publishedAt??b.eventAt??b.modifiedAt??b.retrievedAt)-Date.parse(a.publishedAt??a.eventAt??a.modifiedAt??a.retrievedAt)).filter(row=>{
    if(seen.has(row.canonicalUrl))return false;seen.add(row.canonicalUrl);return true;
  }).slice(0,NEWS_SOURCE_MAX_RECORDS);
}
function abortError(){return new Error('Request timed out');}
function cancelUnreadBody(body) {
  // Cancellation is best-effort and must not outlive the request's bounded deadline.
  try { if(body && !body.locked) Promise.resolve(body.cancel()).catch(()=>{}); } catch {}
}
async function abortable(promise,signal) {
  if(signal.aborted)throw abortError();
  let handler;
  try{return await Promise.race([promise,new Promise((_,reject)=>{handler=()=>reject(abortError());signal.addEventListener('abort',handler,{once:true});})]);}
  finally{if(handler)signal.removeEventListener('abort',handler);}
}
export async function readNewsResponse(response, signal, maxBytes=NEWS_RESPONSE_MAX_BYTES) {
  const declared=response.headers.get('content-length');
  if(declared!==null && (!/^\d+$/.test(declared)||Number(declared)>maxBytes)) {
    cancelUnreadBody(response.body);throw new Error('Response size limit exceeded');
  }
  if(!response.body || typeof response.body.getReader!=='function')throw new Error('Missing response stream');
  const reader=response.body.getReader();const chunks=[];let bytes=0;
  try{
    while(true){
      const {done,value}=await abortable(reader.read(),signal);if(done)break;
      bytes+=value.byteLength;if(bytes>maxBytes)throw new Error('Response size limit exceeded');chunks.push(value);
    }
  }catch(error){
    // Some stream implementations never settle cancel(); do not await upstream cleanup.
    try { Promise.resolve(reader.cancel()).catch(()=>{}); } catch {}
    throw error;
  }
  finally{reader.releaseLock();}
  const joined=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(joined);
}
export async function fetchNewsSource(sourceOrId, {fetchImpl=fetch, now=Date.now(), timeoutMs=22000}={}) {
  const source=typeof sourceOrId==='string'?getNewsSource(sourceOrId):sourceOrId;
  // Identity check blocks arbitrary caller-provided endpoints and redirects/SSRF.
  if(!source || !NEWS_SOURCES.some(s=>s===source) || !source.enabled)throw new Error('Source is not allowlisted');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let response;
  try {
    response=await abortable(fetchImpl(source.url,{redirect:'manual',cache:'no-store',signal:controller.signal,
      headers:{Accept:['rss','atom'].includes(source.format)?'application/rss+xml, application/atom+xml, application/xml, text/xml':'application/json',
        'User-Agent':'WatchtowerLive/2.0 (+https://github.com/MichaelWave369/parallax-watchtower; public metadata cache)'}}),controller.signal);
    if(response.status!==200) {
      const error=new Error(`HTTP ${response.status}`);error.status=response.status;
      const retry=Number(response.headers.get('retry-after'));error.retryAfterMs=Number.isFinite(retry)?Math.min(Math.max(retry*1000,0),48*HOUR):null;
      throw error;
    }
    if(response.url && response.url!==source.url)throw new Error('Unexpected response URL');
    const type=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
    const allowed=['rss','atom'].includes(source.format)?['application/rss+xml','application/atom+xml','application/xml','text/xml']:['application/json','application/geo+json'];
    if(!allowed.includes(type))throw new Error('Unexpected response content type');
    const text=await readNewsResponse(response,controller.signal);
    const payload=['rss','atom'].includes(source.format)?text:JSON.parse(text);
    return normalizeSourcePayload(source,payload,now);
  }finally{
    // Early HTTP/type/size validation failures can leave an unread response.
    // Abort the native transport before clearing its timer and cancel any free stream.
    controller.abort();cancelUnreadBody(response?.body);clearTimeout(timer);
  }
}
export async function collectNews({previous=null, previousHealth=null, now=Date.now(),fetchImpl=fetch,timeoutMs=22000,concurrency=2}={}) {
  const nowMs=newsNow(now),at=new Date(nowMs).toISOString();
  const old=validateNewsSnapshot(previous,nowMs);
  const health=validateNewsHealth(previousHealth,nowMs);
  const oldHealth=health && (!old || Date.parse(health.generatedAt)>=Date.parse(old.generatedAt))?health.sources:(old?.sources??[]);
  const states=new Array(NEWS_SOURCES.length),batches=new Array(NEWS_SOURCES.length);
  let next=0,attempted=0,succeeded=0;
  async function worker(){
    while(next<NEWS_SOURCES.length){
      const index=next++,source=NEWS_SOURCES[index];
      const before=oldHealth.find(s=>s.id===source.id);
      const retained=(old?.records??[]).filter(r=>r.sourceId===source.id);
      const nextAt=Date.parse(before?.nextAttemptAt??'');
      if(Number.isFinite(nextAt)&&nextAt>nowMs){
        states[index]={...before,recordCount:retained.length};batches[index]=retained;continue;
      }
      attempted++;
      try{
        const records=await fetchNewsSource(source,{fetchImpl,now:nowMs,timeoutMs});succeeded++;
        batches[index]=records;
        states[index]={id:source.id,status:'ok',attemptedAt:at,lastSuccessAt:at,lastFailureAt:before?.lastFailureAt??null,
          recordCount:records.length,message:'Metadata retrieved; underlying claims are not automatically verified.',consecutiveFailures:0,nextAttemptAt:new Date(nowMs+source.minIntervalMs).toISOString()};
      }catch(error){
        const failures=Math.min((before?.consecutiveFailures??0)+1,20);
        const backoff=Math.max(source.minIntervalMs,Math.min(source.minIntervalMs*2**(failures-1),48*HOUR),error?.retryAfterMs??0);
        batches[index]=retained;
        states[index]={id:source.id,status:'error',attemptedAt:at,lastSuccessAt:before?.lastSuccessAt??null,lastFailureAt:at,
          recordCount:retained.length,message:error?.status?`Provider returned HTTP ${error.status}; prior metadata retained.`:'Retrieval or validation failed; prior metadata retained.',
          consecutiveFailures:failures,nextAttemptAt:new Date(nowMs+backoff).toISOString()};
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(Math.max(Math.floor(concurrency)||1,1),2)},()=>worker()));
  // Retain breadth at the fixed public cache limit; counts describe published records, not upstream volume.
  const {records,counts}=allocateNewsBatches(batches,NEWS_MAX_RECORDS);
  const publishedStates=states.map((state,index)=>({...state,recordCount:counts[index]}));
  const snapshot=validateNewsSnapshot({schema:NEWS_SCHEMA,generatedAt:at,sources:publishedStates,records},nowMs);
  if(!snapshot)throw new Error('Collector output failed its public contract');
  return {snapshot,health:{schema:'phi.watchtower.news-health.v1',generatedAt:at,sources:snapshot.sources},attempted,succeeded,
    publish:succeeded>0,unchanged:attempted===0};
}
