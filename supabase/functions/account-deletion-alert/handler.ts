import { publicResponse, readSmallBody, secureEqual } from '../_shared/accountDeletion/contracts.ts';

const keys = ['registry_stale_over_3m','needs_attention','queued_over_15m','expired_lease_over_7m','lease_exceeds_contract','overdue_retention'];
type Dependencies = { env:(key:string)=>string|undefined; createAdmin:(url:string,key:string)=>any; send:(message:{subject:string;text:string})=>Promise<void> };
export const createAlertHandler = ({env,createAdmin,send}:Dependencies) => async (req:Request) => {
 if(req.method!=='POST') return publicResponse({error:'method_not_allowed'},405);
 const key=env('SUPABASE_SERVICE_ROLE_KEY'); const url=env('SUPABASE_URL'); const secret=env('ACCOUNT_DELETION_CRON_SECRET');
 if(!secret || secret.length<32 || !secureEqual(req.headers.get('authorization')??'',`Bearer ${secret}`)) return publicResponse({error:'unauthorized'},401);
 if(!key || !url || !env('DELETION_ALARM_SMTP_PASSWORD')) return publicResponse({error:'alarm_not_configured'},503);
 let body:Record<string,unknown>;
 try { body=await readSmallBody(req); } catch { return publicResponse({error:'invalid_request'},400); }
 if(Object.keys(body).some(k=>k!=='test') || (body.test!==undefined && typeof body.test!=='boolean')) return publicResponse({error:'invalid_request'},400);
 const project=new URL(url).hostname.split('.')[0];
 if(!['ggyonianphloycmqrwvj','kwniiyayhzgjfqjsjcfu'].includes(project)) return publicResponse({error:'wrong_project'},503);
 const environment=project==='ggyonianphloycmqrwvj'?'qa':'production'; const test=body.test===true;
 const admin=createAdmin(url,key);
 const rpc=async(action:string,payload:Record<string,unknown>={})=>{
  const {data,error}=await admin.rpc('account_deletion_alarm',{action,payload});
  if(error) throw new Error('alarm_state_failed'); return data;
 };
 let counts:Record<string,number>|null=null; let checkFailed=false; let lease:string|undefined;
 try {
  if(test) counts={needs_attention:1,overdue_retention:1};
  else {
   try {
    const raw=await rpc('health');
    if(!raw || keys.some(k=>typeof raw[k]!=='number' || !Number.isSafeInteger(raw[k]) || raw[k]<0)) throw new Error();
    counts=Object.fromEntries(keys.map(k=>[k,raw[k]]));
   } catch {checkFailed=true;}
   if(!checkFailed && counts && Object.values(counts).every(n=>n===0)) {await rpc('reset');return publicResponse({sent:false,healthy:true});}
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({environment,counts,checkFailed})));
   const signature=[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
   // If the database is unreachable, still alert; never claim unknown state is healthy.
   try { const claim=await rpc('claim',{signature}); if(claim?.send===false) return publicResponse({sent:false,deduplicated:true}); if(!claim?.lease) throw new Error();lease=claim.lease; } catch {checkFailed=true;}
  }
  const subject=`${test?'[TEST – kein echter Fehler] ':''}LottiBaby Löschalarm (${environment}): ${checkFailed?'Statusprüfung fehlgeschlagen':'Bearbeitung erforderlich'}`;
  const text=[test?'Synthetischer Alarmtest. Keine echten Löschaufträge betroffen.':'Bitte den geschützten Löschstatus prüfen und die Bearbeitung übernehmen.',
   `Prüfzeit: ${new Date().toISOString()}`,`Umgebung: ${environment}`,
   ...Object.entries(counts??{}).filter(([,n])=>n>0).map(([k,n])=>`${k}: ${n}`),
   checkFailed?'Der Backend-Status konnte nicht verlässlich gelesen werden.':'',
   'Jan Zeppenfeld übernimmt; Vertretung nach ausdrücklicher Übergabe: seine Ehefrau.',
   'Keine Kontokennungen oder personenbezogenen Inhalte enthalten.',
   'Versand über den serverseitigen Hostinger-SMTP-Alarmrunner.'].filter(Boolean).join('\n');
  await send({subject,text});
  if(lease) await rpc('finish',{lease,sent:true});
  return publicResponse({sent:true,test,checkFailed,actualDeliveryVerified:false});
 } catch {
  if(lease) {try {await rpc('finish',{lease,sent:false});} catch {}}
  return publicResponse({error:'alarm_delivery_failed'},503);
 }
};
