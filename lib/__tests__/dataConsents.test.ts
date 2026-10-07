import type { DataConsentSnapshot } from '../dataConsentTypes';
const mockRpc=jest.fn();
const mockSignals: AbortSignal[] = [];
const mockStorage=new Map<string,string>();
const mockSetItem=jest.fn(async(k:string,v:string)=>{mockStorage.set(k,v);});
jest.mock('../supabase',()=>({supabaseUrl:'https://test.supabase.co',supabase:{rpc:(...args:unknown[])=>({abortSignal:(signal:AbortSignal)=>{mockSignals.push(signal);return mockRpc(...args);}})}}));
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(k:string)=>mockStorage.get(k)??null),setItem:mockSetItem,
 getAllKeys:async()=>[...mockStorage.keys()],multiGet:async(keys:string[])=>keys.map(key=>[key,mockStorage.get(key)??null]),
 multiRemove:async(keys:string[])=>keys.forEach(key=>mockStorage.delete(key)),clear:async()=>mockStorage.clear()}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '20000000-0000-4000-8000-000000000001'}));
let service:typeof import('../dataConsents'),runtime:typeof import('../dataConsentRuntime');
const s=(revision=1):DataConsentSnapshot=>({enabled:true,userId:'a',revision,documentVersion:'2026-10-01.1',healthAllowed:true,aiAllowed:true,
 health:{decision:'granted',documentVersion:'2026-10-01.1',decidedAt:'2026-10-01T00:00:00Z'},
 ai:{decision:'granted',documentVersion:'2026-10-01.1',decidedAt:'2026-10-01T00:00:00Z'}});
beforeEach(()=>{
 jest.resetModules();process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED='true';mockStorage.clear();mockRpc.mockReset();mockSetItem.mockClear();mockSignals.length=0;
 runtime=require('../dataConsentRuntime');service=require('../dataConsents');runtime.setConsentIdentity('a');runtime.setRuntimeDataConsents(s());
});
afterEach(()=>{jest.useRealTimers();delete process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;});
it('records an explicit scope, decision, text version, locale and current revision',async()=>{
 mockRpc.mockResolvedValue({data:s(2),error:null});await service.recordDataConsent('ai','granted','es');
 expect(mockRpc).toHaveBeenCalledWith('record_data_consent',{p_scope:'ai',p_decision:'granted',p_document_version:'2026-10-01.1',p_locale:'es',p_operation_id:expect.any(String),p_expected_revision:1});
 expect(JSON.parse(mockStorage.get('data_consent_snapshot_v1:test.supabase.co:a')!)).toEqual(s(2));
});
it('keeps offline withdrawal durable and blocks only its relevant scopes without claiming server success',async()=>{
 mockRpc.mockRejectedValue(new Error('offline'));await expect(service.recordDataConsent('ai','revoked','de')).rejects.toThrow('offline');
 expect(runtime.runtimeConsentAllowed('ai')).toBe(false);expect(runtime.runtimeConsentAllowed('health')).toBe(true);
 expect(mockStorage.get('data_consent_pending_withdrawal_v1:a')).toBe('["ai"]');
 await expect(service.recordDataConsent('ai','granted','de')).rejects.toThrow('withdrawal_pending');
});
it('resumes pending withdrawal after restart before grants become usable',async()=>{
 mockStorage.set('data_consent_pending_withdrawal_v1:a','["health"]');runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');
 mockRpc.mockImplementation(async(name:string)=>({data:name==='get_data_consents'?s():{...s(2),healthAllowed:false,aiAllowed:false,health:{...s().health!,decision:'revoked'},ai:{...s().ai!,decision:'revoked'}},error:null}));
 await service.refreshAndSyncDataConsents('a','en');expect(runtime.runtimeConsentAllowed('health')).toBe(false);
 expect(mockStorage.get('data_consent_pending_withdrawal_v1:a')).toBe('[]');
});
it('retries a withdrawal against the latest revision after a concurrent change',async()=>{
 mockRpc.mockResolvedValueOnce({data:null,error:{code:'40001'}}).mockResolvedValueOnce({data:s(8),error:null})
 .mockResolvedValueOnce({data:{...s(9),aiAllowed:false,ai:{...s().ai!,decision:'revoked'}},error:null});
 await service.recordDataConsent('ai','revoked','de');expect(mockRpc.mock.calls[2][1].p_expected_revision).toBe(8);
 expect(mockRpc.mock.calls[0][1].p_operation_id).toBe(mockRpc.mock.calls[2][1].p_operation_id);
});
it('never retries stale acceptance or turns a failed acceptance into a local grant',async()=>{
 runtime.setRuntimeDataConsents({...s(),aiAllowed:false,ai:null});mockRpc.mockResolvedValue({data:null,error:{code:'40001'}});
 await expect(service.recordDataConsent('ai','granted','de')).rejects.toEqual({code:'40001'});expect(mockRpc).toHaveBeenCalledTimes(1);expect(runtime.runtimeConsentAllowed('ai')).toBe(false);
});
it('rejects late responses across logout and login even into the same account',async()=>{
 let finish!:(r:unknown)=>void;mockRpc.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const result=service.fetchDataConsents('a');await Promise.resolve();await Promise.resolve();
 runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');finish({data:s(),error:null});
 await expect(result).rejects.toThrow('consent_identity_changed');expect(runtime.getRuntimeDataConsents().snapshot).toBeNull();
});
it('does not trust malformed status or a different account',async()=>{
 mockRpc.mockResolvedValue({data:{...s(),userId:'b'},error:null});await expect(service.fetchDataConsents('a')).rejects.toThrow('invalid_consent_snapshot');
});
it('keeps unconfirmed withdrawal through logout cleanup without keeping tokens or health data',async()=>{
 mockRpc.mockRejectedValue(new Error('offline'));await expect(service.recordDataConsent('health','revoked','de')).rejects.toThrow();
 mockStorage.set('sb-abcdefghijklmnopqrst-auth-token','synthetic-token');mockStorage.set('home_cache','synthetic-health-data');
 mockStorage.set('data_consent_snapshot_v1:test.supabase.co:a',JSON.stringify(s()));
 const {clearDeviceStoragePreservingWithdrawals}=require('../dataConsentCleanup');await clearDeviceStoragePreservingWithdrawals();
 expect([...mockStorage.keys()]).toEqual(['data_consent_pending_withdrawal_v1:a']);
 runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');await service.readPendingConsentWithdrawals('a');
 expect(runtime.getRuntimeDataConsents().pending).toEqual(['health']);
});

