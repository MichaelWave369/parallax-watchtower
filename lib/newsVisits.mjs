import { revisionReceiptKey, revisionContentKey } from './newsRevisions.mjs';
import { validateNewsSnapshot } from './newsContract.mjs';
import { NEWS_SOURCES } from './newsSources.mjs';

const allowed=new Set(NEWS_SOURCES.filter(s=>s.enabled).map(s=>s.id));
// Only compare validated shared snapshots, not local archive/imports.
// No inference from absence: bounded feeds and failed providers can drop items.
export function compareNewsVisits(previous,current,now=Date.now()){
  const before=validateNewsSnapshot(previous,now);
  const after=validateNewsSnapshot(current,now);
  const empty={state:'unavailable',baselineAt:before?.generatedAt??null,currentAt:after?.generatedAt??null,added:[],revised:[],same:0,ignored:0};
  if(!after)return empty;
  if(!before)return {...empty,state:'baseline-needed'};
  if(Date.parse(after.generatedAt)<Date.parse(before.generatedAt))return {...empty,state:'older-snapshot'};
  const old=new Map(before.records.filter(r=>allowed.has(r.sourceId)).map(r=>[revisionReceiptKey(r),r]));
  const added=[],revised=[];let same=0,ignored=0;
  for(const row of after.records){
    if(!allowed.has(row.sourceId)){ignored++;continue;}
    const prior=old.get(revisionReceiptKey(row));
    if(!prior){
      // An older cached receipt newly included by the allocation budget is not a new retrieval.
      // Its appearance in this snapshot is nevertheless new relative to the baseline.
      added.push(row);continue;
    }
    if(revisionContentKey(prior)===revisionContentKey(row)){same++;continue;}
    if(Date.parse(row.retrievedAt)<=Date.parse(prior.retrievedAt)){ignored++;continue;}
    revised.push({before:prior,after:row});
  }
  const order=(a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)||revisionReceiptKey(a).localeCompare(revisionReceiptKey(b));
  return {...empty,state:'ready',added:added.sort(order),revised:revised.sort((a,b)=>order(a.after,b.after)),same,ignored};
}
