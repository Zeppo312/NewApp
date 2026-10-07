// Purge only the already deleted synthetic QA object, never a whole bucket.
const fs=require('node:fs');const {createClient}=require('@supabase/supabase-js');
async function main(){
 const target=JSON.parse(fs.readFileSync('.family-qa/target.local.json','utf8'));
 if(target.projectRef!=='ggyonianphloycmqrwvj')throw Error('Wrong QA');
 const fixture=JSON.parse(fs.readFileSync('.family-qa/acceptance-20260928/cdn-url.json','utf8'));const url=new URL(fixture.url);
 if(url.origin!=='https://ggyonianphloycmqrwvj.supabase.co'||!url.pathname.startsWith('/storage/v1/object/public/public-images/qa-delete-20260928/')||url.search)throw Error('Unexpected fixture');
 const objectPath=url.pathname.split('/public-images/')[1];const slash=objectPath.lastIndexOf('/');
 const client=createClient(url.origin,target.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const listed=await client.storage.from('public-images').list(objectPath.slice(0,slash),{search:objectPath.slice(slash+1),limit:100});
 if(listed.error||!Array.isArray(listed.data)||listed.data.some(x=>x.name===objectPath.slice(slash+1)))throw Error('Synthetic origin deletion could not be verified.');
 const endpoint=`${url.origin}/storage/v1/cdn/public-images/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
 const response=await fetch(endpoint,{method:'DELETE',headers:{Authorization:`Bearer ${target.serviceKey}`,apikey:target.serviceKey},signal:AbortSignal.timeout(15000)});
 let body;try{body=await response.json();}catch{}
 const report={checkedAt:new Date().toISOString(),qaProject:target.projectRef,syntheticOriginAbsent:true,purgeStatus:response.status,purgeAccepted:response.ok,
  errorCode:body?.error??body?.code??null,actualCacheRemovalVerified:false,limit:'Only this previously deleted synthetic object. No customer data or whole-bucket cache invalidation.'};
 fs.writeFileSync('output/deletion-completion-20260930/cdn-purge.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!response.ok)process.exitCode=2;
}
main().catch(()=>{console.error('Synthetic QA CDN purge could not complete. No credentials logged.');process.exitCode=1});
