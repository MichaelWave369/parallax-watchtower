import { normalizeNewsRecord } from './newsContract.mjs';
import { NEWS_SOURCES } from './newsSources.mjs';

export const REVISION_LIMIT=1200;
export const REVISION_PER_RECEIPT=6;
const allowed=new Set(NEWS_SOURCES.map(s=>s.id));
export const revisionReceiptKey=r=>JSON.stringify([r.sourceId,r.canonicalUrl]);
const key=revisionReceiptKey;
// Only changes in observable metadata, not repeated retrievals or derived IDs.
export const revisionContentKey=r=>JSON.stringify([r.title,r.summary,r.publishedAt,r.eventAt,r.modifiedAt,r.language,r.region,r.kind,r.evidenceType,[...r.topics].sort()]);
const content=revisionContentKey;
export function mergeNewsRevisions(previous,incoming,{now=Date.now(),retentionDays=30}={}){
  const n=typeof now==='number'?now:Date.parse(now);
  if(!Number.isFinite(n))return [];
  const days=[7,30,90].includes(retentionDays)?retentionDays:30;
  const groups=new Map();
  // Previous observations take precedence over contradictory same-clock input.
  for(const raw of [...(Array.isArray(previous)?previous.slice(-REVISION_LIMIT):[]),...(Array.isArray(incoming)?incoming.slice(0,600):[])]){
    const r=normalizeNewsRecord(raw,n);
    if(!r||!allowed.has(r.sourceId)||Date.parse(r.retrievedAt)<n-days*86400000)continue;
    const k=key(r);
    if(!groups.has(k))groups.set(k,[]);
    const rows=groups.get(k);
    if(!rows.some(old=>old.retrievedAt===r.retrievedAt))rows.push(r);
  }
  const revisions=[];
  for(const rows of groups.values()){
    rows.sort((a,b)=>a.retrievedAt.localeCompare(b.retrievedAt));
    const changes=[];
    for(const r of rows){
      if(changes.length&&content(changes.at(-1))===content(r))continue;
      changes.push(r);
    }
    revisions.push(...changes.slice(-REVISION_PER_RECEIPT));
  }
  // Keep newest observations globally; never rewrite their source clocks.
  return revisions.sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)||key(a).localeCompare(key(b))).slice(0,REVISION_LIMIT);
}
export function revisionsForRecord(revisions,record){
  if(!record||!allowed.has(record.sourceId))return [];
  return revisions.filter(r=>key(r)===key(record)).sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));
}
