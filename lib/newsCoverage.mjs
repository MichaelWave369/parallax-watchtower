// Counts describe configured source remit and shared metadata, not event geography or verification.
export function buildCoverage(sources, records, health, now) {
 const n=typeof now==='number'?now:Date.parse(now);
 const fresh=at=>{const t=Date.parse(at??'');return Number.isFinite(t)&&t<=n+300000&&n-t<=36*3600000;};
 const active=sources.filter(s=>s.enabled===true);
 const ids=new Set(active.map(s=>s.id));
 const current=records.filter(r=>ids.has(r.sourceId)&&r.privacyClass==='public'&&r.demo===false);
 const healthy=active.filter(s=>health.some(h=>h.id===s.id&&h.status==='ok'&&fresh(h.lastSuccessAt)));
 const regions=[['North America',['North America','United States','Canada','Mexico']],['Latin America / Caribbean',['South America','Latin America','Latin America & the Caribbean','Caribbean']],['Europe',['Europe','Euro area']],['Africa',['Africa','Sub-Saharan Africa']],['Middle East / North Africa',['Middle East','North Africa','Middle East & North Africa']],['Asia',['Asia','Asia-Pacific','East Asia','South Asia','Southeast Asia','Central Asia']],['Oceania',['Oceania','Pacific','Australia','New Zealand']],['Global / space',['Global','Space']]];
 const group=(label,selected)=>{const keys=new Set(selected.map(s=>s.id));const rows=current.filter(r=>keys.has(r.sourceId));return {label,feeds:selected.length,originFamilies:new Set(selected.map(s=>s.originGroup)).size,healthy:healthy.filter(s=>keys.has(s.id)).length,records:rows.length,freshRecords:rows.filter(r=>fresh(r.retrievedAt)).length};};
 return {configured:active.length,originFamilies:new Set(active.map(s=>s.originGroup)).size,healthy:healthy.length,records:current.length,freshRecords:current.filter(r=>fresh(r.retrievedAt)).length,regions:regions.map(([label,aliases])=>group(label,active.filter(s=>s.geographicCoverage.some(v=>aliases.includes(v))))),languages:[...new Set([...active.map(s=>s.language),...current.map(r=>r.language)])].sort().map(language=>({language,feeds:active.filter(s=>s.language===language).length,records:current.filter(r=>r.language===language).length,freshRecords:current.filter(r=>r.language===language&&fresh(r.retrievedAt)).length})),kinds:['article','official_statement','research','public_data'].map(kind=>({kind,records:current.filter(r=>r.kind===kind).length}))};
}
