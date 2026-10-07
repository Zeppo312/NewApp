import { DeletionError, type StoredObject } from './contracts.ts';
export async function purgeDeletedObjectCache(origin:string,key:string,object:StoredObject,fetcher:typeof fetch=fetch):Promise<void>{
 if(!object.bucket || object.bucket.includes('/') || !object.path || object.path.split('/').some(segment=>segment==='.'||segment==='..')) throw new DeletionError('storage_cache_path_review_required',true);
 const endpoint=`${origin}/storage/v1/cdn/${encodeURIComponent(object.bucket)}/${object.path.split('/').map(encodeURIComponent).join('/')}`;
 const result=await fetcher(endpoint,{method:'DELETE',headers:{Authorization:`Bearer ${key}`,apikey:key},signal:AbortSignal.timeout(10000)});
 if(!result.ok) throw new DeletionError('storage_cache_purge_failed',[401,403].includes(result.status));
 // Acknowledgement queues invalidation; the separate storage_cdn task still
 // requires actual URL/CDN and browser-cache lifetime evidence.
}