it('restores a confirmed decision after restart without a network request',async()=>{
 mockRpc.mockResolvedValue({data:s(4),error:null});await service.fetchDataConsents('a');
 runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');mockRpc.mockClear();
 await service.hydrateDataConsents('a');
 expect(runtime.getRuntimeDataConsents().snapshot).toEqual(s(4));expect(runtime.runtimeConsentAllowed('ai')).toBe(true);
 expect(mockRpc).not.toHaveBeenCalled();
 await service.requireDataConsent('ai');expect(mockRpc).not.toHaveBeenCalled();
});
it('restores a local withdrawal before exposing cached grants, even with the network offline',async()=>{
 mockStorage.set('data_consent_snapshot_v1:test.supabase.co:a',JSON.stringify(s()));
 mockStorage.set('data_consent_pending_withdrawal_v1:a','["health"]');
 runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');
 const allowed:boolean[]=[];const unsubscribe=runtime.subscribeDataConsents(()=>allowed.push(runtime.runtimeConsentAllowed('health')));
 await service.hydrateDataConsents('a');unsubscribe();
 expect(allowed).not.toContain(true);expect(runtime.runtimeConsentAllowed('ai')).toBe(false);
 await expect(service.requireDataConsent('health')).rejects.toThrow('health_consent_required');expect(mockRpc).not.toHaveBeenCalled();
});
it.each(['invalid-json',JSON.stringify({...s(),userId:'b'}),JSON.stringify({...s(),documentVersion:'old'})])('ignores unusable local snapshots: %s',async(raw)=>{
 mockStorage.set('data_consent_snapshot_v1:test.supabase.co:a',raw);
 runtime.setConsentIdentity(null);runtime.setConsentIdentity('a');await service.hydrateDataConsents('a');
 expect(runtime.getRuntimeDataConsents().snapshot).toBeNull();expect(runtime.runtimeConsentAllowed('health')).toBe(false);
});
it('never restores another account or backend from a saved decision',async()=>{
 mockStorage.set('data_consent_snapshot_v1:test.supabase.co:a',JSON.stringify(s()));
 mockStorage.set('data_consent_snapshot_v1:other.supabase.co:b',JSON.stringify({...s(),userId:'b'}));
 runtime.setConsentIdentity('b');await service.hydrateDataConsents('b');
 expect(runtime.getRuntimeDataConsents().snapshot).toBeNull();expect(runtime.runtimeConsentAllowed('health')).toBe(false);
});
it('does not replace a saved newer withdrawal with a late older fetch',async()=>{
 const revoked={...s(9),aiAllowed:false,ai:{...s().ai!,decision:'revoked' as const}};
 runtime.setRuntimeDataConsents(revoked);mockRpc.mockResolvedValue({data:s(1),error:null});
 await service.fetchDataConsents('a');
 expect(JSON.parse(mockStorage.get('data_consent_snapshot_v1:test.supabase.co:a')!)).toEqual(revoked);
 expect(runtime.runtimeConsentAllowed('ai')).toBe(false);
});
it('ends a stalled initial check and ignores its eventual late response',async()=>{
 jest.useFakeTimers();runtime.setRuntimeDataConsents(null);
 let finish!:(value:unknown)=>void;mockRpc.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
 const request=service.fetchDataConsents('a');const rejected=expect(request).rejects.toThrow('consent_request_timeout');
 await jest.advanceTimersByTimeAsync(10_000);await rejected;
 expect(mockSignals[0].aborted).toBe(true);finish({data:s(),error:null});await Promise.resolve();
 expect(runtime.getRuntimeDataConsents().snapshot).toBeNull();expect(mockStorage.has('data_consent_snapshot_v1:test.supabase.co:a')).toBe(false);
});
