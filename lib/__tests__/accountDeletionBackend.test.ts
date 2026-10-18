/** @jest-environment node */
import { createRequestHandler } from '../../supabase/functions/request-account-deletion/handler';
import { createProcessHandler } from '../../supabase/functions/process-account-deletion/handler';
import { deleteRevenueCatCustomer } from '../../supabase/functions/_shared/accountDeletion/revenuecat';
import { purgeDeletedObjectCache } from '../../supabase/functions/_shared/accountDeletion/storageCache';
const userId='11111111-1111-4111-8111-111111111111';
const id='22222222-2222-4222-8222-222222222222';
const env: Record<string,string>={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only',ACCOUNT_DELETION_ENABLED:'true',ACCOUNT_DELETION_CRON_SECRET:'x'.repeat(40)};
const tokenFor=(claims: Record<string,unknown>={}) => `header.${Buffer.from(JSON.stringify({sub:userId,role:'authenticated',amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}],...claims})).toString('base64url')}.signature`;
const body={confirm:true,scope:'account',source:'app',policyVersion:'2026-09-11'};
function setup(){
 const admin={rpc:jest.fn().mockResolvedValue({data:{requestId:id,status:'queued',scope:'account'},error:null}),auth:{getUser:jest.fn().mockResolvedValue({data:{user:{id:userId}},error:null}),admin:{signOut:jest.fn().mockResolvedValue({error:null})}}};
 const handle=createRequestHandler({env:k=>env[k],createAdmin:()=>admin});return {admin,handle};
}
const request=(payload:unknown=body,headers:Record<string,string>={Authorization:`Bearer ${tokenFor()}`})=>new Request('https://example.test/request',{method:'POST',headers,body:JSON.stringify(payload)});
it('accepts the verified identity and returns a durable receipt',async()=>{
 const {handle,admin}=setup();const response=await handle(request());expect(response.status).toBe(202);expect(await response.json()).toEqual({requestId:id,status:'queued',scope:'account'});
 expect(admin.rpc).toHaveBeenCalledWith('account_deletion_worker',{action:'accept',payload:{userId,scope:'account',source:'app'}});
});
it.each([null,{}, {...body,userId:'victim'}, {...body,confirm:false}, {...body,policyVersion:'old'}, {...body,source:'support'}])('rejects malformed or forged requests %j',async(payload)=>{
 const {handle,admin}=setup();expect((await handle(request(payload))).status).toBe(400);expect(admin.rpc).not.toHaveBeenCalled();
});
it('does not authenticate an absent or invalid token',async()=>{
 const {handle,admin}=setup();expect((await handle(request(body,{}))).status).toBe(401);
 admin.auth.getUser.mockResolvedValueOnce({data:{user:null} as any,error:null});expect((await handle(request())).status).toBe(401);expect(admin.rpc).not.toHaveBeenCalled();
});
it('requires the correct Origin and never accepts deletion on GET',async()=>{
 const {handle,admin}=setup();expect((await handle(request(body,{Authorization:'Bearer token',Origin:'https://foreign.invalid'}))).status).toBe(403);
 expect((await handle(new Request('https://example.test/request'))).status).toBe(200);
 expect(admin.rpc).toHaveBeenCalledWith('account_deletion_readiness');
 expect(admin.auth.getUser).not.toHaveBeenCalled();expect(admin.auth.admin.signOut).not.toHaveBeenCalled();
});
it('rejects a stale authentication and never calls signOut',async()=>{
 const {handle,admin}=setup();admin.rpc.mockResolvedValueOnce({data:null,error:{message:'recent_authentication_required'}} as any);
 expect((await handle(request())).status).toBe(403);expect(admin.auth.admin.signOut).not.toHaveBeenCalled();
});
it('does not lose a stored request if session revocation fails',async()=>{
 const {handle,admin}=setup();admin.auth.admin.signOut.mockRejectedValueOnce(new Error('network'));expect((await handle(request())).status).toBe(202);
});
it('fails closed without live enablement',async()=>{
 const handle=createRequestHandler({env:k=>k==='ACCOUNT_DELETION_ENABLED'?'false':env[k],createAdmin:()=>{throw new Error('must not create');}});
 expect((await handle(request())).status).toBe(503);
});
it('reports disabled acceptance without constructing a privileged client',async()=>{
 const createAdmin=jest.fn(); const handle=createRequestHandler({env:k=>k==='ACCOUNT_DELETION_ENABLED'?'false':env[k],createAdmin});
 const response=await handle(new Request('https://example.test/request'));
 expect(await response.json()).toEqual({available:false}); expect(createAdmin).not.toHaveBeenCalled();
});
it.each([true,false])('returns the database acceptance result without account data: %s',async(available)=>{
 const {handle,admin}=setup();admin.rpc.mockResolvedValueOnce({data:available,error:null} as any);
 const response=await handle(new Request('https://example.test/request'));
 expect(await response.json()).toEqual({available});expect(response.headers.get('Cache-Control')).toBe('no-store');
 expect(admin.auth.getUser).not.toHaveBeenCalled();expect(admin.auth.admin.signOut).not.toHaveBeenCalled();
});
it('does not advertise acceptance when the readiness RPC fails',async()=>{
 const {handle,admin}=setup();admin.rpc.mockResolvedValueOnce({data:null,error:{message:'private database details'}} as any);
 const response=await handle(new Request('https://example.test/request'));expect(response.status).toBe(503);
 expect(await response.json()).toEqual({error:'temporary_failure'});
});
it('restricts native QA readiness and acceptance to the exact verified fixture',async()=>{
 const {admin}=setup();const scoped: Record<string,string>={...env,SUPABASE_URL:'https://ggyonianphloycmqrwvj.supabase.co',ACCOUNT_DELETION_QA_TEST_USER_ID:userId};
 const handle=createRequestHandler({env:k=>scoped[k],createAdmin:()=>admin});
 expect(await (await handle(new Request('https://example.test/request'))).json()).toEqual({available:false});
 expect(admin.rpc).not.toHaveBeenCalled();
 admin.rpc.mockResolvedValueOnce({data:true,error:null} as any);
 expect(await (await handle(new Request('https://example.test/request',{headers:{Authorization:`Bearer ${tokenFor()}`}}))).json()).toEqual({available:true});
 expect((await handle(request())).status).toBe(202);
 admin.rpc.mockClear();admin.auth.admin.signOut.mockClear();
 admin.auth.getUser.mockResolvedValue({data:{user:{id}},error:null});
 expect(await (await handle(new Request('https://example.test/request',{headers:{Authorization:'Bearer other-token'}}))).json()).toEqual({available:false});
 expect((await handle(request())).status).toBe(503);
 expect(admin.rpc).not.toHaveBeenCalled();expect(admin.auth.admin.signOut).not.toHaveBeenCalled();
});
it.each([
 {SUPABASE_URL:'https://kwniiyayhzgjfqjsjcfu.supabase.co',ACCOUNT_DELETION_QA_TEST_USER_ID:userId},
 {SUPABASE_URL:'https://ggyonianphloycmqrwvj.supabase.co',ACCOUNT_DELETION_QA_TEST_USER_ID:''},
 {SUPABASE_URL:'https://ggyonianphloycmqrwvj.supabase.co',ACCOUNT_DELETION_QA_TEST_USER_ID:'invalid'},
])('fails closed with an invalid or production QA-test restriction',async(config)=>{
 const scoped: Record<string,string>={...env,...config};const createAdmin=jest.fn();const handle=createRequestHandler({env:k=>scoped[k],createAdmin});
 expect(await (await handle(new Request('https://example.test/request'))).json()).toEqual({available:false});
 expect((await handle(request())).status).toBe(503);expect(createAdmin).not.toHaveBeenCalled();
});
it('never uses the general RevenueCat subscription key for deletion',async()=>{
 const fetcher=jest.fn();await expect(deleteRevenueCatCustomer(userId,k=>({REVENUECAT_PROJECT_ID:'project',REVENUECAT_SECRET_API_KEY:'readonly-general'}[k]),fetcher)).rejects.toThrow('revenuecat_not_configured');
 expect(fetcher).not.toHaveBeenCalled();
});
it('bounds chunked request bodies',async()=>{
 const {handle,admin}=setup();expect((await handle(request({padding:'x'.repeat(5000)}))).status).toBe(413);expect(admin.rpc).not.toHaveBeenCalled();
});
it('storage errors leave the batch pending and schedule a durable retry',async()=>{
 const rpc=jest.fn(async(_name:string,{action}:any):Promise<any>=>({data:action==='claim'?{id,user_id:userId,scope:'account',phase:'storage',lease:id}:action==='objects'?[{bucket:'chat-audio',path:'direct/user/audio.m4a'}]:{},error:null}));
 const remove=jest.fn().mockResolvedValue({error:{message:'storage offline'}});
 const handle=createProcessHandler({env:k=>env[k],createAdmin:()=>({rpc,storage:{from:()=>({remove})}})});
 const result=await handle(new Request('https://example.test/worker',{method:'POST',headers:{Authorization:`Bearer ${env.ACCOUNT_DELETION_CRON_SECRET}`}}));
 expect(result.status).toBe(503);expect(rpc.mock.calls.some(([,args])=>args.action==='objects_removed')).toBe(false);
 expect(rpc).toHaveBeenLastCalledWith('account_deletion_worker',{action:'fail',payload:{requestId:id,lease:id,code:'storage_delete_failed',manual:false}});
});
it('worker rejects a user JWT and an empty cron secret',async()=>{
 const createAdmin=jest.fn();const handle=createProcessHandler({env:k=>env[k],createAdmin});
 expect((await handle(new Request('https://example.test/worker',{method:'POST',headers:{Authorization:'Bearer user-token'}}))).status).toBe(401);expect(createAdmin).not.toHaveBeenCalled();
});
it('an initial RevenueCat 404 is not deletion proof',async()=>{
 const fetcher=jest.fn().mockResolvedValue(new Response('',{status:404}));
 await expect(deleteRevenueCatCustomer(userId,k=>({REVENUECAT_PROJECT_ID:'project',REVENUECAT_DELETION_API_KEY:'key'}[k]),fetcher)).rejects.toThrow('identity_review');
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it('purges only the exact removed object cache and rejects path traversal',async()=>{
 const fetcher=jest.fn().mockResolvedValue(Response.json({message:'success'}));
 await purgeDeletedObjectCache('https://qa.test','key',{bucket:'public-images',path:'folder/synthetic file.png'},fetcher);
 expect(fetcher).toHaveBeenCalledWith('https://qa.test/storage/v1/cdn/public-images/folder/synthetic%20file.png',expect.objectContaining({method:'DELETE',headers:{Authorization:'Bearer key',apikey:'key'}}));
 await expect(purgeDeletedObjectCache('https://qa.test','key',{bucket:'public-images',path:'../foreign'},fetcher)).rejects.toThrow('path_review');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not mark removed objects after a cache purge failure',async()=>{
 const rpc=jest.fn(async(_name:string,{action}:any):Promise<any>=>({data:action==='claim'?{id,user_id:userId,scope:'account',phase:'storage',lease:id}:action==='objects'?[{bucket:'public-images',path:'synthetic.png'}]:{},error:null}));
 const storage={from:()=>({remove:jest.fn().mockResolvedValue({error:null}),list:jest.fn().mockResolvedValue({data:[],error:null})})};
 const fetcher=jest.fn().mockResolvedValue(new Response('',{status:503}));
 const handle=createProcessHandler({env:k=>env[k],createAdmin:()=>({rpc,storage}),fetcher});
 expect((await handle(new Request('https://example.test/worker',{method:'POST',headers:{Authorization:`Bearer ${env.ACCOUNT_DELETION_CRON_SECRET}`}}))).status).toBe(503);
 expect(rpc.mock.calls.some(([,args])=>args.action==='objects_removed')).toBe(false);
 expect(rpc).toHaveBeenLastCalledWith('account_deletion_worker',{action:'fail',payload:{requestId:id,lease:id,code:'storage_cache_purge_failed',manual:false}});
});
it('bounds remove/list/cache work to three objects and leaves remaining manifest entries pending',async()=>{
 const objects=Array.from({length:4},(_,i)=>({bucket:'public-images',path:`synthetic-${i}.png`}));
 const rpc=jest.fn(async(_name:string,{action}:any):Promise<any>=>({data:action==='claim'?{id,user_id:userId,scope:'account',phase:'storage',lease:id}:action==='objects'?objects:{},error:null}));
 const remove=jest.fn().mockResolvedValue({error:null});const list=jest.fn().mockResolvedValue({data:[],error:null});
 const fetcher=jest.fn().mockResolvedValue(Response.json({message:'success'}));
 const handle=createProcessHandler({env:k=>env[k],createAdmin:()=>({rpc,storage:{from:()=>({remove,list})}}),fetcher});
 expect((await handle(new Request('https://example.test/worker',{method:'POST',headers:{Authorization:`Bearer ${env.ACCOUNT_DELETION_CRON_SECRET}`}}))).status).toBe(200);
 expect(remove).toHaveBeenCalledWith(objects.slice(0,3).map(o=>o.path));expect(list).toHaveBeenCalledTimes(3);expect(fetcher).toHaveBeenCalledTimes(3);
 expect(rpc).toHaveBeenCalledWith('account_deletion_worker',{action:'objects_removed',payload:{requestId:id,lease:id,objects:objects.slice(0,3)}});
});
it('protects a RevenueCat identity shared with another account',async()=>{
 const fetcher=jest.fn().mockResolvedValueOnce(Response.json({id:userId})).mockResolvedValueOnce(Response.json({items:[{id}],next_page:null}));
 await expect(deleteRevenueCatCustomer(userId,k=>({REVENUECAT_PROJECT_ID:'project',REVENUECAT_DELETION_API_KEY:'key'}[k]),fetcher)).rejects.toThrow('shared_identity');
 expect(fetcher.mock.calls.every(([,options])=>options.method==='GET')).toBe(true);
});
it('waits for RevenueCat asynchronous deletion before recording success',async()=>{
 const fetcher=jest.fn()
  .mockResolvedValueOnce(Response.json({id:userId}))
  .mockResolvedValueOnce(Response.json({items:[],next_page:null}))
  .mockResolvedValueOnce(Response.json({id:userId,deleted_at:Date.now()}))
  .mockResolvedValueOnce(Response.json({id:userId,deleted_at:Date.now()}))
  .mockResolvedValueOnce(new Response('',{status:404}));
 const pause=jest.fn().mockResolvedValue(undefined);
 const evidence=await deleteRevenueCatCustomer(userId,k=>({REVENUECAT_PROJECT_ID:'project',REVENUECAT_DELETION_API_KEY:'key'}[k]),fetcher,pause);
 expect(evidence).toContain('subsequent GET returned 404');
 expect(fetcher.mock.calls.map(([,options])=>options.method)).toEqual(['GET','GET','DELETE','GET','GET']);
 expect(pause).toHaveBeenCalledWith(1000);
});

it.each([
 {amr:[]},
 {amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)-601}],iat:Math.floor(Date.now()/1000)},
 {amr:[{method:'token_refresh',timestamp:Math.floor(Date.now()/1000)}]},
 {amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)+3600}]},
 {sub:id},
])('requires fresh OTP on the presented verified session: %j',async(claims)=>{
 const {handle,admin}=setup();
 expect((await handle(request(body,{Authorization:`Bearer ${tokenFor(claims)}`}))).status).toBe(403);
 expect(admin.rpc).not.toHaveBeenCalled();
});
