// One-off, fixed-host admission check. Never publishes headlines or modifies the source registry.
import { pathToFileURL } from 'node:url';
import { parseSyndicationFeed, readNewsResponse } from '../lib/newsAdapters.mjs';
import { canonicalizeNewsUrl, newsText } from '../lib/newsContract.mjs';

export const IPS_ROBOTS='https://www.ipsnews.net/robots.txt';
export const IPS_FEED='https://www.ipsnews.net/news/headlines/feed/';
const AGENT='WatchtowerLive/2.0 (+https://github.com/MichaelWave369/parallax-watchtower; one-time source admission)';
const MAX_ROBOTS_BYTES=128000;
const MAX_FEED_BYTES=2000000;

// Deliberately more restrictive than REP: consider every group's Disallow rules,
// ignore Allow overrides, and decline ambiguous patterns rather than evade a policy.
// Not a general-purpose robots.txt implementation.
export function checkAdmissionRobots(text, path='/news/headlines/feed/') {
  if(typeof text!=='string'||Buffer.byteLength(text)>MAX_ROBOTS_BYTES||/<(?:html|!doctype)/i.test(text))return {allowed:false,reason:'unreadable robots policy'};
  let delay=1, groups=0;
  for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const line=raw.split('#')[0].trim();
    if(!line)continue;
    const colon=line.indexOf(':');
    if(colon<0)return {allowed:false,reason:'unrecognized robots directive'};
    const key=line.slice(0,colon).trim().toLowerCase(), value=line.slice(colon+1).trim();
    if(key==='user-agent'&&value)groups++;
    if(key==='crawl-delay'){
      if(!/^\d+(?:\.\d+)?$/.test(value)||Number(value)>60)return {allowed:false,reason:'crawl-delay requires manual review'};
      delay=Math.max(delay,Number(value));
    }
    if(key!=='disallow'||!value)continue;
    if(!value.startsWith('/')||value.includes('%')||/[^\x21-\x7e]/.test(value))return {allowed:false,reason:'ambiguous disallow rule'};
    // Match only the fixed ASCII feed path. Split on wildcard and use a bounded
    // dynamic-programming match instead of evaluating provider-controlled regex.
    const anchored=value.endsWith('$'), pattern=anchored?value.slice(0,-1):value;
    if(pattern.length>512)return {allowed:false,reason:'oversized disallow rule'};
    let states=new Set([0]);
    for(const ch of pattern){
      const next=new Set();
      for(const i of states){
        if(ch==='*'){for(let j=i;j<=path.length;j++)next.add(j);}
        else if(path[i]===ch)next.add(i+1);
      }
      states=next;
      if(!states.size)break;
    }
    if(anchored?states.has(path.length):states.size>0)return {allowed:false,reason:'conservative disallow match'};
  }
  if(!groups)return {allowed:false,reason:'no recognizable user-agent policy'};
  return {allowed:true,delaySeconds:delay};
}
export function inspectAdmissionFeed(xml){
  const rows=parseSyndicationFeed(xml,'rss');
  const seen=new Set();let dated=0;
  for(const row of rows){
    const url=canonicalizeNewsUrl(row.link?.trim());
    if(!url||!['www.ipsnews.net','ipsnews.net'].includes(new URL(url).hostname)||!newsText(row.title)||seen.has(url))continue;
    seen.add(url);
    const date=row.pubdate??row.published??row.date;
    if(typeof date==='string'&&/(Z|[+-]\d{2}:?\d{2}|GMT|UTC)\s*$/i.test(date)&&Number.isFinite(Date.parse(date)))dated++;
  }
  return {items:rows.length,attributableUniqueItems:seen.size,timezoneDateCandidates:dated};
}
async function fixedRead(url,types,maxBytes,fetchImpl){
  if(![IPS_ROBOTS,IPS_FEED].includes(url))throw Error('unapproved endpoint');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),22000);
  let response;
  try{
    response=await fetchImpl(url,{signal:controller.signal,redirect:'manual',cache:'no-store',headers:{'User-Agent':AGENT,Accept:types.join(', ')}});
    if(response.status!==200)throw Error('HTTP '+response.status);
    if(response.url&&response.url!==url)throw Error('unexpected response URL');
    const type=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
    if(!types.includes(type))throw Error('unexpected content type');
    const body=await readNewsResponse(response,controller.signal,maxBytes);
    return {status:response.status,type,bytes:Buffer.byteLength(body),body};
  }finally{
    controller.abort();clearTimeout(timer);
    if(response?.body&&!response.body.locked)try{Promise.resolve(response.body.cancel()).catch(()=>{});}catch{}
  }
}
export async function probeIps({fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const report={schema:'phi.watchtower.source-admission.v1',candidate:'ips-headlines',checkedAt:new Date().toISOString(),policy:'https://www.ipsnews.net/rss-feeds/',state:'blocked',stage:'robots',productionEnabled:false};
  try{
    const robots=await fixedRead(IPS_ROBOTS,['text/plain'],MAX_ROBOTS_BYTES,fetchImpl);
    report.robots={status:robots.status,type:robots.type,bytes:robots.bytes,...checkAdmissionRobots(robots.body)};
    if(!report.robots.allowed)return report;
    await sleep(Math.ceil(report.robots.delaySeconds*1000));
    report.stage='feed';
    const feed=await fixedRead(IPS_FEED,['application/rss+xml','application/xml','text/xml'],MAX_FEED_BYTES,fetchImpl);
    report.feed={status:feed.status,type:feed.type,bytes:feed.bytes,...inspectAdmissionFeed(feed.body)};
    if(report.feed.attributableUniqueItems===0){report.reason='No valid attributable headlines';return report;}
    report.state='transport-reviewed';report.stage='manual-review';
    return report;
  }catch(error){
    // Do not expose provider content or arbitrary error messages in CI.
    const message=String(error?.message??'');
    report.reason=/^HTTP \d{3}$/.test(message)?message:['unexpected response URL','unexpected content type'].includes(message)?message:'Transport or parsing failed';
    return report;
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const receipt=await probeIps();
  console.log(JSON.stringify(receipt,null,2));
  if(receipt.state!=='transport-reviewed')process.exitCode=1;
}
